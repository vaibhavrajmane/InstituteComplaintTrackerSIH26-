import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  GitCompareArrows,
  CheckCircle2,
  XCircle,
  Send,
  Sparkles,
  RefreshCw,
  Building2,
  ShieldCheck,
  Link2,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getSLAInfo } from '../utils/helpers';
import { evaluateSemanticSimilarityAPI } from '../services/api';
import { Bureau, Region } from '../types';

export const OverlapCenter: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    overlapGroups,
    complaints,
    institutions,
    currentUser,
    rescanOverlaps,
    initiateCoordination,
    assignLeadBureau,
    mergeOverlapCases,
    dismissOverlapAsFalsePositive,
    addCoordinationNote,
  } = useAppStore();

  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL' | 'RESOLVED' | 'DISMISSED'>('ACTIVE');
  const [regionFilter, setRegionFilter] = useState<Region | 'ALL'>('ALL');
  const [bureauFilter, setBureauFilter] = useState<Bureau | 'ALL'>('ALL');

  const instMap = useMemo(() => {
    const m = new Map<string, (typeof institutions)[0]>();
    for (const i of institutions) m.set(i.aicteId, i);
    return m;
  }, [institutions]);

  const effectiveRegion =
    currentUser.roleType === 'REGIONAL_OFFICER' && currentUser.region
      ? currentUser.region
      : regionFilter;

  const filteredGroups = useMemo(() => {
    return overlapGroups.filter((g) => {
      const inst = instMap.get(g.institutionId);
      if (effectiveRegion !== 'ALL' && inst?.region !== effectiveRegion) return false;
      if (bureauFilter !== 'ALL' && !g.bureausInvolved.includes(bureauFilter)) return false;

      if (statusFilter === 'ACTIVE') {
        return g.status === 'Open' || g.status === 'Coordination Initiated';
      }
      if (statusFilter === 'RESOLVED') {
        return g.status.startsWith('Resolved');
      }
      if (statusFilter === 'DISMISSED') {
        return g.status === 'Dismissed as false positive';
      }
      return true;
    });
  }, [overlapGroups, instMap, effectiveRegion, bureauFilter, statusFilter]);

  const paramGroupId = searchParams.get('group');
  const selectedGroup = useMemo(() => {
    if (paramGroupId) {
      const found = overlapGroups.find((g) => g.id === paramGroupId);
      if (found) return found;
    }
    return filteredGroups[0] ?? overlapGroups[0] ?? null;
  }, [paramGroupId, filteredGroups, overlapGroups]);

  // Action Dialog states
  const [leadBureauChoice, setLeadBureauChoice] = useState<Bureau>('RB');
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const [noteInput, setNoteInput] = useState('');

  // Deep Semantic Check state
  const [semanticResult, setSemanticResult] = useState<{
    similarity: number;
    explanation: string;
    usedAI: boolean;
  } | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);

  useEffect(() => {
    if (selectedGroup && selectedGroup.bureausInvolved.length > 0) {
      setLeadBureauChoice(selectedGroup.bureausInvolved[0]);
    }
    setSemanticResult(null);
  }, [selectedGroup?.id]);

  const involvedCases = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.caseIds
      .map((cid) => complaints.find((c) => c.caseId === cid))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [selectedGroup, complaints]);

  const selectedInst = selectedGroup ? instMap.get(selectedGroup.institutionId) : undefined;

  const handleRunDeepSemanticCheck = async () => {
    if (involvedCases.length < 2) return;
    setSemanticLoading(true);
    try {
      const res = await evaluateSemanticSimilarityAPI(
        involvedCases[0].description,
        involvedCases[1].description
      );
      setSemanticResult(res);
    } finally {
      setSemanticLoading(false);
    }
  };

  const handleDismissSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !dismissReason.trim()) return;
    dismissOverlapAsFalsePositive(selectedGroup.id, dismissReason.trim());
    setDismissModalOpen(false);
    setDismissReason('');
  };

  const handlePostNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !noteInput.trim()) return;
    addCoordinationNote(selectedGroup.id, noteInput.trim());
    setNoteInput('');
  };

  return (
    <div className="space-y-5">
      {/* Mandatory Banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-amber-950 font-bold text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
          <span>⚠ Potential Overlapping Cases – Coordination Required</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-amber-900">
            3-Layer Engine: Entity Resolution → Cross-Bureau Rules → Semantic Similarity
          </span>
          <button
            type="button"
            onClick={() => rescanOverlaps()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg hover:bg-[#082B68] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-scan All 400 Cases</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'ACTIVE', label: 'Active Overlaps' },
              { id: 'ALL', label: 'All Groups' },
              { id: 'RESOLVED', label: 'Resolved / Lead Assigned' },
              { id: 'DISMISSED', label: 'Dismissed (False Positives)' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#0B3D91] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter overlap groups by region"
            disabled={currentUser.roleType === 'REGIONAL_OFFICER'}
            value={effectiveRegion}
            onChange={(e) => setRegionFilter(e.target.value as Region | 'ALL')}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white disabled:opacity-60"
          >
            <option value="ALL">All Regions</option>
            {(['Northern', 'Southern', 'Eastern', 'Western', 'Central', 'South-Western', 'North-Western'] as Region[]).map(
              (r) => (
                <option key={r} value={r}>
                  {r} Region
                </option>
              )
            )}
          </select>

          <select
            aria-label="Filter overlap groups by bureau"
            value={bureauFilter}
            onChange={(e) => setBureauFilter(e.target.value as Bureau | 'ALL')}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
          >
            <option value="ALL">All Bureaus</option>
            {(['PGRC', 'RB', 'AB', 'Legal Cell', 'Vigilance Cell', 'Academic Bureau', 'Southern RO', 'Northern RO', 'Western RO', 'Eastern RO'] as Bureau[]).map(
              (b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Master-Detail Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List of Overlap Groups (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
            <span>Detected Overlap Groups ({filteredGroups.length})</span>
            <span className="font-mono-tabular text-slate-500">Score %</span>
          </div>

          <div className="divide-y divide-slate-200 max-h-[720px] overflow-y-auto">
            {filteredGroups.map((g) => {
              const inst = instMap.get(g.institutionId);
              const isSelected = selectedGroup?.id === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSearchParams({ group: g.id })}
                  className={`w-full text-left p-4 transition-colors cursor-pointer block space-y-1.5 ${
                    isSelected
                      ? 'bg-blue-50/90 ring-2 ring-inset ring-[#0B3D91]'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono-tabular font-bold text-[#0B3D91]">{g.id}</span>
                    <span
                      className={`font-mono-tabular font-bold ${
                        g.overlapScore >= 80
                          ? 'text-red-700'
                          : g.overlapScore >= 65
                          ? 'text-amber-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {g.overlapScore}%
                    </span>
                  </div>

                  <div className="text-xs font-bold text-slate-900 line-clamp-1">
                    {inst?.name ?? g.institutionId}
                  </div>

                  {g.scenarioTag && (
                    <div className="text-[11px] font-semibold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
                      {g.scenarioTag}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-600">
                    Bureaus: <strong>{g.bureausInvolved.join(' + ')}</strong> · {g.caseIds.length} Cases
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                    <span>Status: {g.status}</span>
                    {g.leadBureau && (
                      <span className="font-semibold text-emerald-700">
                        Lead: {g.leadBureau}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {filteredGroups.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                No overlap groups match the current filter.
              </div>
            )}
          </div>
        </div>

        {/* Right Detail & Side-by-Side Comparison (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {selectedGroup ? (
            <>
              {/* Group Header & Explainable AI / Rule-Based Score Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono-tabular font-bold text-sm text-[#0B3D91]">
                        {selectedGroup.id}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Confidence: {selectedGroup.confidenceLevel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-800">
                        Status: {selectedGroup.status}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span>{selectedInst?.name ?? selectedGroup.institutionId}</span>
                      <button
                        type="button"
                        onClick={() => navigate(`/institutions/${selectedGroup.institutionId}`)}
                        className="text-xs font-semibold text-[#0B3D91] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>360° View</span>
                      </button>
                    </h2>

                    <div className="text-xs text-slate-600">
                      AICTE ID: <span className="font-mono-tabular font-semibold">{selectedGroup.institutionId}</span> ·
                      Bureaus Involved: <strong>{selectedGroup.bureausInvolved.join(' + ')}</strong>
                      {selectedGroup.leadBureau && (
                        <span className="ml-2 text-emerald-700 font-bold">
                          · Lead Bureau: {selectedGroup.leadBureau}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500">Combined Overlap Score</div>
                    <div className="text-3xl font-bold font-mono-tabular text-[#0B3D91]">
                      {selectedGroup.overlapScore}%
                    </div>
                  </div>
                </div>

                {/* "Why was this flagged?" Explanation Box */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-900">
                      Why was this flagged? (Explainable 3-Layer Detection Breakdown)
                    </div>
                    <button
                      type="button"
                      onClick={handleRunDeepSemanticCheck}
                      disabled={semanticLoading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#0B3D91] bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#FF9933]" />
                      <span>
                        {semanticLoading ? 'Running Deep Semantic Check...' : 'Verify Semantic Similarity'}
                      </span>
                    </button>
                  </div>

                  <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
                    {selectedGroup.reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>

                  {semanticResult && (
                    <div className="mt-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-950">
                      <strong>
                        {semanticResult.usedAI ? 'Gemini AI Semantic Analysis' : 'Rule-Based TF-IDF Synonym Analysis'}:
                      </strong>{' '}
                      Similarity Score <span className="font-mono-tabular font-bold">{semanticResult.similarity}</span> —{' '}
                      {semanticResult.explanation}
                    </div>
                  )}
                </div>

                {/* Human-in-the-loop Resolution & Coordination Action Bar */}
                {currentUser.canResolveOverlaps && (
                  <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => initiateCoordination(selectedGroup.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg hover:bg-[#082B68] cursor-pointer"
                      >
                        Initiate Coordination (Notify All Bureaus)
                      </button>

                      <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <select
                          aria-label="Select Lead Bureau"
                          value={leadBureauChoice}
                          onChange={(e) => setLeadBureauChoice(e.target.value as Bureau)}
                          className="text-xs bg-white border border-slate-300 rounded px-2 py-1 font-medium"
                        >
                          {selectedGroup.bureausInvolved.map((b) => (
                            <option key={b} value={b}>
                              Lead: {b}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => assignLeadBureau(selectedGroup.id, leadBureauChoice)}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 text-white rounded hover:bg-emerald-800 cursor-pointer"
                        >
                          Assign Lead Bureau
                        </button>
                      </div>

                      {involvedCases.length >= 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            mergeOverlapCases(selectedGroup.id, involvedCases[0].caseId)
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Link & Merge Cases</span>
                        </button>
                      )}
                    </div>

                    {selectedGroup.status !== 'Dismissed as false positive' && (
                      <button
                        type="button"
                        onClick={() => setDismissModalOpen(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Dismiss as False Positive</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Side-by-Side Comparison of Involved Cases */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Side-by-Side Case Comparison ({involvedCases.length} Overlapping Files)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {involvedCases.map((c) => {
                    const sla = getSLAInfo(c);
                    return (
                      <div
                        key={c.caseId}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3 text-xs"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => navigate(`/cases/${encodeURIComponent(c.caseId)}`)}
                              className="font-mono-tabular font-bold text-sm text-[#0B3D91] hover:underline cursor-pointer"
                            >
                              {c.caseId}
                            </button>
                            <span className="font-bold px-2 py-0.5 rounded bg-[#0B3D91] text-white">
                              {c.currentBureau}
                            </span>
                          </div>

                          <div className="text-slate-600">
                            <strong>Filed Institution Name:</strong>{' '}
                            {c.submittedInstitutionName ?? selectedInst?.name}
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600">
                            <div>
                              Category: <strong className="text-slate-900">{c.category}</strong>
                            </div>
                            <div>
                              Status: <strong className="text-slate-900">{c.status}</strong>
                            </div>
                            <div>
                              Officer: <strong className="text-slate-900">{c.assignedOfficer}</strong>
                            </div>
                            <div className="font-mono-tabular">
                              Ageing: <strong>{sla.ageDays}d ({sla.label})</strong>
                            </div>
                          </div>

                          <div className="p-2.5 rounded bg-white border border-slate-200 text-slate-800 leading-relaxed">
                            {c.description}
                          </div>

                          <div className="text-[11px] text-slate-600">
                            <strong>Latest Action ({c.lastActionDate}):</strong> {c.lastAction}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 flex justify-end">
                          <button
                            type="button"
                            onClick={() => navigate(`/cases/${encodeURIComponent(c.caseId)}`)}
                            className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                          >
                            Open Full Case Dossier →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Inter-Bureau Coordination Notes Thread */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Inter-Bureau Coordination Thread ({selectedGroup.coordinationNotes.length})
                </h3>

                <div className="space-y-2.5">
                  {selectedGroup.coordinationNotes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {note.author} ({note.bureau})
                        </span>
                        <span className="font-mono-tabular text-slate-500">
                          {note.timestamp.replace('T', ' ').slice(0, 16)}
                        </span>
                      </div>
                      <p className="text-slate-700">{note.message}</p>
                    </div>
                  ))}

                  {selectedGroup.coordinationNotes.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No coordination notes posted yet. Initiate coordination or post a note below.
                    </p>
                  )}
                </div>

                <form onSubmit={handlePostNote} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    aria-label="Post coordination note"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder={`Post coordination note as ${currentUser.name} (${currentUser.bureau})...`}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D91]"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg hover:bg-[#082B68] cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post Note</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
              Select an overlap group from the left panel to inspect side-by-side case details.
            </div>
          )}
        </div>
      </div>

      {/* Dismiss as False Positive Modal */}
      {dismissModalOpen && selectedGroup && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleDismissSubmit}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <h3 className="text-base font-bold text-slate-900">
              Dismiss {selectedGroup.id} as False Positive
            </h3>
            <p className="text-xs text-slate-600">
              Dismissed pairs are recorded in the immutable audit ledger and will not be re-flagged on future rescans unless new case activity occurs.
            </p>
            <div>
              <label htmlFor="dismiss-reason-input" className="block text-xs font-semibold text-slate-800 mb-1">
                Mandatory Verification / Dismissal Reason *
              </label>
              <textarea
                id="dismiss-reason-input"
                rows={3}
                required
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="e.g. Same institution (1-9810011223), but completely unrelated grievances: one is hostel mess deposit refund, the other is SWAYAM NPTEL credit transfer."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDismissModalOpen(false)}
                className="px-3.5 py-1.5 text-xs bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer"
              >
                Confirm Dismiss False Positive
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
