/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { CreateComplaintModal } from './components/CreateComplaintModal';
import { RoleLoginModal } from './components/RoleLoginModal';
import { DemoWalkthroughDrawer } from './components/DemoWalkthroughDrawer';
import { ExecutiveDashboard } from './pages/ExecutiveDashboard';
import { CaseRegister } from './pages/CaseRegister';
import { CaseDetail } from './pages/CaseDetail';
import { InstitutionsPage } from './pages/InstitutionsPage';
import { OverlapCenter } from './pages/OverlapCenter';
import { AlertsPage } from './pages/AlertsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPage } from './pages/AdminPage';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full space-y-3 text-center">
            <h1 className="text-base font-bold text-slate-900">
              Application Recovery Mode
            </h1>
            <p className="text-xs text-slate-600">{this.state.message}</p>
            <button
              type="button"
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }}
              className="px-4 py-2 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg cursor-pointer"
            >
              Reset Demo State & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<ExecutiveDashboard />} />
            <Route path="/cases" element={<CaseRegister />} />
            <Route path="/cases/:caseId" element={<CaseDetail />} />
            <Route path="/institutions" element={<InstitutionsPage />} />
            <Route path="/institutions/:aicteId" element={<InstitutionsPage />} />
            <Route path="/overlaps" element={<OverlapCenter />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
        <CreateComplaintModal />
        <RoleLoginModal />
        <DemoWalkthroughDrawer />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
