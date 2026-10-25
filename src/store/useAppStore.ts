import { create } from 'zustand';
import {
  Institution,
  Complaint,
  ActionHistory,
  OverlapGroup,
  Alert,
  AuditLog,
  UserProfile,
  SLAConfig,
  NotificationSettings,
  GlobalFilters,
  CaseFilters,
  SavedFilter,
  Bureau,
  CaseStatus,
  Priority,
  ComplaintCategory,
  ComplaintSource,
  ActionType,
} from '../types';
import { generateSeedDatabase, DEMO_USERS, DEFAULT_SLA_CONFIG } from '../data/seed';
import { detectAllOverlaps, computeInstitutionRisk } from '../engine/overlap';
import { Language } from '../i18n/translations';

const STORAGE_KEY = 'aicte_iicmd_state_v1';

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'warning' | 'info';
}

interface AppState {
  // Data entities
  institutions: Institution[];
  complaints: Complaint[];
  actionHistories: Record<string, ActionHistory[]>;
  overlapGroups: OverlapGroup[];
  alerts: Alert[];
  auditLogs: AuditLog[];
  slaConfig: SLAConfig;
  notificationSettings: NotificationSettings;

  // User & Auth simulation
  currentUser: UserProfile;
  availableUsers: UserProfile[];
  showLoginModal: boolean;

  // UI & Filters
  language: Language;
  aiAvailable: boolean;
  lastRefreshedAt: string;
  globalFilters: GlobalFilters;
  caseFilters: CaseFilters;
  savedFilters: SavedFilter[];
  toasts: ToastMessage[];
  createComplaintModalOpen: boolean;
  demoWalkthroughOpen: boolean;

  // Actions
  setLanguage: (lang: Language) => void;
  setAiAvailable: (available: boolean) => void;
  switchUserRole: (userId: string) => void;
  setShowLoginModal: (show: boolean) => void;
  setCreateComplaintModalOpen: (open: boolean) => void;
  setDemoWalkthroughOpen: (open: boolean) => void;
  setGlobalFilters: (filters: Partial<GlobalFilters>) => void;
  setCaseFilters: (filters: Partial<CaseFilters>) => void;
  resetCaseFilters: () => void;
  saveCurrentFilter: (name: string) => void;
  deleteSavedFilter: (id: string) => void;
  addToast: (title: string, description?: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
  pulseRefresh: () => void;

  // Case Lifecycle Actions
  performCaseAction: (params: {
    caseId: string;
    actionType: ActionType;
    newStatus?: CaseStatus;
    toBureau?: Bureau;
    remarks: string;
    nextActionRequired?: string;
    documentName?: string;
  }) => void;

  createNewComplaint: (params: {
    institutionId: string;
    submittedInstitutionName: string;
    source: ComplaintSource;
    complainantName: string;
    complainantContact: string;
    category: ComplaintCategory;
    priority: Priority;
    description: string;
    assignedBureau: Bureau;
  }) => string;

  linkCases: (caseIds: string[], reason: string) => void;
  unlinkCase: (caseIdA: string, caseIdB: string) => void;

  // Overlap & Coordination Actions
  rescanOverlaps: () => number;
  initiateCoordination: (groupId: string, note?: string) => void;
  assignLeadBureau: (groupId: string, leadBureau: Bureau, note?: string) => void;
  mergeOverlapCases: (groupId: string, primaryCaseId: string, note?: string) => void;
  dismissOverlapAsFalsePositive: (groupId: string, reason: string) => void;
  addCoordinationNote: (groupId: string, message: string) => void;

  // Alerts & Admin Actions
  markAlertRead: (alertId: string) => void;
  markAllAlertsRead: () => void;
  snoozeAlert: (alertId: string, hours: number) => void;
  updateSLAConfig: (newConfig: SLAConfig) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  importInstitutionsAndCases: (newInstitutions: Institution[], newComplaints: Complaint[]) => void;
  logSensitiveCaseView: (caseId: string) => void;
  resetDemoData: () => void;
}

const DEFAULT_CASE_FILTERS: CaseFilters = {
  search: '',
  region: 'ALL',
  bureau: 'ALL',
  category: 'ALL',
  status: 'ALL',
  priority: 'ALL',
  slaFilter: 'ALL',
  overlapOnly: false,
};

function loadInitialData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.institutions) && parsed.institutions.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return generateSeedDatabase();
}

function saveToStorage(state: Partial<AppState>) {
  try {
    const payload = {
      institutions: state.institutions,
      complaints: state.complaints,
      actionHistories: state.actionHistories,
      overlapGroups: state.overlapGroups,
      alerts: state.alerts,
      auditLogs: state.auditLogs,
      slaConfig: state.slaConfig,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota errors
  }
}

const initialSeed = loadInitialData();

export const useAppStore = create<AppState>((set, get) => ({
  institutions: initialSeed.institutions,
  complaints: initialSeed.complaints,
  actionHistories: initialSeed.actionHistories,
  overlapGroups: initialSeed.overlapGroups,
  alerts: initialSeed.alerts,
  auditLogs: initialSeed.auditLogs,
  slaConfig: initialSeed.slaConfig ?? DEFAULT_SLA_CONFIG,
  notificationSettings: {
    inApp: true,
    emailGateway: true,
    smsGateway: false,
    cpgramsWebhook: true,
    approachingSlaThresholds: [7, 3, 1],
  },

  currentUser: DEMO_USERS[0], // Super Admin by default
  availableUsers: DEMO_USERS,
  showLoginModal: false,

  language: 'en',
  aiAvailable: false,
  lastRefreshedAt: new Date().toLocaleTimeString(),
  globalFilters: {
    region: 'ALL',
    bureau: 'ALL',
    dateRange: 'ALL',
  },
  caseFilters: { ...DEFAULT_CASE_FILTERS },
  savedFilters: [
    {
      id: 'SF-1',
      name: 'Southern Region Salary & Fee Overlaps',
      filters: {
        ...DEFAULT_CASE_FILTERS,
        region: 'Southern',
        overlapOnly: true,
      },
    },
    {
      id: 'SF-2',
      name: 'Critical Beyond-SLA Cases',
      filters: {
        ...DEFAULT_CASE_FILTERS,
        priority: 'Critical',
        slaFilter: 'OVERDUE',
      },
    },
  ],
  toasts: [],
  createComplaintModalOpen: false,
  demoWalkthroughOpen: false,

  setLanguage: (language) => set({ language }),
  setAiAvailable: (aiAvailable) => set({ aiAvailable }),

  switchUserRole: (userId) => {
    const user = get().availableUsers.find((u) => u.id === userId);
    if (!user) return;

    // If switching to Regional Officer, scope global/case region filter automatically
    const globalFilters = { ...get().globalFilters };
    const caseFilters = { ...get().caseFilters };
    if (user.roleType === 'REGIONAL_OFFICER' && user.region) {
      globalFilters.region = user.region;
      caseFilters.region = user.region;
    } else {
      globalFilters.region = 'ALL';
      caseFilters.region = 'ALL';
    }

    const newLog: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: user.name,
      role: user.roleType,
      bureau: user.bureau,
      action: 'ROLE_SWITCHED',
      targetId: user.id,
      details: `Switched active session to ${user.name} (${user.designation})`,
    };

    set((state) => ({
      currentUser: user,
      globalFilters,
      caseFilters,
      showLoginModal: false,
      auditLogs: [newLog, ...state.auditLogs],
    }));

    get().addToast(
      `Role Switched: ${user.name}`,
      user.roleType === 'REGIONAL_OFFICER'
        ? `Scoped view to ${user.region} Region`
        : `Active Bureau: ${user.bureau}`,
      'info'
    );
  },

  setShowLoginModal: (showLoginModal) => set({ showLoginModal }),
  setCreateComplaintModalOpen: (createComplaintModalOpen) => set({ createComplaintModalOpen }),
  setDemoWalkthroughOpen: (demoWalkthroughOpen) => set({ demoWalkthroughOpen }),

  setGlobalFilters: (partial) =>
    set((state) => {
      const updated = { ...state.globalFilters, ...partial };
      // Keep regional officer locked to their region
      if (state.currentUser.roleType === 'REGIONAL_OFFICER' && state.currentUser.region) {
        updated.region = state.currentUser.region;
      }
      return { globalFilters: updated };
    }),

  setCaseFilters: (partial) =>
    set((state) => {
      const updated = { ...state.caseFilters, ...partial };
      if (state.currentUser.roleType === 'REGIONAL_OFFICER' && state.currentUser.region) {
        updated.region = state.currentUser.region;
      }
      return { caseFilters: updated };
    }),

  resetCaseFilters: () =>
    set((state) => ({
      caseFilters: {
        ...DEFAULT_CASE_FILTERS,
        region:
          state.currentUser.roleType === 'REGIONAL_OFFICER' && state.currentUser.region
            ? state.currentUser.region
            : 'ALL',
      },
    })),

  saveCurrentFilter: (name) => {
    if (!name.trim()) return;
    const newFilter: SavedFilter = {
      id: `SF-${Date.now()}`,
      name: name.trim(),
      filters: { ...get().caseFilters },
    };
    set((state) => ({ savedFilters: [...state.savedFilters, newFilter] }));
    get().addToast('Filter Saved', `"${name}" added to quick filters.`, 'success');
  },

  deleteSavedFilter: (id) =>
    set((state) => ({
      savedFilters: state.savedFilters.filter((f) => f.id !== id),
    })),

  addToast: (title, description, type = 'info') => {
    const id = `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, title, description, type }],
    }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 4500);
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  pulseRefresh: () => set({ lastRefreshedAt: new Date().toLocaleTimeString() }),

  performCaseAction: ({
    caseId,
    actionType,
    newStatus,
    toBureau,
    remarks,
    nextActionRequired,
    documentName,
  }) => {
    const state = get();
    const targetCase = state.complaints.find((c) => c.caseId === caseId);
    if (!targetCase) return;

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];

    const updatedBureau = toBureau ?? targetCase.currentBureau;
    const updatedStatus =
      newStatus ??
      (actionType === 'Transferred'
        ? 'Transferred'
        : actionType === 'Escalated'
        ? 'Escalated'
        : actionType === 'Disposed'
        ? 'Disposed'
        : actionType === 'Reopened'
        ? 'Reopened'
        : targetCase.status);

    const newActionEntry: ActionHistory = {
      id: `ACT-${caseId}-${Date.now()}`,
      caseId,
      timestamp: nowIso,
      actionType,
      fromBureau: targetCase.currentBureau,
      toBureau: toBureau,
      officer: state.currentUser.name,
      remarks,
      documents: documentName ? [documentName] : [],
    };

    const updatedComplaints = state.complaints.map((c) => {
      if (c.caseId !== caseId) return c;
      return {
        ...c,
        status: updatedStatus,
        currentBureau: updatedBureau,
        lastAction: remarks,
        lastActionDate: todayDate,
        nextActionRequired:
          nextActionRequired ??
          (updatedStatus === 'Disposed'
            ? 'No further action required (Archived)'
            : c.nextActionRequired),
        disposedDate: updatedStatus === 'Disposed' ? todayDate : c.disposedDate,
      };
    });

    const existingHistory = state.actionHistories[caseId] ?? [];
    const updatedHistories = {
      ...state.actionHistories,
      [caseId]: [...existingHistory, newActionEntry],
    };

    const updatedOverlapGroups = detectAllOverlaps(
      updatedComplaints,
      state.institutions,
      state.overlapGroups
    );

    const updatedInstitutions = state.institutions.map((inst) => {
      if (inst.aicteId !== targetCase.institutionId) return inst;
      const instCases = updatedComplaints.filter((c) => c.institutionId === inst.aicteId);
      return {
        ...inst,
        riskScore: computeInstitutionRisk(inst, instCases, updatedOverlapGroups).score,
      };
    });

    const newAlerts = [...state.alerts];
    if (actionType === 'Transferred' && toBureau) {
      newAlerts.unshift({
        id: `ALT-TRF-${Date.now()}`,
        type: 'Pending reminder',
        caseId,
        institutionId: targetCase.institutionId,
        targetBureau: toBureau,
        severity: 'High',
        message: `Case ${caseId} transferred from ${targetCase.currentBureau} to ${toBureau}: ${remarks}`,
        createdAt: nowIso,
        read: false,
      });
    } else if (actionType === 'Escalated') {
      newAlerts.unshift({
        id: `ALT-ESC-${Date.now()}`,
        type: 'Escalation',
        caseId,
        institutionId: targetCase.institutionId,
        targetBureau: updatedBureau,
        severity: 'Critical',
        message: `Case ${caseId} escalated by ${state.currentUser.name}: ${remarks}`,
        createdAt: nowIso,
        read: false,
      });
    }

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: nowIso,
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: `CASE_${actionType.toUpperCase().replace(/\s+/g, '_')}`,
      targetId: caseId,
      details: `${actionType} on ${caseId} (Status: ${updatedStatus}, Bureau: ${updatedBureau}) – ${remarks}`,
    };

    set({
      complaints: updatedComplaints,
      actionHistories: updatedHistories,
      overlapGroups: updatedOverlapGroups,
      institutions: updatedInstitutions,
      alerts: newAlerts,
      auditLogs: [newAudit, ...state.auditLogs],
    });

    saveToStorage(get());
    get().addToast(`Action Recorded: ${actionType}`, `Case ${caseId} updated to "${updatedStatus}".`, 'success');
  },

  createNewComplaint: ({
    institutionId,
    submittedInstitutionName,
    source,
    complainantName,
    complainantContact,
    category,
    priority,
    description,
    assignedBureau,
  }) => {
    const state = get();
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];
    const slaDays = state.slaConfig[category] ?? 45;
    const expDate = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const seqNum = state.complaints.length + 101;
    const caseId = `AICTE/${assignedBureau}/2026/${String(seqNum).padStart(5, '0')}`;

    const newComplaint: Complaint = {
      caseId,
      institutionId,
      submittedInstitutionName: submittedInstitutionName || undefined,
      receivedDate: todayDate,
      source,
      complainantName,
      complainantContact,
      category,
      description,
      priority,
      status: 'Received',
      currentBureau: assignedBureau,
      originBureau: assignedBureau,
      assignedOfficer: state.currentUser.name,
      lastAction: 'Complaint registered via Single-Window Portal and routed to Bureau',
      lastActionDate: todayDate,
      nextActionRequired: 'Conduct initial scrutiny and issue notice to institution',
      expectedDisposalDate: expDate,
      slaDays,
      linkedCaseIds: [],
      attachments: [
        {
          name: 'Complainant_Representation.pdf',
          size: '420 KB',
          uploadedAt: todayDate,
          type: 'application/pdf',
        },
      ],
    };

    const initialHistory: ActionHistory = {
      id: `ACT-${caseId}-1`,
      caseId,
      timestamp: nowIso,
      actionType: 'Received',
      fromBureau: assignedBureau,
      officer: state.currentUser.name,
      remarks: `Registered new complaint under ${category} (${priority} priority).`,
      documents: ['Complainant_Representation.pdf'],
    };

    const nextComplaints = [newComplaint, ...state.complaints];
    const nextGroups = detectAllOverlaps(nextComplaints, state.institutions, state.overlapGroups);

    // Tag overlapGroupId if new case triggered an overlap
    const matchedGroup = nextGroups.find((g) => g.caseIds.includes(caseId));
    if (matchedGroup) {
      newComplaint.overlapGroupId = matchedGroup.id;
    }

    const nextAlerts = [...state.alerts];
    if (matchedGroup) {
      const inst = state.institutions.find((i) => i.aicteId === institutionId);
      nextAlerts.unshift({
        id: `ALT-NEW-OVL-${Date.now()}`,
        type: 'Overlap',
        caseId,
        institutionId,
        overlapGroupId: matchedGroup.id,
        targetBureau: assignedBureau,
        region: inst?.region,
        severity: 'High',
        message: `New case ${caseId} triggered overlap group ${matchedGroup.id} with ${matchedGroup.bureausInvolved.join(', ')}.`,
        createdAt: nowIso,
        read: false,
      });
    }

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: nowIso,
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'CASE_CREATED',
      targetId: caseId,
      details: `Created complaint ${caseId} for institution ${institutionId} (${category}).`,
    };

    set({
      complaints: nextComplaints,
      actionHistories: {
        ...state.actionHistories,
        [caseId]: [initialHistory],
      },
      overlapGroups: nextGroups,
      alerts: nextAlerts,
      auditLogs: [newAudit, ...state.auditLogs],
      createComplaintModalOpen: false,
    });

    saveToStorage(get());
    get().addToast(
      `Complaint Registered: ${caseId}`,
      matchedGroup
        ? `Flagged in Overlap Group ${matchedGroup.id} (${matchedGroup.overlapScore}% match)`
        : `Assigned to ${assignedBureau}`,
      matchedGroup ? 'warning' : 'success'
    );

    return caseId;
  },

  linkCases: (caseIds, reason) => {
    if (caseIds.length < 2) return;
    const state = get();
    const nowIso = new Date().toISOString();

    const updatedComplaints = state.complaints.map((c) => {
      if (!caseIds.includes(c.caseId)) return c;
      const others = caseIds.filter((id) => id !== c.caseId);
      const mergedLinks = Array.from(new Set([...c.linkedCaseIds, ...others]));
      return {
        ...c,
        linkedCaseIds: mergedLinks,
      };
    });

    const updatedHistories = { ...state.actionHistories };
    for (const cid of caseIds) {
      const target = state.complaints.find((c) => c.caseId === cid);
      if (!target) continue;
      const list = updatedHistories[cid] ?? [];
      updatedHistories[cid] = [
        ...list,
        {
          id: `ACT-LNK-${cid}-${Date.now()}`,
          caseId: cid,
          timestamp: nowIso,
          actionType: 'Linked',
          fromBureau: target.currentBureau,
          officer: state.currentUser.name,
          remarks: `Linked with related case(s) [${caseIds.filter((x) => x !== cid).join(', ')}]: ${reason}`,
          documents: [],
        },
      ];
    }

    const updatedGroups = detectAllOverlaps(
      updatedComplaints,
      state.institutions,
      state.overlapGroups
    );

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: nowIso,
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'CASES_LINKED',
      targetId: caseIds.join(','),
      details: `Linked cases [${caseIds.join(', ')}] – Reason: ${reason}`,
    };

    set({
      complaints: updatedComplaints,
      actionHistories: updatedHistories,
      overlapGroups: updatedGroups,
      auditLogs: [newAudit, ...state.auditLogs],
    });

    saveToStorage(get());
    get().addToast('Cases Linked', `Linked ${caseIds.length} related cases.`, 'success');
  },

  unlinkCase: (caseIdA, caseIdB) => {
    const state = get();
    const updatedComplaints = state.complaints.map((c) => {
      if (c.caseId === caseIdA) {
        return { ...c, linkedCaseIds: c.linkedCaseIds.filter((id) => id !== caseIdB) };
      }
      if (c.caseId === caseIdB) {
        return { ...c, linkedCaseIds: c.linkedCaseIds.filter((id) => id !== caseIdA) };
      }
      return c;
    });

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'CASES_UNLINKED',
      targetId: `${caseIdA},${caseIdB}`,
      details: `Unlinked ${caseIdA} and ${caseIdB}`,
    };

    set({
      complaints: updatedComplaints,
      auditLogs: [newAudit, ...state.auditLogs],
    });
    saveToStorage(get());
    get().addToast('Cases Unlinked', `Removed link between ${caseIdA} and ${caseIdB}.`, 'info');
  },

  rescanOverlaps: () => {
    const state = get();
    const updatedGroups = detectAllOverlaps(
      state.complaints,
      state.institutions,
      state.overlapGroups
    );
    const activeCount = updatedGroups.filter(
      (g) => g.status !== 'Dismissed as false positive' && !g.status.startsWith('Resolved')
    ).length;

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'MANUAL_OVERLAP_RESCAN',
      targetId: 'GLOBAL',
      details: `Executed 3-layer overlap engine rescan; ${activeCount} active overlap groups verified.`,
    };

    set({
      overlapGroups: updatedGroups,
      auditLogs: [newAudit, ...state.auditLogs],
    });
    saveToStorage(get());
    get().addToast(
      'Overlap Scan Complete',
      `Verified ${activeCount} active overlap groups across ${state.institutions.length} institutions.`,
      'success'
    );
    return activeCount;
  },

  initiateCoordination: (groupId, note) => {
    const state = get();
    const group = state.overlapGroups.find((g) => g.id === groupId);
    if (!group) return;

    const nowIso = new Date().toISOString();
    const message =
      note?.trim() ||
      `Cross-bureau coordination initiated by ${state.currentUser.name} (${state.currentUser.bureau}). All involved bureaus (${group.bureausInvolved.join(', ')}) are requested to align inspection and show-cause actions.`;

    const updatedGroups = state.overlapGroups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        status: 'Coordination Initiated' as const,
        coordinationNotes: [
          ...g.coordinationNotes,
          {
            id: `CN-${Date.now()}`,
            author: state.currentUser.name,
            bureau: state.currentUser.bureau === 'HQ' ? 'RB' : state.currentUser.bureau,
            timestamp: nowIso,
            message,
          },
        ],
      };
    });

    const inst = state.institutions.find((i) => i.aicteId === group.institutionId);
    const newAlerts: Alert[] = group.bureausInvolved.map((b, idx) => ({
      id: `ALT-COORD-${Date.now()}-${idx}`,
      type: 'Overlap',
      overlapGroupId: groupId,
      institutionId: group.institutionId,
      caseId: group.caseIds[0],
      targetBureau: b,
      region: inst?.region,
      severity: 'High',
      message: `Coordination initiated on Overlap Group ${groupId} (${inst?.name}) by ${state.currentUser.name}.`,
      createdAt: nowIso,
      read: false,
    }));

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: nowIso,
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'COORDINATION_INITIATED',
      targetId: groupId,
      details: `Initiated coordination across [${group.bureausInvolved.join(', ')}] for ${groupId}.`,
    };

    set({
      overlapGroups: updatedGroups,
      alerts: [...newAlerts, ...state.alerts],
      auditLogs: [newAudit, ...state.auditLogs],
    });
    saveToStorage(get());
    get().addToast(
      'Coordination Initiated',
      `Notified ${group.bureausInvolved.join(', ')} on group ${groupId}.`,
      'success'
    );
  },

  assignLeadBureau: (groupId, leadBureau, note) => {
    const state = get();
    const group = state.overlapGroups.find((g) => g.id === groupId);
    if (!group) return;

    const nowIso = new Date().toISOString();
    const message =
      note?.trim() ||
      `Designated ${leadBureau} as Lead Bureau for unified action on [${group.caseIds.join(', ')}]. Sister bureaus will share findings with ${leadBureau}.`;

    const updatedGroups = state.overlapGroups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        status: 'Resolved – Lead Bureau Assigned' as const,
        leadBureau,
        resolvedBy: state.currentUser.name,
        coordinationNotes: [
          ...g.coordinationNotes,
          {
            id: `CN-${Date.now()}`,
            author: state.currentUser.name,
            bureau: state.currentUser.bureau === 'HQ' ? leadBureau : state.currentUser.bureau,
            timestamp: nowIso,
            message,
          },
        ],
      };
    });

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: nowIso,
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'LEAD_BUREAU_ASSIGNED',
      targetId: groupId,
      details: `Assigned ${leadBureau} as Lead Bureau for Overlap Group ${groupId}.`,
    };

    set({
      overlapGroups: updatedGroups,
      auditLogs: [newAudit, ...state.auditLogs],
    });
    saveToStorage(get());
    get().addToast('Lead Bureau Assigned', `${leadBureau} assigned to lead ${groupId}.`, 'success');
  },

  mergeOverlapCases: (groupId, primaryCaseId, note) => {
    const state = get();
    const group = state.overlapGroups.find((g) => g.id === groupId);
    if (!group) return;

    const nowIso = new Date().toISOString();
    const message =
      note?.trim() ||
      `Merged overlapping cases [${group.caseIds.join(', ')}] under Lead File ${primaryCaseId}.`;

    // Link all cases in the group
    get().linkCases(group.caseIds, message);

    const primaryCase = state.complaints.find((c) => c.caseId === primaryCaseId);
    const updatedGroups = get().overlapGroups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        status: 'Resolved – Merged' as const,
        leadBureau: primaryCase?.currentBureau ?? g.bureausInvolved[0],
        resolvedBy: state.currentUser.name,
        coordinationNotes: [
          ...g.coordinationNotes,
          {
            id: `CN-${Date.now()}`,
            author: state.currentUser.name,
            bureau: state.currentUser.bureau === 'HQ' ? 'RB' : state.currentUser.bureau,
            timestamp: nowIso,
            message,
          },
        ],
      };
    });

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: nowIso,
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'OVERLAP_RESOLVED_MERGED',
      targetId: groupId,
      details: `Merged cases in ${groupId} into primary case ${primaryCaseId}.`,
    };

    set((s) => ({
      overlapGroups: updatedGroups,
      auditLogs: [newAudit, ...s.auditLogs],
    }));
    saveToStorage(get());
    get().addToast('Cases Merged & Resolved', `Group ${groupId} resolved under ${primaryCaseId}.`, 'success');
  },

  dismissOverlapAsFalsePositive: (groupId, reason) => {
    const state = get();
    const group = state.overlapGroups.find((g) => g.id === groupId);
    if (!group) return;

    const nowIso = new Date().toISOString();
    const updatedGroups = state.overlapGroups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        status: 'Dismissed as false positive' as const,
        dismissReason: reason,
        resolvedBy: state.currentUser.name,
        coordinationNotes: [
          ...g.coordinationNotes,
          {
            id: `CN-${Date.now()}`,
            author: state.currentUser.name,
            bureau: state.currentUser.bureau === 'HQ' ? 'PGRC' : state.currentUser.bureau,
            timestamp: nowIso,
            message: `Dismissed as false positive: ${reason}`,
          },
        ],
      };
    });

    // Clear overlapGroupId from those complaints if they were only in this dismissed group
    const updatedComplaints = state.complaints.map((c) => {
      if (c.overlapGroupId === groupId) {
        return { ...c, overlapGroupId: undefined };
      }
      return c;
    });

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: nowIso,
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'OVERLAP_DISMISSED_FALSE_POSITIVE',
      targetId: groupId,
      details: `Dismissed overlap group ${groupId} as false positive – Reason: ${reason}`,
    };

    set({
      overlapGroups: updatedGroups,
      complaints: updatedComplaints,
      auditLogs: [newAudit, ...state.auditLogs],
    });
    saveToStorage(get());
    get().addToast(
      'Overlap Dismissed',
      `Group ${groupId} marked as false positive and suppressed from future rescans.`,
      'info'
    );
  },

  addCoordinationNote: (groupId, message) => {
    if (!message.trim()) return;
    const state = get();
    const nowIso = new Date().toISOString();
    const updatedGroups = state.overlapGroups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        coordinationNotes: [
          ...g.coordinationNotes,
          {
            id: `CN-${Date.now()}`,
            author: state.currentUser.name,
            bureau: state.currentUser.bureau === 'HQ' ? 'RB' : state.currentUser.bureau,
            timestamp: nowIso,
            message: message.trim(),
          },
        ],
      };
    });

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: nowIso,
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'COORDINATION_NOTE_ADDED',
      targetId: groupId,
      details: `Added coordination note on ${groupId}: "${message.trim().slice(0, 80)}"`,
    };

    set({
      overlapGroups: updatedGroups,
      auditLogs: [newAudit, ...state.auditLogs],
    });
    saveToStorage(get());
  },

  markAlertRead: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === alertId ? { ...a, read: true } : a)),
    })),

  markAllAlertsRead: () =>
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, read: true })),
    })),

  snoozeAlert: (alertId, hours) => {
    const snoozedUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === alertId ? { ...a, read: true, snoozedUntil } : a
      ),
    }));
    get().addToast('Alert Snoozed', `Snoozed for ${hours} hours.`, 'info');
  },

  updateSLAConfig: (newConfig) => {
    const state = get();
    const nowIso = new Date().toISOString();
    const NOW_MS = new Date('2026-10-24T12:00:00Z').getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Recalculate expectedDisposalDate and slaDays on all complaints based on new SLA config
    const updatedComplaints = state.complaints.map((c) => {
      const newSla = newConfig[c.category] ?? c.slaDays;
      const rcvMs = new Date(c.receivedDate).getTime();
      const newExpDate = new Date(rcvMs + newSla * DAY_MS).toISOString().split('T')[0];
      return {
        ...c,
        slaDays: newSla,
        expectedDisposalDate: newExpDate,
      };
    });

    // Generate SLA alert if newly overdue
    const newlyOverdue = updatedComplaints.filter(
      (c) => c.status !== 'Disposed' && new Date(c.expectedDisposalDate).getTime() < NOW_MS
    );

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: nowIso,
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'SLA_RULES_UPDATED',
      targetId: 'SLA_CONFIG',
      details: `Updated category SLA days configuration. Recomputed SLA deadlines across ${updatedComplaints.length} cases (${newlyOverdue.length} currently overdue).`,
    };

    set({
      slaConfig: newConfig,
      complaints: updatedComplaints,
      auditLogs: [newAudit, ...state.auditLogs],
    });
    saveToStorage(get());
    get().addToast(
      'SLA Configuration Updated',
      `Recalculated deadlines across all ${updatedComplaints.length} cases (${newlyOverdue.length} overdue).`,
      'success'
    );
  },

  updateNotificationSettings: (partial) => {
    set((state) => ({
      notificationSettings: { ...state.notificationSettings, ...partial },
    }));
    get().addToast('Notification Preferences Saved', 'Updated delivery channels.', 'success');
  },

  importInstitutionsAndCases: (newInstitutions, newComplaints) => {
    const state = get();
    const mergedInsts = [...newInstitutions, ...state.institutions];
    const mergedCases = [...newComplaints, ...state.complaints];
    const nextGroups = detectAllOverlaps(mergedCases, mergedInsts, state.overlapGroups);

    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'BULK_CSV_IMPORT',
      targetId: 'DATA_IMPORT',
      details: `Imported ${newInstitutions.length} institutions and ${newComplaints.length} complaints via CSV Import.`,
    };

    set({
      institutions: mergedInsts,
      complaints: mergedCases,
      overlapGroups: nextGroups,
      auditLogs: [newAudit, ...state.auditLogs],
    });
    saveToStorage(get());
    get().addToast(
      'CSV Data Imported',
      `Added ${newInstitutions.length} institutions and ${newComplaints.length} cases.`,
      'success'
    );
  },

  logSensitiveCaseView: (caseId) => {
    const state = get();
    // Avoid spamming duplicate view logs for the same case in a row
    if (state.auditLogs[0]?.targetId === caseId && state.auditLogs[0]?.action === 'SENSITIVE_CASE_VIEWED') {
      return;
    }
    const newAudit: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: state.currentUser.name,
      role: state.currentUser.roleType,
      bureau: state.currentUser.bureau,
      action: 'SENSITIVE_CASE_VIEWED',
      targetId: caseId,
      details: `Accessed case dossier ${caseId} (PII Masking: ${state.currentUser.canViewUnmaskedPII ? 'Unmasked/Authorized' : 'Masked'}).`,
    };
    set((s) => ({ auditLogs: [newAudit, ...s.auditLogs] }));
  },

  resetDemoData: () => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = generateSeedDatabase();
    set({
      institutions: fresh.institutions,
      complaints: fresh.complaints,
      actionHistories: fresh.actionHistories,
      overlapGroups: fresh.overlapGroups,
      alerts: fresh.alerts,
      auditLogs: fresh.auditLogs,
      slaConfig: fresh.slaConfig,
      currentUser: DEMO_USERS[0],
      globalFilters: { region: 'ALL', bureau: 'ALL', dateRange: 'ALL' },
      caseFilters: { ...DEFAULT_CASE_FILTERS },
    });
    get().addToast('Demo Data Reset', 'Restored all 60 institutions, 400 cases, and 14 overlap scenarios.', 'info');
  },
}));
