import React, { useState } from 'react';
import {
  Settings,
  Shield,
  History,
  Upload,
  Save,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ComplaintCategory, SLAConfig, Institution, Complaint } from '../types';

export const AdminPage: React.FC = () => {
  const {
    slaConfig,
    updateSLAConfig,
    availableUsers,
    currentUser,
    switchUserRole,
    auditLogs,
    importInstitutionsAndCases,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'sla' | 'users' | 'audit' | 'import'>('sla');
  const [draftSla, setDraftSla] = useState<SLAConfig>({ ...slaConfig });
  const [auditSearch, setAuditSearch] = useState('');

  // CSV Import state
  const [csvPreviewReady, setCsvPreviewReady] = useState(false);

  const handleSaveSla = (e: React.FormEvent) => {
    e.preventDefault();
    updateSLAConfig(draftSla);
  };

  const filteredAuditLogs = auditLogs.filter((l) => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.user.toLowerCase().includes(q) ||
      l.targetId.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q)
    );
  });

  const handleSampleImport = () => {
    const newInst: Institution = {
      aicteId: '1-9988776655',
      name: 'Indraprastha Institute of Emerging Technologies & AI',
      aliases: ['IIETAI Delhi', 'Indraprastha Emerging Tech College'],
      type: 'Affiliated',
      programs: ['B.Tech AI', 'M.Tech'],
      address: 'Sector 18, Dwarka',
      city: 'New Delhi',
      district: 'South West Delhi',
      state: 'Delhi',
      pincode: '110075',
      region: 'North-Western',
      contact: '011-28009900',
      headOfInstitution: 'Dr. R.K. Malhotra',
      approvalStatus: 'Approved',
      riskScore: 62,
    };

    const newCase: Complaint = {
      caseId: `AICTE/PGRC/2026/00991`,
      institutionId: '1-9988776655',
      submittedInstitutionName: 'IIETAI Delhi',
      receivedDate: '2026-10-20',
      source: 'CPGRAMS',
      complainantName: 'Gaurav Khanna',
      complainantContact: '9810098100',
      category: 'Fee/Refund',
      description: 'Imported via Bulk CSV: Non-refund of admission cancellation deposit of ₹92,000.',
      priority: 'High',
      status: 'Received',
      currentBureau: 'PGRC',
      originBureau: 'PGRC',
      assignedOfficer: 'Smt. Meenakshi Iyer',
      lastAction: 'Imported via Admin CSV Batch Upload',
      lastActionDate: '2026-10-24',
      nextActionRequired: 'Issue initial notice to institution',
      expectedDisposalDate: '2026-11-19',
      slaDays: draftSla['Fee/Refund'],
      linkedCaseIds: [],
      attachments: [],
    };

    importInstitutionsAndCases([newInst], [newCase]);
    setCsvPreviewReady(false);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            System Administration & Governance Rules Engine
          </h2>
          <p className="text-xs text-slate-500">
            Configure statutory SLA timelines, inspect immutable audit trails, manage RBAC personas, and import CSV batches
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'sla', label: 'SLA & Rules Engine', icon: Settings },
            { id: 'users', label: 'Users & RBAC Matrix', icon: Shield },
            { id: 'audit', label: `Immutable Audit Log (${auditLogs.length})`, icon: History },
            { id: 'import', label: 'CSV Data Import', icon: Upload },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-[#0B3D91] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'sla' && (
        <form
          onSubmit={handleSaveSla}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Category-Wise Statutory SLA Days Configuration
              </h3>
              <p className="text-xs text-slate-500">
                Updating SLA days immediately recalculates Expected Disposal Dates and SLA Breach chips across all 400 complaints.
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg hover:bg-[#082B68] cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Recompute All SLAs</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.keys(draftSla) as ComplaintCategory[]).map((cat) => (
              <div
                key={cat}
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
              >
                <label htmlFor={`sla-${cat}`} className="text-xs font-semibold text-slate-800">
                  {cat}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id={`sla-${cat}`}
                    type="number"
                    min={5}
                    max={180}
                    value={draftSla[cat]}
                    onChange={(e) =>
                      setDraftSla({ ...draftSla, [cat]: Math.max(5, Number(e.target.value)) })
                    }
                    className="w-20 px-2.5 py-1 text-xs font-mono-tabular font-bold border border-slate-300 rounded bg-white text-right"
                  />
                  <span className="text-xs text-slate-500">days</span>
                </div>
              </div>
            ))}
          </div>
        </form>
      )}

      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-3 px-4">Official Name</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">Role Type</th>
                <th className="py-3 px-4">Bureau / Region Scope</th>
                <th className="py-3 px-4">PII Access</th>
                <th className="py-3 px-4 text-right">Simulate Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {availableUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                  <td className="py-3 px-4 text-slate-600">{u.designation}</td>
                  <td className="py-3 px-4 font-mono-tabular">{u.roleType}</td>
                  <td className="py-3 px-4">
                    {u.bureau} {u.region ? `(${u.region} Region)` : '(Global)'}
                  </td>
                  <td className="py-3 px-4">
                    {u.canViewUnmaskedPII ? 'Unmasked' : 'Masked PII'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {currentUser.id === u.id ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <UserCheck className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => switchUserRole(u.id)}
                        className="px-3 py-1 rounded bg-[#0B3D91] text-white font-semibold cursor-pointer"
                      >
                        Switch Role
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Immutable Append-Only Governance Audit Trail
              </h3>
              <p className="text-xs text-slate-500">
                Every case creation, status change, inter-bureau transfer, overlap resolution, and sensitive view is logged.
              </p>
            </div>
            <input
              type="search"
              aria-label="Search audit logs"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Filter by user, action, or Case ID..."
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg w-64"
            />
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[520px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Official User</th>
                  <th className="py-2.5 px-4">Bureau</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Target Entity</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono-tabular text-slate-500 whitespace-nowrap">
                      {log.timestamp.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{log.user}</td>
                    <td className="py-2.5 px-4">{log.bureau}</td>
                    <td className="py-2.5 px-4 font-mono-tabular font-bold text-[#0B3D91]">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 font-mono-tabular">{log.targetId}</td>
                    <td className="py-2.5 px-4 text-slate-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Bulk CSV Data Import (CPGRAMS / Legacy Bureau Sync)
          </h3>
          <p className="text-xs text-slate-600">
            Upload a CSV file of institutions and complaints, verify column mapping, and run automatic entity resolution & overlap detection upon import.
          </p>

          <div className="p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-center space-y-3">
            <div className="text-xs text-slate-600">
              Select a CSV file from your workstation or load a pre-validated CPGRAMS batch preview:
            </div>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setCsvPreviewReady(true)}
                className="px-4 py-2 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg cursor-pointer"
              >
                Load Sample CPGRAMS CSV Batch Preview
              </button>
            </div>
          </div>

          {csvPreviewReady && (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Column Mapping & Schema Validation Passed (0 Errors)</span>
                </div>
                <button
                  type="button"
                  onClick={handleSampleImport}
                  className="px-4 py-1.5 bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Confirm & Import Batch
                </button>
              </div>
              <div className="text-slate-600">
                Mapped Columns: <code className="font-mono-tabular">AICTE_ID → institutionId</code>,{' '}
                <code className="font-mono-tabular">INST_NAME → submittedInstitutionName</code>,{' '}
                <code className="font-mono-tabular">GRIEVANCE_CATEGORY → category</code>,{' '}
                <code className="font-mono-tabular">ASSIGNED_BUREAU → currentBureau</code>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
