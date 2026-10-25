import * as XLSX from 'xlsx';
import {
  Complaint,
  Institution,
  UserProfile,
  GlobalFilters,
  CaseFilters,
  OverlapGroup,
} from '../types';
import { matchInstitution } from '../engine/overlap';

// Reference current date in the AICTE demo environment
export const REFERENCE_NOW_MS = new Date('2026-10-24T12:00:00Z').getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SLAStatusInfo {
  daysRemaining: number;
  ageDays: number;
  state: 'DISPOSED' | 'OVERDUE' | 'DUE_SOON' | 'WITHIN_SLA';
  label: string;
}

export function getSLAInfo(complaint: Complaint): SLAStatusInfo {
  const rcvMs = new Date(complaint.receivedDate).getTime();
  const ageDays = Math.max(1, Math.round((REFERENCE_NOW_MS - rcvMs) / DAY_MS));

  if (complaint.status === 'Disposed') {
    const dispMs = complaint.disposedDate
      ? new Date(complaint.disposedDate).getTime()
      : REFERENCE_NOW_MS;
    const disposedDays = Math.max(1, Math.round((dispMs - rcvMs) / DAY_MS));
    return {
      daysRemaining: 0,
      ageDays: disposedDays,
      state: 'DISPOSED',
      label: `Disposed in ${disposedDays}d`,
    };
  }

  const expMs = new Date(complaint.expectedDisposalDate).getTime();
  const daysRemaining = Math.ceil((expMs - REFERENCE_NOW_MS) / DAY_MS);

  if (daysRemaining < 0) {
    return {
      daysRemaining,
      ageDays,
      state: 'OVERDUE',
      label: `Overdue ${Math.abs(daysRemaining)}d`,
    };
  }
  if (daysRemaining <= 7) {
    return {
      daysRemaining,
      ageDays,
      state: 'DUE_SOON',
      label: `Due in ${daysRemaining}d`,
    };
  }
  return {
    daysRemaining,
    ageDays,
    state: 'WITHIN_SLA',
    label: `${daysRemaining}d left`,
  };
}

export function maskComplainantName(name: string, canViewUnmasked: boolean): string {
  if (canViewUnmasked || !name) return name;
  const parts = name.split(' ');
  return parts
    .map((p) => (p.length <= 2 ? p : `${p[0]}${'*'.repeat(Math.min(5, p.length - 1))}`))
    .join(' ');
}

export function maskContact(contact: string, canViewUnmasked: boolean): string {
  if (canViewUnmasked || !contact) return contact;
  if (contact.length >= 6) {
    return `${contact.slice(0, 2)}******${contact.slice(-2)}`;
  }
  return '********';
}

export function canUserEditCase(user: UserProfile, complaint: Complaint): boolean {
  if (user.canEditAll || user.roleType === 'SUPER_ADMIN') return true;
  if (user.roleType === 'SENIOR_MANAGEMENT') return false;
  if (user.canEditOwnBureau && user.bureau === complaint.currentBureau) return true;
  return false;
}

/**
 * Filter complaints by role scope and GlobalFilters
 */
export function filterComplaintsByGlobalScope(
  complaints: Complaint[],
  institutions: Institution[],
  user: UserProfile,
  globalFilters: GlobalFilters
): Complaint[] {
  const instMap = new Map<string, Institution>();
  for (const inst of institutions) instMap.set(inst.aicteId, inst);

  const effectiveRegion =
    user.roleType === 'REGIONAL_OFFICER' && user.region ? user.region : globalFilters.region;

  let cutoffMs = 0;
  if (globalFilters.dateRange !== 'ALL') {
    const days =
      globalFilters.dateRange === '30D'
        ? 30
        : globalFilters.dateRange === '90D'
        ? 90
        : globalFilters.dateRange === '180D'
        ? 180
        : 365;
    cutoffMs = REFERENCE_NOW_MS - days * DAY_MS;
  }

  return complaints.filter((c) => {
    const inst = instMap.get(c.institutionId);
    if (effectiveRegion !== 'ALL' && inst?.region !== effectiveRegion) {
      return false;
    }
    if (globalFilters.bureau !== 'ALL' && c.currentBureau !== globalFilters.bureau) {
      return false;
    }
    if (cutoffMs > 0) {
      const rcvMs = new Date(c.receivedDate).getTime();
      if (rcvMs < cutoffMs) return false;
    }
    return true;
  });
}

/**
 * Filter complaints by CaseRegister filters (including fuzzy alias-aware institution matching)
 */
export function filterComplaintsForRegister(
  complaints: Complaint[],
  institutions: Institution[],
  user: UserProfile,
  filters: CaseFilters,
  overlapGroups: OverlapGroup[]
): Complaint[] {
  const instMap = new Map<string, Institution>();
  for (const inst of institutions) instMap.set(inst.aicteId, inst);

  const activeOverlapCaseIds = new Set<string>();
  for (const og of overlapGroups) {
    if (og.status !== 'Dismissed as false positive' && !og.status.startsWith('Resolved')) {
      for (const cid of og.caseIds) activeOverlapCaseIds.add(cid);
    }
  }

  const effectiveRegion =
    user.roleType === 'REGIONAL_OFFICER' && user.region ? user.region : filters.region;

  // Pre-compute fuzzy matched institution IDs if search is present
  let fuzzyMatchedInstIds = new Set<string>();
  const q = filters.search.trim();
  const qLower = q.toLowerCase();
  if (q) {
    const matches = matchInstitution(q, institutions);
    for (const m of matches) {
      if (m.score >= 0.82) {
        fuzzyMatchedInstIds.add(m.institution.aicteId);
      }
    }
  }

  return complaints.filter((c) => {
    const inst = instMap.get(c.institutionId);

    if (effectiveRegion !== 'ALL' && inst?.region !== effectiveRegion) return false;
    if (filters.institutionId && c.institutionId !== filters.institutionId) return false;
    if (filters.bureau !== 'ALL' && c.currentBureau !== filters.bureau) return false;
    if (filters.category !== 'ALL' && c.category !== filters.category) return false;
    if (filters.status !== 'ALL' && c.status !== filters.status) return false;
    if (filters.priority !== 'ALL' && c.priority !== filters.priority) return false;

    const slaInfo = getSLAInfo(c);
    if (filters.slaFilter === 'OVERDUE' && slaInfo.state !== 'OVERDUE') return false;
    if (filters.slaFilter === 'DUE_SOON' && slaInfo.state !== 'DUE_SOON') return false;
    if (filters.slaFilter === 'WITHIN_SLA' && slaInfo.state !== 'WITHIN_SLA') return false;

    if (filters.overlapOnly && !activeOverlapCaseIds.has(c.caseId)) return false;

    if (filters.minAgeDays && slaInfo.ageDays < filters.minAgeDays) return false;

    if (q) {
      const directMatch =
        c.caseId.toLowerCase().includes(qLower) ||
        c.institutionId.toLowerCase().includes(qLower) ||
        c.category.toLowerCase().includes(qLower) ||
        c.currentBureau.toLowerCase().includes(qLower) ||
        c.description.toLowerCase().includes(qLower) ||
        (c.submittedInstitutionName && c.submittedInstitutionName.toLowerCase().includes(qLower)) ||
        (inst && inst.name.toLowerCase().includes(qLower)) ||
        (inst && inst.city.toLowerCase().includes(qLower));

      if (!directMatch && !fuzzyMatchedInstIds.has(c.institutionId)) {
        return false;
      }
    }

    return true;
  });
}

export function exportToCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(filename: string, sheetName: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(
    workbook,
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  );
}
