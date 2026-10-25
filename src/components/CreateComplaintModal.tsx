import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Search,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { matchInstitution, evaluateComplaintPairOverlap } from '../engine/overlap';
import { suggestComplaintClassificationAPI } from '../services/api';
import {
  Bureau,
  ComplaintCategory,
  ComplaintSource,
  Priority,
} from '../types';

const CATEGORIES: ComplaintCategory[] = [
  'Fake approval/Affiliation issue',
  'Fee/Refund',
  'Faculty salary/qualification',
  'Infrastructure/Lab deficiency',
  'Admission irregularity',
  'Ragging/Harassment',
  'Mandatory disclosure violation',
  'Closure/Withdrawal',
  'Fake degree',
  'Other',
];

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

const SOURCES: ComplaintSource[] = [
  'Portal',
  'CPGRAMS',
  'Student',
  'Faculty',
  'Parent',
  'Email',
  'RTI',
  'Letter',
  'Public',
];

export const CreateComplaintModal: React.FC = () => {
  const navigate = useNavigate();
  const {
    createComplaintModalOpen,
    setCreateComplaintModalOpen,
    institutions,
    complaints,
    createNewComplaint,
  } = useAppStore();

  const [instQuery, setInstQuery] = useState('');
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('');
  const [source, setSource] = useState<ComplaintSource>('Portal');
  const [complainantName, setComplainantName] = useState('');
  const [complainantContact, setComplainantContact] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('Faculty salary/qualification');
  const [priority, setPriority] = useState<Priority>('High');
  const [assignedBureau, setAssignedBureau] = useState<Bureau>('PGRC');
  const [description, setDescription] = useState('');

  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Live fuzzy institution autocomplete
  const matchedInstitutions = useMemo(() => {
    if (!instQuery.trim()) return institutions.slice(0, 6);
    return matchInstitution(instQuery, institutions).slice(0, 6).map((m) => ({
      ...m.institution,
      matchScore: m.score,
      matchedAlias: m.matchedAlias,
    }));
  }, [instQuery, institutions]);

  const selectedInstitution = useMemo(
    () => institutions.find((i) => i.aicteId === selectedInstitutionId),
    [institutions, selectedInstitutionId]
  );

  // Live duplicate / cross-bureau overlap detector while typing description
  const liveOverlaps = useMemo(() => {
    if (!selectedInstitution || description.trim().length < 15) return [];
    const openForInst = complaints.filter(
      (c) => c.institutionId === selectedInstitution.aicteId && c.status !== 'Disposed'
    );
    const tempDraft = {
      caseId: 'DRAFT',
      institutionId: selectedInstitution.aicteId,
      submittedInstitutionName: instQuery || selectedInstitution.name,
      receivedDate: new Date().toISOString().split('T')[0],
      source,
      complainantName,
      complainantContact,
      category,
      description,
      priority,
      status: 'Received' as const,
      currentBureau: assignedBureau,
      originBureau: assignedBureau,
      assignedOfficer: 'Current Officer',
      lastAction: 'Draft',
      lastActionDate: new Date().toISOString().split('T')[0],
      nextActionRequired: 'Review',
      expectedDisposalDate: new Date().toISOString().split('T')[0],
      slaDays: 45,
      linkedCaseIds: [],
      attachments: [],
    };

    const hits = [];
    for (const existing of openForInst) {
      const ev = evaluateComplaintPairOverlap(tempDraft, existing, selectedInstitution);
      if (ev.isOverlap || ev.score >= 50) {
        hits.push({ existing, evaluation: ev });
      }
    }
    return hits.sort((a, b) => b.evaluation.score - a.evaluation.score);
  }, [
    selectedInstitution,
    description,
    complaints,
    instQuery,
    source,
    complainantName,
    complainantContact,
    category,
    priority,
    assignedBureau,
  ]);

  if (!createComplaintModalOpen) return null;

  const handleAutoSuggest = async () => {
    if (description.trim().length < 10) {
      setValidationError('Please enter at least 10 characters of complaint description first.');
      return;
    }
    setValidationError(null);
    setAiSuggesting(true);
    try {
      const suggestion = await suggestComplaintClassificationAPI(description);
      setCategory(suggestion.category);
      setPriority(suggestion.priority);
      setAssignedBureau(suggestion.suggestedBureau);
      setAiReasoning(
        `${suggestion.reasoning} (${
          suggestion.usedAI ? 'Classified via Gemini AI' : 'Classified via Rule-Based Engine'
        })`
      );
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstitutionId) {
      setValidationError('Please select a resolved AICTE Institution from the search list.');
      return;
    }
    if (!complainantName.trim() || !complainantContact.trim()) {
      setValidationError('Complainant Name and Contact Number/Email are required.');
      return;
    }
    if (description.trim().length < 20) {
      setValidationError('Please provide a detailed complaint description (minimum 20 characters).');
      return;
    }

    setValidationError(null);
    const createdCaseId = createNewComplaint({
      institutionId: selectedInstitutionId,
      submittedInstitutionName: instQuery.trim() || selectedInstitution?.name || '',
      source,
      complainantName: complainantName.trim(),
      complainantContact: complainantContact.trim(),
      category,
      priority,
      description: description.trim(),
      assignedBureau,
    });

    navigate(`/cases/${encodeURIComponent(createdCaseId)}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-complaint-title"
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 id="create-complaint-title" className="text-lg font-bold text-slate-900">
              Register New Institutional Complaint
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Includes real-time alias-aware Entity Resolution and cross-bureau Overlap Detection.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateComplaintModalOpen(false)}
            aria-label="Close Register Complaint dialog"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {validationError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-medium"
            >
              {validationError}
            </div>
          )}

          {/* Step 1: Institution Autocomplete with Fuzzy/Alias resolution */}
          <div>
            <label htmlFor="inst-search-input" className="block text-xs font-semibold text-slate-800 mb-1">
              1. Search & Resolve Technical Institution (Name, Alias, or AICTE ID) *
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="inst-search-input"
                type="text"
                value={instQuery}
                onChange={(e) => {
                  setInstQuery(e.target.value);
                  setValidationError(null);
                }}
                placeholder='Try typing "S.V. College Engg" or "1-9810011223"...'
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D91]"
              />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50">
              {matchedInstitutions.map((inst: Institution & { matchScore?: number; matchedAlias?: string }) => {
                const isSelected = inst.aicteId === selectedInstitutionId;
                return (
                  <button
                    key={inst.aicteId}
                    type="button"
                    onClick={() => {
                      setSelectedInstitutionId(inst.aicteId);
                      if (!instQuery) setInstQuery(inst.name);
                      setValidationError(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[#0B3D91] text-white'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/80'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{inst.name}</span>
                      </div>
                      <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
                        AICTE ID: <span className="font-mono-tabular">{inst.aicteId}</span> · {inst.city}, {inst.state} ({inst.region} Region)
                        {inst.matchedAlias ? ` · Alias matched: "${inst.matchedAlias}"` : ''}
                      </div>
                    </div>
                    {typeof inst.matchScore === 'number' && (
                      <span className="font-mono-tabular text-[11px] font-semibold shrink-0">
                        {Math.round(inst.matchScore * 100)}% match
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedInstitution && (
              <div className="mt-2 flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>
                  Resolved Entity: <strong>{selectedInstitution.name}</strong> (
                  <span className="font-mono-tabular">{selectedInstitution.aicteId}</span>)
                </span>
              </div>
            )}
          </div>

          {/* Step 2: Complainant & Source Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="comp-source" className="block text-xs font-semibold text-slate-800 mb-1">
                Receipt Source *
              </label>
              <select
                id="comp-source"
                value={source}
                onChange={(e) => setSource(e.target.value as ComplaintSource)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="comp-name" className="block text-xs font-semibold text-slate-800 mb-1">
                Complainant Name *
              </label>
              <input
                id="comp-name"
                type="text"
                value={complainantName}
                onChange={(e) => setComplainantName(e.target.value)}
                placeholder="e.g. Dr. Ramesh Babu"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="comp-contact" className="block text-xs font-semibold text-slate-800 mb-1">
                Mobile / Email *
              </label>
              <input
                id="comp-contact"
                type="text"
                value={complainantContact}
                onChange={(e) => setComplainantContact(e.target.value)}
                placeholder="e.g. 9848011223"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-tabular"
              />
            </div>
          </div>

          {/* Step 3: Description + Live Overlap Warning + AI Auto-Classify */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="comp-desc" className="block text-xs font-semibold text-slate-800">
                2. Grievance Description *
              </label>
              <button
                type="button"
                onClick={handleAutoSuggest}
                disabled={aiSuggesting}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#0B3D91] transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiSuggesting ? 'Analyzing...' : 'Auto-Suggest Category & Priority'}</span>
              </button>
            </div>
            <textarea
              id="comp-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the grievance in detail (e.g., Faculty salaries unpaid for 6 months in CSE department and original certificates withheld by management)..."
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D91]"
            />
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                Privacy by Design: Complainant PII (name, mobile, email) is strictly redacted before classification or similarity analysis.
              </span>
            </div>

            {aiReasoning && (
              <div className="mt-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
                <strong>Classification Suggestion:</strong> {aiReasoning}
              </div>
            )}

            {/* Live Possible Duplicate / Cross-Bureau Overlap Alert */}
            {liveOverlaps.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-300 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Possible Overlapping / Duplicate Cases Detected ({liveOverlaps.length} active file(s) on this institution)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {liveOverlaps.slice(0, 3).map(({ existing, evaluation }) => (
                    <div
                      key={existing.caseId}
                      className="p-2 rounded bg-white border border-amber-200 text-xs flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="font-mono-tabular font-semibold text-slate-900">
                          {existing.caseId}
                        </span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="font-semibold text-[#0B3D91]">{existing.currentBureau}</span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="text-slate-600">{existing.status}</span>
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                          {existing.description}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-xs font-bold text-amber-800 shrink-0">
                        {evaluation.score}% overlap
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 4: Category, Priority, Assigned Bureau */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="comp-category" className="block text-xs font-semibold text-slate-800 mb-1">
                Category *
              </label>
              <select
                id="comp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="comp-priority" className="block text-xs font-semibold text-slate-800 mb-1">
                Priority *
              </label>
              <select
                id="comp-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {(['Low', 'Medium', 'High', 'Critical'] as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="comp-bureau" className="block text-xs font-semibold text-slate-800 mb-1">
                Assign Bureau / Cell *
              </label>
              <select
                id="comp-bureau"
                value={assignedBureau}
                onChange={(e) => setAssignedBureau(e.target.value as Bureau)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {BUREAUS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateComplaintModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0B3D91] rounded-lg hover:bg-[#082B68] cursor-pointer"
            >
              Register & Run Overlap Scan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
