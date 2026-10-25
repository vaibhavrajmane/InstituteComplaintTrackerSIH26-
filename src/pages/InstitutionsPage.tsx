import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  AlertTriangle,
  ArrowLeft,
  ShieldAlert,
  GitCompareArrows,
  ExternalLink,
  CheckCircle2,
  MapPin,
  Users,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { matchInstitution, computeInstitutionRisk } from '../engine/overlap';
import { t } from '../i18n/translations';
import { Region } from '../types';

const REGIONS: Region[] = [
  'Northern',
  'Southern',
  'Eastern',
  'Western',
  'Central',
  'South-Western',
  'North-Western',
];

export const InstitutionsPage: React.FC = () => {
  const { aicteId } = useParams<{ aicteId?: string }>();
  if (aicteId) {
    return <Institution360Profile aicteId={aicteId} />;
  }
  return <InstitutionDirectory />;
};

const InstitutionDirectory: React.FC = () => {
  const navigate = useNavigate();
  const { institutions, complaints, overlapGroups, currentUser } = useAppStore();

  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<Region | 'ALL'>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<string>('ALL');

  const effectiveRegion =
    currentUser.roleType === 'REGIONAL_OFFICER' && currentUser.region
      ? currentUser.region
      : regionFilter;

  const filteredInstitutions = useMemo(() => {
    let base = institutions;
    if (effectiveRegion !== 'ALL') {
      base = base.filter((i) => i.region === effectiveRegion);
    }
    if (approvalFilter !== 'ALL') {
      base = base.filter((i) => i.approvalStatus === approvalFilter);
    }

    if (!query.trim()) {
      return [...base].sort((a, b) => b.riskScore - a.riskScore);
    }

    const matches = matchInstitution(query, base);
    if (matches.length > 0) {
      return matches.map((m) => m.institution);
    }

    const qLower = query.toLowerCase();
    return base.filter(
      (i) =>
        i.name.toLowerCase().includes(qLower) ||
        i.aicteId.toLowerCase().includes(qLower) ||
        i.city.toLowerCase().includes(qLower) ||
        i.aliases.some((a) => a.toLowerCase().includes(qLower))
    );
  }, [institutions, effectiveRegion, approvalFilter, query]);

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex-1 min-w-[260px]">
          <label htmlFor="inst-dir-search" className="block text-xs font-semibold text-slate-700 mb-1">
            Search Technical Institution (Fuzzy / Alias-Aware / AICTE Permanent ID)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              id="inst-dir-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try "S.V. College Engg", "Shivaji Maharaj", or "1-9810011223"...'
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D91]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="inst-dir-region" className="block text-xs font-medium text-slate-600 mb-1">
              Region
            </label>
            <select
              id="inst-dir-region"
              disabled={currentUser.roleType === 'REGIONAL_OFFICER'}
              value={effectiveRegion}
              onChange={(e) => setRegionFilter(e.target.value as Region | 'ALL')}
              className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white disabled:opacity-60"
            >
              <option value="ALL">All 7 Regions</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="inst-dir-approval" className="block text-xs font-medium text-slate-600 mb-1">
              Approval Status
            </label>
            <select
              id="inst-dir-approval"
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Under Review">Under Review</option>
              <option value="Withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInstitutions.map((inst) => {
          const instCases = complaints.filter((c) => c.institutionId === inst.aicteId);
          const openCases = instCases.filter((c) => c.status !== 'Disposed');
          const activeBureaus = Array.from(new Set(openCases.map((c) => c.currentBureau)));
          const activeOverlaps = overlapGroups.filter(
            (g) =>
              g.institutionId === inst.aicteId &&
              g.status !== 'Dismissed as false positive' &&
              !g.status.startsWith('Resolved')
          );

          return (
            <div
              key={inst.aicteId}
              onClick={() => navigate(`/institutions/${inst.aicteId}`)}
              className="bg-white border border-slate-200 hover:border-[#0B3D91] rounded-xl p-4 flex flex-col justify-between gap-3 cursor-pointer transition-all"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono-tabular font-semibold text-slate-500">
                    {inst.aicteId}
                  </span>
                  <span
                    className={`font-mono-tabular font-bold ${
                      inst.riskScore >= 75
                        ? 'text-red-700'
                        : inst.riskScore >= 50
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    Risk: {inst.riskScore}/100
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  {inst.name}
                </h3>

                <div className="text-[11px] text-slate-500">
                  Aliases: {inst.aliases.slice(0, 2).join(' · ')}
                </div>

                <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {inst.city}, {inst.state} ({inst.region} Region)
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold font-mono-tabular text-slate-900">
                    {openCases.length}
                  </span>{' '}
                  <span className="text-slate-500">Open</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="text-slate-600">
                    {activeBureaus.length} Bureau(s)
                  </span>
                </div>

                {activeOverlaps.length > 0 ? (
                  <span className="text-amber-800 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    {activeOverlaps.length} Overlap(s)
                  </span>
                ) : (
                  <span className="text-[#0B3D91] font-semibold">Open 360° →</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Institution360Profile: React.FC<{ aicteId: string }> = ({ aicteId }) => {
  const navigate = useNavigate();
  const { institutions, complaints, overlapGroups, language } = useAppStore();

  const institution = useMemo(
    () => institutions.find((i) => i.aicteId === aicteId),
    [institutions, aicteId]
  );

  const instCases = useMemo(
    () => complaints.filter((c) => c.institutionId === aicteId),
    [complaints, aicteId]
  );

  const openCases = useMemo(
    () => instCases.filter((c) => c.status !== 'Disposed'),
    [instCases]
  );

  const instOverlaps = useMemo(
    () =>
      overlapGroups.filter(
        (g) => g.institutionId === aicteId && g.status !== 'Dismissed as false positive'
      ),
    [overlapGroups, aicteId]
  );

  if (!institution) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="text-base font-bold">Institution Not Found ({aicteId})</div>
        <button
          type="button"
          onClick={() => navigate('/institutions')}
          className="mt-3 px-4 py-2 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg"
        >
          Back to Institutions Directory
        </button>
      </div>
    );
  }

  const riskDetails = computeInstitutionRisk(institution, instCases, overlapGroups);

  // Group active cases by Bureau for the "Who is dealing with this institution right now?" card
  const activeBureauMap = useMemo(() => {
    const m = new Map<string, typeof openCases>();
    for (const c of openCases) {
      const list = m.get(c.currentBureau) ?? [];
      list.push(c);
      m.set(c.currentBureau, list);
    }
    return Array.from(m.entries());
  }, [openCases]);

  // Group ALL cases by Bureau for the Multi-Bureau Swim-Lane Timeline
  const swimLanes = useMemo(() => {
    const m = new Map<string, typeof instCases>();
    for (const c of instCases) {
      const list = m.get(c.currentBureau) ?? [];
      list.push(c);
      m.set(c.currentBureau, list);
    }
    return Array.from(m.entries());
  }, [instCases]);

  // Repeat complaint indicator (categories with >= 2 cases)
  const repeatCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of instCases) {
      counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    }
    return Array.from(counts.entries()).filter(([, count]) => count >= 2);
  }, [instCases]);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/institutions')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0B3D91] cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Institutions Directory</span>
      </button>

      {/* Institution Header & Risk Score Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono-tabular font-bold text-[#0B3D91]">
              AICTE Permanent ID: {institution.aicteId}
            </span>
            <span aria-hidden="true">·</span>
            <span>{institution.type} Institution</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-slate-800">
              Approval Status: {institution.approvalStatus}
            </span>
          </div>

          <h2 className="text-xl font-bold text-slate-900">{institution.name}</h2>

          <div className="text-xs text-slate-600">
            <strong>Known Name Variants / Aliases Resolved by Engine:</strong>{' '}
            {institution.aliases.join(' · ')}
          </div>

          <div className="pt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
            <span>
              <strong>Location:</strong> {institution.address}, {institution.city} -{' '}
              <span className="font-mono-tabular">{institution.pincode}</span>, {institution.state} (
              {institution.region} Region)
            </span>
            <span>
              <strong>Head of Institution:</strong> {institution.headOfInstitution}
            </span>
            <span>
              <strong>Approved Programs:</strong> {institution.programs.join(', ')}
            </span>
          </div>

          {repeatCategories.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-red-800 font-medium">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                Repeat Grievance Indicator:{' '}
                {repeatCategories.map(([cat, cnt]) => `${cat} (${cnt} cases)`).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Computed Risk Score & Explanation */}
        <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Institutional Risk Score
              </span>
              <span
                className={`text-2xl font-bold font-mono-tabular ${
                  riskDetails.score >= 75
                    ? 'text-red-700'
                    : riskDetails.score >= 50
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {riskDetails.score}/100
              </span>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-slate-600 list-disc pl-4">
              {riskDetails.factors.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* PROMINENT CARD: "Who is dealing with this institution right now?" */}
      <section className="bg-white border-2 border-[#0B3D91] rounded-xl overflow-hidden">
        <div className="bg-[#0B3D91] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Users className="w-4 h-4 text-[#FF9933]" />
            <span>{t('whoIsDealing', language)}</span>
          </div>
          <span className="text-xs font-mono-tabular text-[#FF9933] font-semibold">
            {activeBureauMap.length} Active Bureau(s) · {openCases.length} Open Case(s)
          </span>
        </div>

        <div className="p-5">
          {activeBureauMap.length === 0 ? (
            <div className="text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>No Bureaus have open complaints against this institution right now.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeBureauMap.map(([bureau, cases]) => (
                <div
                  key={bureau}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#0B3D91]">{bureau}</span>
                    <span className="text-xs font-mono-tabular font-semibold text-slate-700">
                      {cases.length} Open Case(s)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {cases.map((c) => (
                      <div
                        key={c.caseId}
                        onClick={() => navigate(`/cases/${encodeURIComponent(c.caseId)}`)}
                        className="p-2.5 rounded-lg bg-white border border-slate-200 hover:border-[#0B3D91] cursor-pointer text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-mono-tabular">
                          <span className="font-bold text-[#0B3D91]">{c.caseId}</span>
                          <span className="text-slate-600">{c.status}</span>
                        </div>
                        <div className="font-medium text-slate-800">{c.category}</div>
                        <div className="text-[11px] text-slate-500">
                          Officer: {c.assignedOfficer} · Last: {c.lastAction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Active Overlap Groups for this Institution */}
      {instOverlaps.length > 0 && (
        <section className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span>
                ⚠ Potential Overlapping Cases – Coordination Required ({instOverlaps.length} Group(s))
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {instOverlaps.map((og) => (
              <div
                key={og.id}
                className="bg-white border border-amber-200 rounded-lg p-4 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="font-mono-tabular font-bold text-slate-900">
                    {og.id} · Score: {og.overlapScore}% ({og.status})
                  </div>
                  <div className="text-slate-700">
                    Bureaus: <strong>{og.bureausInvolved.join(' + ')}</strong> · Cases:{' '}
                    <span className="font-mono-tabular">{og.caseIds.join(', ')}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {og.reasons.slice(0, 2).join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/overlaps?group=${og.id}`)}
                  className="px-3 py-1.5 bg-[#0B3D91] text-white font-semibold rounded-lg shrink-0 cursor-pointer"
                >
                  Coordinate
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Consolidated Multi-Bureau Swim-Lane Timeline */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Consolidated Multi-Bureau Swim-Lane Timeline
          </h3>
          <p className="text-xs text-slate-500">
            One horizontal lane per Bureau/Cell showing parallel and historical complaint actions across AICTE
          </p>
        </div>

        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
          {swimLanes.map(([bureau, laneCases]) => (
            <div key={bureau} className="grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-3 bg-slate-50 p-4 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-center">
                <div className="text-xs font-bold text-[#0B3D91]">{bureau}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
                  {laneCases.length} Total Case(s) ·{' '}
                  {laneCases.filter((c) => c.status !== 'Disposed').length} Open
                </div>
              </div>
              <div className="md:col-span-9 p-4 flex flex-wrap gap-3 items-center">
                {laneCases.map((c) => (
                  <div
                    key={c.caseId}
                    onClick={() => navigate(`/cases/${encodeURIComponent(c.caseId)}`)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors min-w-[230px] flex-1 ${
                      c.status === 'Disposed'
                        ? 'bg-slate-50 border-slate-200 text-slate-600'
                        : c.overlapGroupId
                        ? 'bg-amber-50/60 border-amber-300 text-slate-900'
                        : 'bg-white border-slate-300 text-slate-900 hover:border-[#0B3D91]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono-tabular">
                      <span className="font-bold text-[#0B3D91]">{c.caseId}</span>
                      <span>{c.receivedDate}</span>
                    </div>
                    <div className="font-semibold mt-1">{c.category}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Status: <strong>{c.status}</strong> · Officer: {c.assignedOfficer}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 line-clamp-1">
                      Latest: {c.lastAction}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
