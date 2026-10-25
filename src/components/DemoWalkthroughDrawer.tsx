import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Compass, Play, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const DemoWalkthroughDrawer: React.FC = () => {
  const navigate = useNavigate();
  const {
    demoWalkthroughOpen,
    setDemoWalkthroughOpen,
    switchUserRole,
    setCaseFilters,
    resetCaseFilters,
    initiateCoordination,
    assignLeadBureau,
  } = useAppStore();

  if (!demoWalkthroughOpen) return null;

  const steps = [
    {
      num: '01',
      title: 'Switch Role to PGRC Officer (Smt. Meenakshi Iyer)',
      desc: 'Simulate logging in as Assistant Director, Public Grievance Redressal Cell (PGRC). Observe how you can view all cases globally but only edit PGRC cases.',
      actionLabel: 'Activate PGRC Officer Role',
      onRun: () => {
        switchUserRole('USR-PGRC');
        navigate('/');
      },
    },
    {
      num: '02',
      title: 'Fuzzy Alias Search: "S.V. College Engg"',
      desc: 'Test Layer-1 Entity Resolution: search for "S.V. College Engg" in the Case Register and see how it resolves to "Sri Venkateswara College of Engineering & Technology" (1-9810011223) despite 3 different name variants.',
      actionLabel: 'Run Fuzzy Search in Case Register',
      onRun: () => {
        resetCaseFilters();
        setCaseFilters({ search: 'S.V. College Engg' });
        navigate('/cases');
      },
    },
    {
      num: '03',
      title: 'Open Institution 360° Profile & Multi-Bureau Swim-Lane',
      desc: 'Inspect Sri Venkateswara College (1-9810011223) 360° Profile. See the prominent "Who is dealing with this institution right now?" card showing PGRC, RB, and Southern RO acting simultaneously.',
      actionLabel: 'Open Institution 360° Profile',
      onRun: () => {
        navigate('/institutions/1-9810011223');
      },
    },
    {
      num: '04',
      title: 'Inspect Overlap & Initiate Cross-Bureau Coordination',
      desc: 'Open the Overlap & Coordination Center for OVL-SVCET-01 ("faculty not paid for 6 months" vs "salary default by management"). Initiate formal coordination across PGRC, RB, and Southern RO.',
      actionLabel: 'Initiate Coordination on OVL-SVCET-01',
      onRun: () => {
        initiateCoordination(
          'OVL-SVCET-01',
          'PGRC requesting joint inspection alignment with RB and Southern RO on 6-month faculty salary arrears.'
        );
        navigate('/overlaps?group=OVL-SVCET-01');
      },
    },
    {
      num: '05',
      title: 'Switch to RB Officer & Assign Lead Bureau',
      desc: 'Switch to Sh. Rajeshwar Rao (Regulation Bureau Officer), see the coordination alert, and designate RB as the Lead Bureau for OVL-SVCET-01.',
      actionLabel: 'Switch to RB & Assign Lead Bureau',
      onRun: () => {
        switchUserRole('USR-RB');
        assignLeadBureau(
          'OVL-SVCET-01',
          'RB',
          'Regulation Bureau designated as Lead Bureau; EVC inspection will cover PGRC & SRO grievances.'
        );
        navigate('/overlaps?group=OVL-SVCET-01');
      },
    },
    {
      num: '06',
      title: 'Inspect False-Positive Pair & Test Dismiss Workflow',
      desc: 'Open OVL-FALSE-POS-01 (same institution, unrelated issues: hostel caution refund vs NPTEL credit transfer) and dismiss it as a false positive so it never reappears on rescan.',
      actionLabel: 'Open False-Positive Pair (OVL-FALSE-POS-01)',
      onRun: () => {
        switchUserRole('USR-CHAIRMAN');
        navigate('/overlaps?group=OVL-FALSE-POS-01');
      },
    },
    {
      num: '07',
      title: 'Verify Regional Officer Scoping (Southern RO)',
      desc: 'Switch to Dr. S. Sundararajan (Southern Regional Officer) and verify that the Executive Dashboard and Case Register strictly show Southern Region data with masked complainant PII.',
      actionLabel: 'Switch to Southern Regional Officer',
      onRun: () => {
        switchUserRole('USR-SRO');
        navigate('/');
      },
    },
    {
      num: '08',
      title: 'Executive Reports & CSV / Excel / PDF Export',
      desc: 'Switch back to Super Admin (Chairman Office) and open Reports & Analytics to generate AI/template executive summaries and export to CSV, Excel (.xlsx), or Print/PDF.',
      actionLabel: 'Open Reports & Analytics',
      onRun: () => {
        switchUserRole('USR-CHAIRMAN');
        navigate('/reports');
      },
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-script-title"
      className="fixed inset-0 z-50 bg-slate-900/50 flex justify-end no-print"
    >
      <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-slate-200 flex flex-col">
        <div className="p-5 bg-[#0B3D91] text-white border-b-4 border-[#FF9933] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-[#FF9933]" />
            <div>
              <h2 id="demo-script-title" className="text-base font-bold">
                3-Minute Guided Demo Walkthrough
              </h2>
              <p className="text-xs text-slate-200">
                Interactive step-by-step evaluator script for AICTE Jury / Officials
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDemoWalkthroughOpen(false)}
            aria-label="Close Guided Demo Script"
            className="p-1 text-slate-200 hover:text-white rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {steps.map((s) => (
            <div
              key={s.num}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono-tabular font-bold text-[#0B3D91]">
                  STEP {s.num}
                </span>
                <CheckCircle2 className="w-4 h-4 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{s.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
              <button
                type="button"
                onClick={() => {
                  s.onRun();
                  setDemoWalkthroughOpen(false);
                }}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B3D91] text-white text-xs font-semibold hover:bg-[#082B68] transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{s.actionLabel}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
