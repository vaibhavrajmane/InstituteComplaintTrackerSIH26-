import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Download,
  Link2,
  BookmarkPlus,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  filterComplaintsForRegister,
  getSLAInfo,
  maskComplainantName,
  exportToCSV,
} from '../utils/helpers';
import { parseNaturalLanguageSearchAPI } from '../services/api';
import {
  Bureau,
  CaseStatus,
  ComplaintCategory,
  Priority,
  Region,
} from '../types';

const REGIONS: Region[] = [
  'Northern',
  'Southern',
  'Eastern',
  'Western',
  'Central',
  'South-Western',
  'North-Western',
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

const STATUSES: CaseStatus[] = [
  'Received',
  'Under Process',
  'Pending Information',
  'Transferred',
  'Escalated',
  'Disposed',
  'Reopened',
];

export const CaseRegister: React.FC = () => {
  const navigate = useNavigate();
  const {
    complaints,
    institutions,
    overlapGroups,
    currentUser,
    caseFilters,
    setCaseFilters,
    resetCaseFilters,
    savedFilters,
    saveCurrentFilter,
    deleteSavedFilter,
    linkCases,
  } = useAppStore();

  const [nlQuery, setNlQuery] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlFeedback, setNlFeedback] = useState<string | null>(null);

  const [saveFilterName, setSaveFilterName] = useState('');
  const [showSaveFilterInput, setShowSaveFilterInput] = useState(false);

  // Column visibility chooser
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    complainant: true,
    source: true,
    lastAction: true,
    officer: true,
  });

  // Sorting & Pagination
  const [sortField, setSortField] = useState<'receivedDate' | 'caseId' | 'priority' | 'sla'>('receivedDate');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Bulk selection & Link modal
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkReason, setLinkReason] = useState('');

  const instMap = useMemo(() => {
    const m = new Map<string, (typeof institutions)[0]>();
    for (const i of institutions) m.set(i.aicteId, i);
    return m;
  }, [institutions]);

  const activeOverlapGroupByCase = useMemo(() => {
    const m = new Map<string, (typeof overlapGroups)[0]>();
    for (const og of overlapGroups) {
      if (og.status !== 'Dismissed as false positive' && !og.status.startsWith('Resolved')) {
        for (const cid of og.caseIds) m.set(cid, og);
      }
    }
    return m;
  }, [overlapGroups]);

  const filteredComplaints = useMemo(() => {
    const list = filterComplaintsForRegister(
      complaints,
      institutions,
      currentUser,
      caseFilters,
      overlapGroups
    );

    const prioRank: Record<Priority, number> = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1,
    };

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'receivedDate') {
        cmp = a.receivedDate.localeCompare(b.receivedDate);
      } else if (sortField === 'caseId') {
        cmp = a.caseId.localeCompare(b.caseId);
      } else if (sortField === 'priority') {
        cmp = prioRank[a.priority] - prioRank[b.priority];
      } else if (sortField === 'sla') {
        cmp = getSLAInfo(a).daysRemaining - getSLAInfo(b).daysRemaining;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [complaints, institutions, currentUser, caseFilters, overlapGroups, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredComplaints.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => filteredComplaints.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredComplaints, currentPage, pageSize]
  );

  const handleNaturalLanguageSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlQuery.trim()) return;
    setNlLoading(true);
    try {
      const parsed = await parseNaturalLanguageSearchAPI(nlQuery);
      resetCaseFilters();
      setCaseFilters({
        region: parsed.region ?? 'ALL',
        bureau: parsed.bureau ?? 'ALL',
        category: parsed.category ?? 'ALL',
        status: parsed.status ?? 'ALL',
        priority: parsed.priority ?? 'ALL',
        minAgeDays: parsed.minAgeDays,
        slaFilter: parsed.overdueOnly ? 'OVERDUE' : 'ALL',
        overlapOnly: Boolean(parsed.overlapOnly),
        search: parsed.searchTerm ?? '',
      });
      setPage(1);
      setNlFeedback(
        `${parsed.explanation} (${
          parsed.usedAI ? 'Parsed via Gemini AI' : 'Parsed via Rule-Based Engine'
        })`
      );
    } finally {
      setNlLoading(false);
    }
  };

  const handleExportCSV = () => {
    const targetList =
      selectedCaseIds.length > 0
        ? filteredComplaints.filter((c) => selectedCaseIds.includes(c.caseId))
        : filteredComplaints;

    const rows = targetList.map((c) => {
      const inst = instMap.get(c.institutionId);
      const sla = getSLAInfo(c);
      return {
        Case_ID: c.caseId,
        AICTE_ID: c.institutionId,
        Institution_Name: inst?.name ?? '',
        Submitted_Name_Variant: c.submittedInstitutionName ?? inst?.name ?? '',
        Region: inst?.region ?? '',
        Category: c.category,
        Priority: c.priority,
        Status: c.status,
        Bureau: c.currentBureau,
        Assigned_Officer: c.assignedOfficer,
        Received_Date: c.receivedDate,
        Expected_Disposal: c.expectedDisposalDate,
        SLA_Status: sla.label,
        Overlap_Group: c.overlapGroupId ?? 'None',
      };
    });

    exportToCSV(`AICTE_Case_Register_${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  const toggleSelectCase = (caseId: string) => {
    setSelectedCaseIds((prev) =>
      prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]
    );
  };

  const handleBulkLinkConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCaseIds.length < 2) return;
    linkCases(
      selectedCaseIds,
      linkReason.trim() || 'Linked via Case Register bulk coordination action'
    );
    setLinkDialogOpen(false);
    setLinkReason('');
    setSelectedCaseIds([]);
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Search & Natural Language AI Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Standard Fuzzy / Alias / ID Search */}
          <div className="lg:col-span-5">
            <label htmlFor="register-search-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Search Institution (Fuzzy / Alias-Aware), AICTE ID, or Case ID
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="register-search-input"
                type="text"
                value={caseFilters.search}
                onChange={(e) => {
                  setCaseFilters({ search: e.target.value });
                  setPage(1);
                }}
                placeholder='e.g. "S.V. College Engg", "1-9810011223", or "AICTE/PGRC/2026/00101"'
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D91]"
              />
              {caseFilters.search && (
                <button
                  type="button"
                  onClick={() => setCaseFilters({ search: '' })}
                  aria-label="Clear search query"
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Natural Language AI Search Bar */}
          <form onSubmit={handleNaturalLanguageSearch} className="lg:col-span-7">
            <label htmlFor="nl-search-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Natural-Language Smart Filter (Gemini AI + Rule-Based Fallback)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="w-4 h-4 text-[#FF9933] absolute left-3 top-2.5" />
                <input
                  id="nl-search-input"
                  type="text"
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  placeholder='Try: "show pending fee refund cases in the Southern region older than 60 days"'
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D91]"
                />
              </div>
              <button
                type="submit"
                disabled={nlLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0B3D91] hover:bg-[#082B68] rounded-lg whitespace-nowrap cursor-pointer"
              >
                {nlLoading ? 'Parsing...' : 'Apply Smart Filter'}
              </button>
            </div>
          </form>
        </div>

        {nlFeedback && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-950 px-3 py-1.5 rounded-lg text-xs">
            <span>{nlFeedback}</span>
            <button
              type="button"
              onClick={() => setNlFeedback(null)}
              className="text-blue-700 hover:underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Structured Filter Dropdowns */}
        <div className="pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 items-end">
          <div>
            <label htmlFor="filter-region" className="block text-[11px] font-medium text-slate-600 mb-1">
              Region
            </label>
            <select
              id="filter-region"
              disabled={currentUser.roleType === 'REGIONAL_OFFICER'}
              value={
                currentUser.roleType === 'REGIONAL_OFFICER' && currentUser.region
                  ? currentUser.region
                  : caseFilters.region
              }
              onChange={(e) => {
                setCaseFilters({ region: e.target.value as Region | 'ALL' });
                setPage(1);
              }}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white disabled:opacity-60"
            >
              <option value="ALL">All Regions</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-bureau" className="block text-[11px] font-medium text-slate-600 mb-1">
              Bureau / Cell
            </label>
            <select
              id="filter-bureau"
              value={caseFilters.bureau}
              onChange={(e) => {
                setCaseFilters({ bureau: e.target.value as Bureau | 'ALL' });
                setPage(1);
              }}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="ALL">All Bureaus</option>
              {BUREAUS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-category" className="block text-[11px] font-medium text-slate-600 mb-1">
              Category
            </label>
            <select
              id="filter-category"
              value={caseFilters.category}
              onChange={(e) => {
                setCaseFilters({ category: e.target.value as ComplaintCategory | 'ALL' });
                setPage(1);
              }}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-status" className="block text-[11px] font-medium text-slate-600 mb-1">
              Status
            </label>
            <select
              id="filter-status"
              value={caseFilters.status}
              onChange={(e) => {
                setCaseFilters({ status: e.target.value as CaseStatus | 'ALL' });
                setPage(1);
              }}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="ALL">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-priority" className="block text-[11px] font-medium text-slate-600 mb-1">
              Priority
            </label>
            <select
              id="filter-priority"
              value={caseFilters.priority}
              onChange={(e) => {
                setCaseFilters({ priority: e.target.value as Priority | 'ALL' });
                setPage(1);
              }}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="ALL">All Priorities</option>
              {(['Critical', 'High', 'Medium', 'Low'] as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-sla" className="block text-[11px] font-medium text-slate-600 mb-1">
              SLA Window
            </label>
            <select
              id="filter-sla"
              value={caseFilters.slaFilter}
              onChange={(e) => {
                setCaseFilters({ slaFilter: e.target.value as typeof caseFilters.slaFilter });
                setPage(1);
              }}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="ALL">All SLA States</option>
              <option value="OVERDUE">Overdue (Beyond SLA)</option>
              <option value="DUE_SOON">Approaching SLA (≤7d)</option>
              <option value="WITHIN_SLA">Within SLA</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCaseFilters({ overlapOnly: !caseFilters.overlapOnly });
                setPage(1);
              }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                caseFilters.overlapOnly
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {caseFilters.overlapOnly ? '⚠ Overlaps Only' : 'All / Overlaps'}
            </button>

            <button
              type="button"
              onClick={() => {
                resetCaseFilters();
                setNlFeedback(null);
                setPage(1);
              }}
              aria-label="Reset all filters"
              className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Saved Filters & Toolbar Row */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Saved Filters:</span>
            {savedFilters.map((sf) => (
              <div key={sf.id} className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCaseFilters(sf.filters);
                    setPage(1);
                  }}
                  className="px-2.5 py-1 font-medium text-slate-700 hover:text-[#0B3D91] cursor-pointer"
                >
                  {sf.name}
                </button>
                <button
                  type="button"
                  onClick={() => deleteSavedFilter(sf.id)}
                  aria-label={`Delete saved filter ${sf.name}`}
                  className="pr-2 text-slate-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            ))}

            {!showSaveFilterInput ? (
              <button
                type="button"
                onClick={() => setShowSaveFilterInput(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Save this filter</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5">
                <input
                  type="text"
                  value={saveFilterName}
                  onChange={(e) => setSaveFilterName(e.target.value)}
                  placeholder="Filter name..."
                  className="px-2 py-1 text-xs border border-slate-300 rounded"
                />
                <button
                  type="button"
                  onClick={() => {
                    saveCurrentFilter(saveFilterName);
                    setSaveFilterName('');
                    setShowSaveFilterInput(false);
                  }}
                  className="px-2 py-1 text-xs font-semibold bg-[#0B3D91] text-white rounded"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveFilterInput(false)}
                  className="text-xs text-slate-500"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedCaseIds.length >= 2 && (
              <button
                type="button"
                onClick={() => setLinkDialogOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Link Selected ({selectedCaseIds.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                Export CSV ({selectedCaseIds.length > 0 ? selectedCaseIds.length : filteredComplaints.length})
              </span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Columns</span>
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-20 space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleCols.complainant}
                      onChange={(e) =>
                        setVisibleCols({ ...visibleCols, complainant: e.target.checked })
                      }
                    />
                    <span>Complainant (PII Masked)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleCols.source}
                      onChange={(e) =>
                        setVisibleCols({ ...visibleCols, source: e.target.checked })
                      }
                    />
                    <span>Source Channel</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleCols.officer}
                      onChange={(e) =>
                        setVisibleCols({ ...visibleCols, officer: e.target.checked })
                      }
                    />
                    <span>Assigned Officer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleCols.lastAction}
                      onChange={(e) =>
                        setVisibleCols({ ...visibleCols, lastAction: e.target.checked })
                      }
                    />
                    <span>Last Action Summary</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results Count Header */}
      <div className="flex items-center justify-between text-xs text-slate-600 px-1">
        <div>
          Showing <strong className="font-mono-tabular text-slate-900">{filteredComplaints.length}</strong> matching complaint records
          {caseFilters.search ? ` for query "${caseFilters.search}"` : ''}
        </div>
        <div className="font-mono-tabular">
          Page {currentPage} of {totalPages}
        </div>
      </div>

      {/* High-Density Case Register Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all cases on page"
                    checked={
                      paginatedRows.length > 0 &&
                      paginatedRows.every((r) => selectedCaseIds.includes(r.caseId))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCaseIds(
                          Array.from(new Set([...selectedCaseIds, ...paginatedRows.map((r) => r.caseId)]))
                        );
                      } else {
                        setSelectedCaseIds(
                          selectedCaseIds.filter((id) => !paginatedRows.some((r) => r.caseId === id))
                        );
                      }
                    }}
                  />
                </th>
                <th className="py-3 px-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('caseId')}
                    className="inline-flex items-center gap-1 font-semibold hover:text-[#0B3D91] cursor-pointer"
                  >
                    <span>Case ID & Overlap Flag</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 font-semibold">Institution (Resolved & Filed Variant)</th>
                <th className="py-3 px-3 font-semibold">Category</th>
                <th className="py-3 px-3 font-semibold">Bureau</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('priority')}
                    className="inline-flex items-center gap-1 font-semibold hover:text-[#0B3D91] cursor-pointer"
                  >
                    <span>Priority</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('sla')}
                    className="inline-flex items-center gap-1 font-semibold hover:text-[#0B3D91] cursor-pointer"
                  >
                    <span>SLA Countdown</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                {visibleCols.complainant && (
                  <th className="py-3 px-3 font-semibold">Complainant</th>
                )}
                {visibleCols.officer && (
                  <th className="py-3 px-3 font-semibold">Officer</th>
                )}
                <th className="py-3 px-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('receivedDate')}
                    className="inline-flex items-center gap-1 font-semibold hover:text-[#0B3D91] cursor-pointer"
                  >
                    <span>Received</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedRows.map((c) => {
                const inst = instMap.get(c.institutionId);
                const sla = getSLAInfo(c);
                const activeOvl = activeOverlapGroupByCase.get(c.caseId);
                const hasAliasVariant =
                  c.submittedInstitutionName &&
                  inst &&
                  c.submittedInstitutionName !== inst.name;

                return (
                  <tr
                    key={c.caseId}
                    className={`hover:bg-slate-50 transition-colors ${
                      activeOvl ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        aria-label={`Select case ${c.caseId}`}
                        checked={selectedCaseIds.includes(c.caseId)}
                        onChange={() => toggleSelectCase(c.caseId)}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/cases/${encodeURIComponent(c.caseId)}`)}
                        className="font-mono-tabular font-bold text-[#0B3D91] hover:underline text-left cursor-pointer block"
                      >
                        {c.caseId}
                      </button>
                      {activeOvl && (
                        <button
                          type="button"
                          onClick={() => navigate(`/overlaps?group=${activeOvl.id}`)}
                          className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:underline cursor-pointer"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Overlap: {activeOvl.bureausInvolved.join('+')}</span>
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs">
                      <button
                        type="button"
                        onClick={() => navigate(`/institutions/${c.institutionId}`)}
                        className="font-semibold text-slate-900 hover:text-[#0B3D91] hover:underline text-left cursor-pointer line-clamp-1"
                      >
                        {inst?.name ?? c.institutionId}
                      </button>
                      <div className="text-[11px] text-slate-500 font-mono-tabular">
                        {c.institutionId} · {inst?.city}, {inst?.region}
                      </div>
                      {hasAliasVariant && (
                        <div className="text-[11px] text-amber-800 mt-0.5 truncate">
                          Filed as: &ldquo;{c.submittedInstitutionName}&rdquo;
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 max-w-[180px]">
                      <div className="font-medium line-clamp-1">{c.category}</div>
                      {visibleCols.lastAction && (
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {c.lastAction}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                      {c.currentBureau}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          c.status === 'Disposed'
                            ? 'text-emerald-700'
                            : c.status === 'Escalated'
                            ? 'text-red-700'
                            : c.status === 'Pending Information'
                            ? 'text-amber-700'
                            : c.status === 'Transferred'
                            ? 'text-purple-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          c.priority === 'Critical'
                            ? 'text-red-700 font-bold'
                            : c.priority === 'High'
                            ? 'text-orange-700'
                            : c.priority === 'Medium'
                            ? 'text-slate-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {c.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono-tabular">
                      <span
                        className={`font-semibold ${
                          sla.state === 'OVERDUE'
                            ? 'text-red-700 font-bold'
                            : sla.state === 'DUE_SOON'
                            ? 'text-amber-700 font-bold'
                            : sla.state === 'DISPOSED'
                            ? 'text-emerald-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {sla.label}
                      </span>
                    </td>
                    {visibleCols.complainant && (
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        <div>
                          {maskComplainantName(
                            c.complainantName,
                            currentUser.canViewUnmaskedPII
                          )}
                        </div>
                        {visibleCols.source && (
                          <div className="text-[11px] text-slate-400">via {c.source}</div>
                        )}
                      </td>
                    )}
                    {visibleCols.officer && (
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {c.assignedOfficer}
                      </td>
                    )}
                    <td className="py-2.5 px-3 font-mono-tabular text-slate-600 whitespace-nowrap">
                      {c.receivedDate}
                    </td>
                  </tr>
                );
              })}

              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-700">
                      No matching complaints found
                    </div>
                    <p className="text-xs mt-1">
                      Try clearing active filters or searching by a partial institution name or alias.
                    </p>
                    <button
                      type="button"
                      onClick={resetCaseFilters}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-[#0B3D91] text-white text-xs font-semibold cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-600 font-mono-tabular">
            Showing {(currentPage - 1) * pageSize + (paginatedRows.length ? 1 : 0)}–
            {(currentPage - 1) * pageSize + paginatedRows.length} of {filteredComplaints.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              className="p-1.5 rounded border border-slate-300 bg-white disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono-tabular font-semibold px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
              className="p-1.5 rounded border border-slate-300 bg-white disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Link Cases Dialog */}
      {linkDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleBulkLinkConfirm}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <h3 className="text-base font-bold text-slate-900">
              Link {selectedCaseIds.length} Related Cases
            </h3>
            <p className="text-xs text-slate-600">
              Selected cases: <span className="font-mono-tabular font-semibold">{selectedCaseIds.join(', ')}</span>
            </p>
            <div>
              <label htmlFor="bulk-link-reason" className="block text-xs font-semibold text-slate-800 mb-1">
                Coordination / Linking Note *
              </label>
              <textarea
                id="bulk-link-reason"
                rows={3}
                required
                value={linkReason}
                onChange={(e) => setLinkReason(e.target.value)}
                placeholder="State why these cases are being linked..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkDialogOpen(false)}
                className="px-3 py-1.5 text-xs bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg"
              >
                Confirm Link
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
