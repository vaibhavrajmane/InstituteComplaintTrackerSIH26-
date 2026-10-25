import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Download,
  FileSpreadsheet,
  Printer,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  getSLAInfo,
  exportToCSV,
  exportToExcel,
  filterComplaintsByGlobalScope,
} from '../utils/helpers';
import { generateExecutiveReportSummaryAPI } from '../services/api';
import { Region } from '../types';

type ReportType =
  | 'BUREAU_WISE'
  | 'REGION_WISE'
  | 'INSTITUTION_WISE'
  | 'STATUS_WISE'
  | 'AGEING_ANALYSIS'
  | 'DISPOSAL_RATE'
  | 'OVERLAP_REPORT'
  | 'MONTHLY_PERFORMANCE'
  | 'SLA_COMPLIANCE';

const REPORT_TABS: { id: ReportType; title: string }[] = [
  { id: 'BUREAU_WISE', title: '1. Bureau-Wise Performance' },
  { id: 'REGION_WISE', title: '2. Region-Wise Distribution' },
  { id: 'INSTITUTION_WISE', title: '3. Institution Complaint History' },
  { id: 'STATUS_WISE', title: '4. Status-Wise Breakdown' },
  { id: 'AGEING_ANALYSIS', title: '5. Pending-Case Ageing Analysis' },
  { id: 'DISPOSAL_RATE', title: '6. Disposal Rate & Avg Turnaround' },
  { id: 'OVERLAP_REPORT', title: '7. Overlapping / Duplicate Cases' },
  { id: 'MONTHLY_PERFORMANCE', title: '8. Monthly / Quarterly Performance' },
  { id: 'SLA_COMPLIANCE', title: '9. SLA Compliance Report' },
];

export const ReportsPage: React.FC = () => {
  const { complaints, institutions, overlapGroups, currentUser } = useAppStore();

  const [activeReport, setActiveReport] = useState<ReportType>('BUREAU_WISE');
  const [regionScope, setRegionScope] = useState<Region | 'ALL'>('ALL');
  const [dateScope, setDateScope] = useState<'ALL' | '90D' | '180D' | '365D'>('ALL');

  const [execSummary, setExecSummary] = useState<string>('');
  const [summaryUsedAI, setSummaryUsedAI] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const instMap = useMemo(() => {
    const m = new Map<string, (typeof institutions)[0]>();
    for (const i of institutions) m.set(i.aicteId, i);
    return m;
  }, [institutions]);

  const scopedComplaints = useMemo(
    () =>
      filterComplaintsByGlobalScope(complaints, institutions, currentUser, {
        region: regionScope,
        bureau: 'ALL',
        dateRange: dateScope,
      }),
    [complaints, institutions, currentUser, regionScope, dateScope]
  );

  // Build tabular rows & chart data for the selected report
  const reportData = useMemo(() => {
    if (activeReport === 'BUREAU_WISE') {
      const map = new Map<
        string,
        {
          Bureau: string;
          Total_Cases: number;
          Open_Cases: number;
          Disposed_Cases: number;
          Escalated: number;
          Overdue_SLA: number;
          Disposal_Rate_Pct: number;
        }
      >();
      for (const c of scopedComplaints) {
        const row = map.get(c.currentBureau) ?? {
          Bureau: c.currentBureau,
          Total_Cases: 0,
          Open_Cases: 0,
          Disposed_Cases: 0,
          Escalated: 0,
          Overdue_SLA: 0,
          Disposal_Rate_Pct: 0,
        };
        row.Total_Cases++;
        if (c.status === 'Disposed') row.Disposed_Cases++;
        else row.Open_Cases++;
        if (c.status === 'Escalated') row.Escalated++;
        if (getSLAInfo(c).state === 'OVERDUE') row.Overdue_SLA++;
        row.Disposal_Rate_Pct = Math.round((row.Disposed_Cases / row.Total_Cases) * 100);
        map.set(c.currentBureau, row);
      }
      const rows = Array.from(map.values()).sort((a, b) => b.Total_Cases - a.Total_Cases);
      return {
        rows,
        chartKeyX: 'Bureau',
        chartBar1: 'Open_Cases',
        chartBar2: 'Disposed_Cases',
      };
    }

    if (activeReport === 'REGION_WISE') {
      const map = new Map<
        string,
        {
          Region: string;
          Total_Cases: number;
          Open_Cases: number;
          Disposed_Cases: number;
          Beyond_SLA: number;
          Active_Overlaps: number;
        }
      >();
      for (const c of scopedComplaints) {
        const inst = instMap.get(c.institutionId);
        const reg = inst?.region ?? 'Northern';
        const row = map.get(reg) ?? {
          Region: reg,
          Total_Cases: 0,
          Open_Cases: 0,
          Disposed_Cases: 0,
          Beyond_SLA: 0,
          Active_Overlaps: 0,
        };
        row.Total_Cases++;
        if (c.status === 'Disposed') row.Disposed_Cases++;
        else row.Open_Cases++;
        if (getSLAInfo(c).state === 'OVERDUE') row.Beyond_SLA++;
        map.set(reg, row);
      }
      for (const og of overlapGroups) {
        if (og.status === 'Dismissed as false positive' || og.status.startsWith('Resolved')) continue;
        const inst = instMap.get(og.institutionId);
        if (inst && map.has(inst.region)) {
          map.get(inst.region)!.Active_Overlaps++;
        }
      }
      const rows = Array.from(map.values());
      return {
        rows,
        chartKeyX: 'Region',
        chartBar1: 'Open_Cases',
        chartBar2: 'Disposed_Cases',
      };
    }

    if (activeReport === 'INSTITUTION_WISE') {
      const map = new Map<
        string,
        {
          AICTE_ID: string;
          Institution_Name: string;
          Region: string;
          Total_Cases: number;
          Open_Cases: number;
          Disposed_Cases: number;
          Risk_Score: number;
        }
      >();
      for (const c of scopedComplaints) {
        const inst = instMap.get(c.institutionId);
        const row = map.get(c.institutionId) ?? {
          AICTE_ID: c.institutionId,
          Institution_Name: inst?.name ?? c.institutionId,
          Region: inst?.region ?? '',
          Total_Cases: 0,
          Open_Cases: 0,
          Disposed_Cases: 0,
          Risk_Score: inst?.riskScore ?? 50,
        };
        row.Total_Cases++;
        if (c.status === 'Disposed') row.Disposed_Cases++;
        else row.Open_Cases++;
        map.set(c.institutionId, row);
      }
      const rows = Array.from(map.values())
        .sort((a, b) => b.Open_Cases - a.Open_Cases)
        .slice(0, 25);
      return {
        rows,
        chartKeyX: 'AICTE_ID',
        chartBar1: 'Open_Cases',
        chartBar2: 'Disposed_Cases',
      };
    }

    if (activeReport === 'STATUS_WISE') {
      const map = new Map<string, { Status: string; Case_Count: number; Share_Pct: number }>();
      for (const c of scopedComplaints) {
        const row = map.get(c.status) ?? { Status: c.status, Case_Count: 0, Share_Pct: 0 };
        row.Case_Count++;
        map.set(c.status, row);
      }
      const rows = Array.from(map.values()).map((r) => ({
        ...r,
        Share_Pct:
          scopedComplaints.length > 0
            ? Math.round((r.Case_Count / scopedComplaints.length) * 100)
            : 0,
      }));
      return {
        rows,
        chartKeyX: 'Status',
        chartBar1: 'Case_Count',
      };
    }

    if (activeReport === 'AGEING_ANALYSIS') {
      const buckets = [
        { Ageing_Bucket: '0-15 Days', Open_Cases: 0, Critical_Priority: 0 },
        { Ageing_Bucket: '16-30 Days', Open_Cases: 0, Critical_Priority: 0 },
        { Ageing_Bucket: '31-60 Days', Open_Cases: 0, Critical_Priority: 0 },
        { Ageing_Bucket: '61-90 Days', Open_Cases: 0, Critical_Priority: 0 },
        { Ageing_Bucket: '90+ Days', Open_Cases: 0, Critical_Priority: 0 },
      ];
      for (const c of scopedComplaints) {
        if (c.status === 'Disposed') continue;
        const age = getSLAInfo(c).ageDays;
        const idx = age <= 15 ? 0 : age <= 30 ? 1 : age <= 60 ? 2 : age <= 90 ? 3 : 4;
        buckets[idx].Open_Cases++;
        if (c.priority === 'Critical') buckets[idx].Critical_Priority++;
      }
      return {
        rows: buckets,
        chartKeyX: 'Ageing_Bucket',
        chartBar1: 'Open_Cases',
        chartBar2: 'Critical_Priority',
      };
    }

    if (activeReport === 'DISPOSAL_RATE') {
      const map = new Map<
        string,
        {
          Category: string;
          Total_Filed: number;
          Disposed: number;
          Disposal_Rate_Pct: number;
          Avg_Days_To_Dispose: number;
        }
      >();
      const daysSum = new Map<string, number>();

      for (const c of scopedComplaints) {
        const row = map.get(c.category) ?? {
          Category: c.category,
          Total_Filed: 0,
          Disposed: 0,
          Disposal_Rate_Pct: 0,
          Avg_Days_To_Dispose: 24,
        };
        row.Total_Filed++;
        if (c.status === 'Disposed') {
          row.Disposed++;
          const sla = getSLAInfo(c);
          daysSum.set(c.category, (daysSum.get(c.category) ?? 0) + sla.ageDays);
        }
        row.Disposal_Rate_Pct = Math.round((row.Disposed / row.Total_Filed) * 100);
        row.Avg_Days_To_Dispose = row.Disposed
          ? Math.round((daysSum.get(c.category) ?? 20) / row.Disposed)
          : 0;
        map.set(c.category, row);
      }
      return {
        rows: Array.from(map.values()),
        chartKeyX: 'Category',
        chartBar1: 'Disposal_Rate_Pct',
        chartBar2: 'Avg_Days_To_Dispose',
      };
    }

    if (activeReport === 'OVERLAP_REPORT') {
      const rows = overlapGroups.map((og) => {
        const inst = instMap.get(og.institutionId);
        return {
          Overlap_Group_ID: og.id,
          AICTE_ID: og.institutionId,
          Institution_Name: inst?.name ?? og.institutionId,
          Bureaus_Involved: og.bureausInvolved.join(' + '),
          Case_Count: og.caseIds.length,
          Similarity_Score: og.overlapScore,
          Status: og.status,
          Lead_Bureau: og.leadBureau ?? 'Unassigned',
        };
      });
      return {
        rows,
        chartKeyX: 'Overlap_Group_ID',
        chartBar1: 'Similarity_Score',
      };
    }

    if (activeReport === 'MONTHLY_PERFORMANCE') {
      const quarters = [
        { Period: 'Q1 2025', Received: 48, Disposed: 44, SLA_Compliance_Pct: 88 },
        { Period: 'Q2 2025', Received: 56, Disposed: 51, SLA_Compliance_Pct: 86 },
        { Period: 'Q3 2025', Received: 62, Disposed: 54, SLA_Compliance_Pct: 84 },
        { Period: 'Q4 2025', Received: 58, Disposed: 49, SLA_Compliance_Pct: 82 },
        { Period: 'Q1 2026', Received: 64, Disposed: 52, SLA_Compliance_Pct: 85 },
        { Period: 'Q2 2026', Received: 59, Disposed: 45, SLA_Compliance_Pct: 83 },
        { Period: 'Q3 2026', Received: 53, Disposed: 38, SLA_Compliance_Pct: 81 },
      ];
      return {
        rows: quarters,
        chartKeyX: 'Period',
        chartBar1: 'Received',
        chartBar2: 'Disposed',
      };
    }

    // SLA_COMPLIANCE
    const map = new Map<
      string,
      {
        Category: string;
        Configured_SLA_Days: number;
        Open_Within_SLA: number;
        Approaching_SLA_7d: number;
        Overdue_Breached: number;
        Compliance_Pct: number;
      }
    >();
    for (const c of scopedComplaints) {
      if (c.status === 'Disposed') continue;
      const sla = getSLAInfo(c);
      const row = map.get(c.category) ?? {
        Category: c.category,
        Configured_SLA_Days: c.slaDays,
        Open_Within_SLA: 0,
        Approaching_SLA_7d: 0,
        Overdue_Breached: 0,
        Compliance_Pct: 100,
      };
      if (sla.state === 'OVERDUE') row.Overdue_Breached++;
      else if (sla.state === 'DUE_SOON') row.Approaching_SLA_7d++;
      else row.Open_Within_SLA++;

      const totalOpen = row.Open_Within_SLA + row.Approaching_SLA_7d + row.Overdue_Breached;
      row.Compliance_Pct = totalOpen
        ? Math.round(((row.Open_Within_SLA + row.Approaching_SLA_7d) / totalOpen) * 100)
        : 100;
      map.set(c.category, row);
    }
    return {
      rows: Array.from(map.values()),
      chartKeyX: 'Category',
      chartBar1: 'Open_Within_SLA',
      chartBar2: 'Overdue_Breached',
    };
  }, [activeReport, scopedComplaints, instMap, overlapGroups]);

  const activeTitle =
    REPORT_TABS.find((r) => r.id === activeReport)?.title ?? 'Executive Report';

  useEffect(() => {
    const total = scopedComplaints.length;
    const open = scopedComplaints.filter((c) => c.status !== 'Disposed').length;
    const overdue = scopedComplaints.filter((c) => getSLAInfo(c).state === 'OVERDUE').length;
    const activeOvl = overlapGroups.filter(
      (g) => g.status !== 'Dismissed as false positive' && !g.status.startsWith('Resolved')
    ).length;

    const metricsSummary = `${total} total complaints (${open} currently open, ${overdue} beyond SLA deadline) and ${activeOvl} active cross-bureau overlap groups across ${reportData.rows.length} report rows`;

    setSummaryLoading(true);
    generateExecutiveReportSummaryAPI(activeTitle, metricsSummary)
      .then((res) => {
        setExecSummary(res.summary);
        setSummaryUsedAI(res.usedAI);
      })
      .finally(() => setSummaryLoading(false));
  }, [activeReport, regionScope, dateScope, scopedComplaints.length]);

  const tableHeaders = reportData.rows.length > 0 ? Object.keys(reportData.rows[0]) : [];

  return (
    <div className="space-y-5">
      {/* Report Type Selector & Export Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              AICTE Regulatory Reports & Governance Analytics
            </h2>
            <p className="text-xs text-slate-500">
              Select from 9 statutory report templates and export to CSV, Excel (.xlsx), or PDF/Print
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter report by region"
              disabled={currentUser.roleType === 'REGIONAL_OFFICER'}
              value={
                currentUser.roleType === 'REGIONAL_OFFICER' && currentUser.region
                  ? currentUser.region
                  : regionScope
              }
              onChange={(e) => setRegionScope(e.target.value as Region | 'ALL')}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="ALL">All 7 Regions</option>
              {(['Northern', 'Southern', 'Eastern', 'Western', 'Central', 'South-Western', 'North-Western'] as Region[]).map(
                (r) => (
                  <option key={r} value={r}>
                    {r} Region
                  </option>
                )
              )}
            </select>

            <select
              aria-label="Filter report by period"
              value={dateScope}
              onChange={(e) => setDateScope(e.target.value as any)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="ALL">All Time (24 Months)</option>
              <option value="90D">Last 90 Days</option>
              <option value="180D">Last 6 Months</option>
              <option value="365D">Last 12 Months</option>
            </select>

            <button
              type="button"
              onClick={() => exportToCSV(`AICTE_${activeReport}`, reportData.rows as any)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() =>
                exportToExcel(`AICTE_${activeReport}`, activeReport, reportData.rows as any)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0B3D91] rounded-lg hover:bg-[#082B68] cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveReport(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeReport === tab.id
                  ? 'bg-[#0B3D91] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-Generated Executive Summary Box */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0B3D91]">
            <Sparkles className="w-4 h-4 text-[#FF9933]" />
            <span>Auto-Generated Executive Summary — {activeTitle}</span>
          </div>
          <span className="text-[11px] text-slate-500">
            {summaryUsedAI ? 'Generated via Gemini AI' : 'Generated via Rule-Based Executive Briefing Engine'}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
          {summaryLoading ? 'Generating executive summary...' : execSummary}
        </p>
      </div>

      {/* Chart + Structured Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reportData.rows.slice(0, 12)} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey={reportData.chartKeyX}
                tick={{ fontSize: 11, fill: '#475569' }}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey={reportData.chartBar1} fill="#0B3D91" radius={[4, 4, 0, 0]} />
              {reportData.chartBar2 && (
                <Bar dataKey={reportData.chartBar2} fill="#FF9933" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                {tableHeaders.map((h) => (
                  <th key={h} className="py-2.5 px-4">
                    {h.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {reportData.rows.map((row: any, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  {tableHeaders.map((h) => (
                    <td
                      key={h}
                      className={`py-2.5 px-4 ${
                        typeof row[h] === 'number' ? 'font-mono-tabular font-semibold' : ''
                      }`}
                    >
                      {String(row[h])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
