import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Sparkles,
  Send,
  ArrowRightLeft,
  Flame,
  CheckCircle2,
  RotateCcw,
  Link2,
  FileText,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  getSLAInfo,
  canUserEditCase,
  maskComplainantName,
  maskContact,
} from '../utils/helpers';
import { generateCaseSummaryAPI } from '../services/api';
import { ActionType, Bureau, CaseStatus } from '../types';

const BUREAUS: Bureau[] = [
  'PGRC',
  'RB',
  'AB',
  'Legal Cell',
  'Vigilance Cell',
  'Academic Bureau',
  'Northern RO',
  'Southern RO',
  'Eastern RO',
  'Western RO',
  'Central RO',
  'South-Western RO',
  'North-Western RO',
];

export const CaseDetail: React.FC = () => {
  const { caseId: rawCaseId } = useParams<{ caseId: string }>();
  const caseId = decodeURIComponent(rawCaseId ?? '');
  const navigate = useNavigate();

  const {
    complaints,
    institutions,
    actionHistories,
    overlapGroups,
    auditLogs,
    currentUser,
    performCaseAction,
    linkCases,
    unlinkCase,
    logSensitiveCaseView,
  } = useAppStore();

  const complaint = useMemo(
    () => complaints.find((c) => c.caseId === caseId),
    [complaints, caseId]
  );

  const institution = useMemo(
    () => institutions.find((i) => i.aicteId === complaint?.institutionId),
    [institutions, complaint]
  );

  const history = useMemo(
    () => actionHistories[caseId] ?? [],
    [actionHistories, caseId]
  );

  const overlapGroup = useMemo(
    () =>
      overlapGroups.find(
        (g) => g.caseIds.includes(caseId) && g.status !== 'Dismissed as false positive'
      ),
    [overlapGroups, caseId]
  );

  const [activeTab, setActiveTab] = useState<
    'overview' | 'timeline' | 'documents' | 'linked' | 'overlap' | 'audit'
  >('overview');

  // Action modal state
  const [actionModal, setActionModal] = useState<
    null | 'REMARK' | 'TRANSFER' | 'ESCALATE' | 'PENDING_INFO' | 'DISPOSE' | 'REOPEN' | 'LINK'
  >(null);
  const [remarkType, setRemarkType] = useState<ActionType>('Remark');
  const [targetBureau, setTargetBureau] = useState<Bureau>('RB');
  const [actionRemarks, setActionRemarks] = useState('');
  const [nextActionText, setNextActionText] = useState('');
  const [docName, setDocName] = useState('');
  const [selectedLinkCaseId, setSelectedLinkCaseId] = useState('');

  // AI Case Summary state
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<{
    bullets: string[];
    recommendedNextStep: string;
    usedAI: boolean;
  } | null>(null);

  useEffect(() => {
    if (complaint) {
      logSensitiveCaseView(complaint.caseId);
    }
  }, [complaint?.caseId]);

  if (!complaint) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <div className="text-base font-bold text-slate-900">Case Not Found ({caseId})</div>
        <button
          type="button"
          onClick={() => navigate('/cases')}
          className="px-4 py-2 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg cursor-pointer"
        >
          Back to Case Register
        </button>
      </div>
    );
  }

  const sla = getSLAInfo(complaint);
  const canEdit = canUserEditCase(currentUser, complaint);

  // Build Transfer Journey stages (e.g., Portal -> PGRC -> RB)
  const transferJourney = useMemo(() => {
    const steps: string[] = [`Source: ${complaint.source}`, complaint.originBureau];
    for (const h of history) {
      if (h.actionType === 'Transferred' && h.toBureau && steps[steps.length - 1] !== h.toBureau) {
        steps.push(h.toBureau);
      }
    }
    if (steps[steps.length - 1] !== complaint.currentBureau) {
      steps.push(complaint.currentBureau);
    }
    if (complaint.status === 'Escalated') {
      steps.push('Standing Hearing Committee (SHC)');
    }
    return steps;
  }, [complaint, history]);

  // Likely related cases on the same institution
  const relatedInstitutionCases = useMemo(() => {
    return complaints.filter(
      (c) => c.institutionId === complaint.institutionId && c.caseId !== complaint.caseId
    );
  }, [complaints, complaint]);

  const caseAuditLogs = useMemo(() => {
    return auditLogs.filter(
      (a) =>
        a.targetId.includes(complaint.caseId) ||
        (overlapGroup && a.targetId === overlapGroup.id)
    );
  }, [auditLogs, complaint.caseId, overlapGroup]);

  const handleGenerateSummary = async () => {
    setAiSummaryLoading(true);
    try {
      const res = await generateCaseSummaryAPI(
        complaint,
        history.map((h) => `${h.timestamp.split('T')[0]} [${h.fromBureau} - ${h.actionType}]: ${h.remarks}`)
      );
      setAiSummary(res);
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleSubmitAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionRemarks.trim() && actionModal !== 'LINK') return;

    if (actionModal === 'LINK') {
      if (!selectedLinkCaseId) return;
      linkCases(
        [complaint.caseId, selectedLinkCaseId],
        actionRemarks.trim() || 'Linked related institutional case'
      );
      setActionModal(null);
      setActionRemarks('');
      return;
    }

    let actionType: ActionType = 'Remark';
    let newStatus: CaseStatus | undefined;
    let toBureau: Bureau | undefined;

    if (actionModal === 'REMARK') {
      actionType = remarkType;
      if (complaint.status === 'Received') newStatus = 'Under Process';
    } else if (actionModal === 'TRANSFER') {
      actionType = 'Transferred';
      newStatus = 'Transferred';
      toBureau = targetBureau;
    } else if (actionModal === 'ESCALATE') {
      actionType = 'Escalated';
      newStatus = 'Escalated';
    } else if (actionModal === 'PENDING_INFO') {
      actionType = 'Remark';
      newStatus = 'Pending Information';
    } else if (actionModal === 'DISPOSE') {
      actionType = 'Disposed';
      newStatus = 'Disposed';
    } else if (actionModal === 'REOPEN') {
      actionType = 'Reopened';
      newStatus = 'Reopened';
    }

    performCaseAction({
      caseId: complaint.caseId,
      actionType,
      newStatus,
      toBureau,
      remarks: actionRemarks.trim(),
      nextActionRequired: nextActionText.trim() || undefined,
      documentName: docName.trim() || undefined,
    });

    setActionModal(null);
    setActionRemarks('');
    setNextActionText('');
    setDocName('');
  };

  return (
    <div className="space-y-5">
      {/* Top Back & Overlap Alert Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/cases')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0B3D91] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Case Register</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateSummary}
            disabled={aiSummaryLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B3D91] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{aiSummaryLoading ? 'Summarizing Dossier...' : 'Generate 5-Point Case Summary'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/institutions/${complaint.institutionId}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Institution 360° Profile</span>
          </button>
        </div>
      </div>

      {/* Overlap Warning Banner if Case is part of an Active Overlap Group */}
      {overlapGroup && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                ⚠ Potential Overlapping Cases – Coordination Required ({overlapGroup.id})
              </span>
            </div>
            <p className="text-xs text-amber-900">
              This complaint overlaps with{' '}
              <strong>{overlapGroup.caseIds.filter((id) => id !== complaint.caseId).join(', ')}</strong>{' '}
              across Bureaus: <strong>{overlapGroup.bureausInvolved.join(' + ')}</strong> (Similarity Score:{' '}
              <span className="font-mono-tabular font-bold">{overlapGroup.overlapScore}%</span>).
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/overlaps?group=${overlapGroup.id}`)}
            className="px-3.5 py-2 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg hover:bg-[#082B68] shrink-0 cursor-pointer"
          >
            Compare & Coordinate ({overlapGroup.caseIds.length} Cases)
          </button>
        </div>
      )}

      {/* AI Case Summary Panel (when generated) */}
      {aiSummary && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0B3D91]">
              <Sparkles className="w-4 h-4 text-[#FF9933]" />
              <span>Executive Case Summary (PII Redacted)</span>
            </div>
            <span className="text-[11px] text-slate-500">
              {aiSummary.usedAI ? 'Generated via Gemini AI' : 'Generated via Rule-Based Summary Engine'}
            </span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700">
            {aiSummary.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-900">
            Recommended Next Regulatory Step:{' '}
            <span className="text-[#0B3D91]">{aiSummary.recommendedNextStep}</span>
          </div>
        </div>
      )}

      {/* Main Case Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono-tabular font-bold text-base text-slate-900">
                {complaint.caseId}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#0B3D91]">
                Assigned Bureau: {complaint.currentBureau}
              </span>
              <span aria-hidden="true">·</span>
              <span>Officer: {complaint.assignedOfficer}</span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {complaint.category} — {institution?.name ?? complaint.institutionId}
            </h2>

            {complaint.submittedInstitutionName &&
              institution &&
              complaint.submittedInstitutionName !== institution.name && (
                <div className="text-xs text-amber-800">
                  Submitted under name variant: &ldquo;{complaint.submittedInstitutionName}&rdquo; → Auto-resolved to AICTE ID{' '}
                  <span className="font-mono-tabular font-semibold">{complaint.institutionId}</span>
                </div>
              )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Status: </span>
              <strong className="text-slate-900">{complaint.status}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Priority: </span>
              <strong
                className={
                  complaint.priority === 'Critical'
                    ? 'text-red-700'
                    : complaint.priority === 'High'
                    ? 'text-orange-700'
                    : 'text-slate-900'
                }
              >
                {complaint.priority}
              </strong>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono-tabular">
              <span className="text-slate-500">SLA: </span>
              <strong
                className={
                  sla.state === 'OVERDUE'
                    ? 'text-red-700'
                    : sla.state === 'DUE_SOON'
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }
              >
                {sla.label}
              </strong>
            </div>
          </div>
        </div>

        {/* Transfer Journey Mini-Diagram */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600">Transfer & Routing Journey:</span>
          {transferJourney.map((stage, idx) => (
            <React.Fragment key={idx}>
              <span
                className={`px-2.5 py-1 rounded-md font-medium ${
                  idx === transferJourney.length - 1
                    ? 'bg-[#0B3D91] text-white font-semibold'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {stage}
              </span>
              {idx < transferJourney.length - 1 && (
                <span className="text-slate-400 font-bold">→</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Permission-Based Action Toolbar */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActionModal('REMARK')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg hover:bg-[#082B68] cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Add Action / Remark</span>
              </button>

              <button
                type="button"
                onClick={() => setActionModal('TRANSFER')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transfer to Bureau</span>
              </button>

              <button
                type="button"
                onClick={() => setActionModal('ESCALATE')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Escalate</span>
              </button>

              <button
                type="button"
                onClick={() => setActionModal('PENDING_INFO')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Mark Pending Info</span>
              </button>

              {complaint.status !== 'Disposed' ? (
                <button
                  type="button"
                  onClick={() => setActionModal('DISPOSE')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Dispose Case</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActionModal('REOPEN')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-800 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen Case</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActionModal('LINK')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Link Related Case</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Read-Only Access: Your role ({currentUser.name} · {currentUser.bureau}) can inspect this{' '}
                <strong>{complaint.currentBureau}</strong> case but cannot modify it. Switch to{' '}
                <strong>{complaint.currentBureau} Officer</strong> or <strong>Super Admin</strong> to execute case actions.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 6 Navigation Tabs */}
      <div className="border-b border-slate-200 flex flex-wrap gap-1">
        {[
          { id: 'overview', label: 'Overview & Dossier' },
          { id: 'timeline', label: `Action Timeline (${history.length})` },
          { id: 'documents', label: `Documents (${complaint.attachments.length})` },
          { id: 'linked', label: `Linked & Related Cases (${complaint.linkedCaseIds.length})` },
          { id: 'overlap', label: `Overlap Analysis ${overlapGroup ? '⚠' : ''}` },
          { id: 'audit', label: `Audit Trail (${caseAuditLogs.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#0B3D91] text-[#0B3D91] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Grievance Description & Core Particulars</h3>
            <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200">
              {complaint.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-200 space-y-1">
                <div className="text-slate-500 font-medium">Latest Recorded Action ({complaint.lastActionDate})</div>
                <div className="font-semibold text-slate-900">{complaint.lastAction}</div>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 space-y-1">
                <div className="text-slate-500 font-medium">Next Action Required</div>
                <div className="font-semibold text-[#0B3D91]">{complaint.nextActionRequired}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Metadata & Governance</h3>
            <div className="divide-y divide-slate-100 space-y-2">
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">AICTE Permanent ID:</span>
                <span className="font-mono-tabular font-semibold">{complaint.institutionId}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Region & State:</span>
                <span className="font-semibold">
                  {institution?.region} ({institution?.state})
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Receipt Date:</span>
                <span className="font-mono-tabular">{complaint.receivedDate}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Expected Disposal Date:</span>
                <span className="font-mono-tabular font-semibold">{complaint.expectedDisposalDate}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Configured SLA Window:</span>
                <span className="font-mono-tabular">{complaint.slaDays} Days</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Complainant Name:</span>
                <span className="font-semibold">
                  {maskComplainantName(complaint.complainantName, currentUser.canViewUnmaskedPII)}
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Complainant Contact:</span>
                <span className="font-mono-tabular">
                  {maskContact(complaint.complainantContact, currentUser.canViewUnmaskedPII)}
                </span>
              </div>
            </div>
            {!currentUser.canViewUnmaskedPII && (
              <div className="p-2.5 rounded bg-slate-100 text-[11px] text-slate-600 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Complainant PII is masked for your role per AICTE governance policy.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Immutable Chronological Action History
              </h3>
              <p className="text-xs text-slate-500">
                Append-only regulatory ledger. Past entries cannot be edited or deleted.
              </p>
            </div>
          </div>

          <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
            {history.map((item) => (
              <div key={item.id} className="relative">
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 border-white absolute -left-[31px] top-1 ${
                    item.actionType === 'Escalated'
                      ? 'bg-red-600'
                      : item.actionType === 'Transferred'
                      ? 'bg-purple-600'
                      : item.actionType === 'Disposed'
                      ? 'bg-emerald-600'
                      : 'bg-[#0B3D91]'
                  }`}
                />
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-bold text-slate-900">
                      {item.actionType}
                      {item.toBureau && item.toBureau !== item.fromBureau
                        ? ` (${item.fromBureau} → ${item.toBureau})`
                        : ` (${item.fromBureau})`}
                    </div>
                    <span className="font-mono-tabular text-slate-500">
                      {item.timestamp.replace('T', ' ').slice(0, 16)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800">{item.remarks}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                    <span>Recorded by: {item.officer}</span>
                    {item.documents.length > 0 && (
                      <span className="font-mono-tabular text-[#0B3D91] font-medium">
                        Attachments: {item.documents.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Case Annexures & Evidentiary Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {complaint.attachments.map((doc, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#0B3D91]" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{doc.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono-tabular">
                      {doc.size} · Uploaded {doc.uploadedAt}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#0B3D91]">Verified PDF</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'linked' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Explicitly Linked Cases</h3>
            {complaint.linkedCaseIds.length === 0 ? (
              <p className="text-xs text-slate-500 mt-1">
                No explicitly linked cases yet. See suggested related cases for {institution?.name} below.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {complaint.linkedCaseIds.map((lid) => {
                  const linked = complaints.find((c) => c.caseId === lid);
                  return (
                    <div
                      key={lid}
                      className="p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <button
                          type="button"
                          onClick={() => navigate(`/cases/${encodeURIComponent(lid)}`)}
                          className="font-mono-tabular font-bold text-[#0B3D91] hover:underline cursor-pointer"
                        >
                          {lid}
                        </button>
                        {linked && (
                          <span className="ml-2 text-slate-700">
                            {linked.currentBureau} · {linked.category} · {linked.status}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => unlinkCase(complaint.caseId, lid)}
                        className="text-red-700 hover:underline font-medium cursor-pointer"
                      >
                        Unlink
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Other Cases on {institution?.name} ({relatedInstitutionCases.length})
            </h4>
            <div className="space-y-2">
              {relatedInstitutionCases.map((rc) => {
                const alreadyLinked = complaint.linkedCaseIds.includes(rc.caseId);
                return (
                  <div
                    key={rc.caseId}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => navigate(`/cases/${encodeURIComponent(rc.caseId)}`)}
                        className="font-mono-tabular font-bold text-[#0B3D91] hover:underline cursor-pointer"
                      >
                        {rc.caseId}
                      </button>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <span className="font-semibold">{rc.currentBureau}</span>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <span>{rc.category}</span>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <span className="text-slate-600">{rc.status}</span>
                    </div>
                    {!alreadyLinked && (
                      <button
                        type="button"
                        onClick={() =>
                          linkCases(
                            [complaint.caseId, rc.caseId],
                            'Linked from Case Detail Related Cases tab'
                          )
                        }
                        className="px-2.5 py-1 rounded bg-[#0B3D91] text-white font-semibold cursor-pointer"
                      >
                        Link Case
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overlap' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          {overlapGroup ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Active Overlap Group: {overlapGroup.id} (Score: {overlapGroup.overlapScore}%)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Bureaus Involved: {overlapGroup.bureausInvolved.join(', ')} · Status:{' '}
                    <strong>{overlapGroup.status}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/overlaps?group=${overlapGroup.id}`)}
                  className="px-3.5 py-2 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg cursor-pointer"
                >
                  Open Side-by-Side Comparison →
                </button>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1.5">
                  Why was this flagged by the 3-Layer Overlap Engine?
                </div>
                <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
                  {overlapGroup.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-600">
              This case is not currently part of an active unresolved overlap group.
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Immutable Case Audit Log</h3>
          <div className="divide-y divide-slate-200 text-xs">
            {caseAuditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between gap-4">
                <div>
                  <span className="font-mono-tabular font-semibold text-[#0B3D91]">
                    {log.action}
                  </span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="font-semibold text-slate-800">{log.user}</span>
                  <p className="text-slate-600 mt-0.5">{log.details}</p>
                </div>
                <span className="font-mono-tabular text-slate-500 shrink-0">
                  {log.timestamp.replace('T', ' ').slice(0, 19)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Dialog Modal */}
      {actionModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSubmitAction}
            className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl"
          >
            <h3 className="text-base font-bold text-slate-900">
              {actionModal === 'REMARK' && 'Record Regulatory Action / Officer Remark'}
              {actionModal === 'TRANSFER' && 'Transfer Case to Another Bureau / Cell'}
              {actionModal === 'ESCALATE' && 'Escalate Case to Standing Hearing Committee'}
              {actionModal === 'PENDING_INFO' && 'Mark Case as Pending Institutional Information'}
              {actionModal === 'DISPOSE' && 'Dispose Case (Final Speaking Order)'}
              {actionModal === 'REOPEN' && 'Reopen Disposed Case'}
              {actionModal === 'LINK' && 'Link Related Case'}
            </h3>

            {actionModal === 'REMARK' && (
              <div>
                <label htmlFor="action-type-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Action Type
                </label>
                <select
                  id="action-type-select"
                  value={remarkType}
                  onChange={(e) => setRemarkType(e.target.value as ActionType)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Remark">General Officer Remark / File Noting</option>
                  <option value="Inspection ordered">Inspection Ordered (EVC / Surprise Visit)</option>
                  <option value="Show-cause notice">Show-Cause Notice Issued</option>
                  <option value="Reply received">Institutional Reply Received</option>
                </select>
              </div>
            )}

            {actionModal === 'TRANSFER' && (
              <div>
                <label htmlFor="transfer-bureau-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Bureau / Regional Office *
                </label>
                <select
                  id="transfer-bureau-select"
                  value={targetBureau}
                  onChange={(e) => setTargetBureau(e.target.value as Bureau)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {BUREAUS.filter((b) => b !== complaint.currentBureau).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {actionModal === 'LINK' && (
              <div>
                <label htmlFor="link-case-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Related Case to Link *
                </label>
                <select
                  id="link-case-select"
                  required
                  value={selectedLinkCaseId}
                  onChange={(e) => setSelectedLinkCaseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">-- Choose a related case --</option>
                  {relatedInstitutionCases.map((rc) => (
                    <option key={rc.caseId} value={rc.caseId}>
                      {rc.caseId} ({rc.currentBureau} – {rc.category})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="action-remarks-input" className="block text-xs font-semibold text-slate-700 mb-1">
                {actionModal === 'DISPOSE'
                  ? 'Final Speaking Disposal Order Summary *'
                  : actionModal === 'TRANSFER'
                  ? 'Mandatory Transfer Reason *'
                  : 'Official Remarks / Order Details *'}
              </label>
              <textarea
                id="action-remarks-input"
                rows={3}
                required
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                placeholder="Enter detailed regulatory noting..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            {actionModal !== 'DISPOSE' && actionModal !== 'LINK' && (
              <div>
                <label htmlFor="next-action-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Updated Next Action Required (Optional)
                </label>
                <input
                  id="next-action-input"
                  type="text"
                  value={nextActionText}
                  onChange={(e) => setNextActionText(e.target.value)}
                  placeholder="e.g. Await EVC inspection report within 10 days"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="px-3.5 py-1.5 text-xs font-medium bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg hover:bg-[#082B68] cursor-pointer"
              >
                Confirm & Record to Ledger
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
