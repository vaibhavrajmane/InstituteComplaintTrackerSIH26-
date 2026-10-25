import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Building2,
  GitCompareArrows,
  Bell,
  BarChart3,
  Settings,
  Compass,
  Search,
  Plus,
  RefreshCw,
  RotateCcw,
  UserCheck,
  ShieldAlert,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Menu,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { t } from '../i18n/translations';
import { checkAIAvailability } from '../services/api';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser,
    availableUsers,
    switchUserRole,
    setShowLoginModal,
    language,
    setLanguage,
    aiAvailable,
    setAiAvailable,
    lastRefreshedAt,
    pulseRefresh,
    overlapGroups,
    alerts,
    setCreateComplaintModalOpen,
    setDemoWalkthroughOpen,
    rescanOverlaps,
    resetDemoData,
    setCaseFilters,
    toasts,
    dismissToast,
  } = useAppStore();

  const [headerSearch, setHeaderSearch] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Check Gemini API availability on mount and start 10s live refresh pulse
  useEffect(() => {
    checkAIAvailability().then((avail) => setAiAvailable(avail));
    const timer = setInterval(() => {
      pulseRefresh();
    }, 10000);
    return () => clearInterval(timer);
  }, [setAiAvailable, pulseRefresh]);

  // Scope active overlap count and unread alerts to user role
  const activeOverlapsCount = overlapGroups.filter((g) => {
    if (g.status === 'Dismissed as false positive' || g.status.startsWith('Resolved')) return false;
    if (currentUser.roleType === 'REGIONAL_OFFICER' && currentUser.region) {
      const inst = useAppStore.getState().institutions.find((i) => i.aicteId === g.institutionId);
      return inst?.region === currentUser.region;
    }
    return true;
  }).length;

  const unreadAlertsCount = alerts.filter((a) => {
    if (a.read) return false;
    if (currentUser.roleType === 'REGIONAL_OFFICER' && currentUser.region) {
      return a.region === currentUser.region;
    }
    if (currentUser.roleType === 'BUREAU_OFFICER') {
      return a.targetBureau === currentUser.bureau || a.targetBureau === 'ALL';
    }
    return true;
  }).length;

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = headerSearch.trim();
    setCaseFilters({ search: q });
    navigate('/cases');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('navDashboard', language) },
    { to: '/cases', icon: FileSpreadsheet, label: t('navCases', language) },
    { to: '/institutions', icon: Building2, label: t('navInstitutions', language) },
    {
      to: '/overlaps',
      icon: GitCompareArrows,
      label: t('navOverlaps', language),
      count: activeOverlapsCount,
    },
    {
      to: '/alerts',
      icon: Bell,
      label: t('navAlerts', language),
      count: unreadAlertsCount,
    },
    { to: '/reports', icon: BarChart3, label: t('navReports', language) },
    { to: '/admin', icon: Settings, label: t('navAdmin', language) },
  ];

  const currentBreadcrumb = (() => {
    if (location.pathname === '/') return t('navDashboard', language);
    if (location.pathname.startsWith('/cases/')) return 'Case Dossier & Timeline';
    if (location.pathname === '/cases') return t('navCases', language);
    if (location.pathname.startsWith('/institutions/')) return 'Institution 360° Governance Profile';
    if (location.pathname === '/institutions') return t('navInstitutions', language);
    if (location.pathname === '/overlaps') return t('navOverlaps', language);
    if (location.pathname === '/alerts') return t('navAlerts', language);
    if (location.pathname === '/reports') return t('navReports', language);
    if (location.pathname === '/admin') return t('navAdmin', language);
    return 'Dashboard';
  })();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Government Demo Mode & Status Ribbon */}
      <div className="bg-[#0B3D91] text-white text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#FF9933]/40 no-print">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-wider text-[#FF9933] uppercase">
            {t('demoRibbon', language)}
          </span>
          <span aria-hidden="true" className="text-white/40">·</span>
          <span className="text-slate-200 hidden sm:inline">
            {aiAvailable ? t('aiActiveBadge', language) : t('aiFallbackBadge', language)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-200 font-mono-tabular hidden md:inline">
            Live Sync: {lastRefreshedAt} (10s cycle)
          </span>
          <button
            type="button"
            onClick={() => setDemoWalkthroughOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#FF9933] text-slate-950 font-semibold hover:bg-[#ffad5c] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{t('navDemoScript', language)}</span>
          </button>
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            aria-label="Toggle Language English or Hindi"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'हिन्दी (HI)' : 'English (EN)'}</span>
          </button>
          <button
            type="button"
            onClick={resetDemoData}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t('resetDemo', language)}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left Navigation Sidebar */}
        <aside
          className={`${
            mobileNavOpen ? 'fixed inset-y-0 left-0 z-50 block' : 'hidden lg:flex'
          } w-64 shrink-0 bg-[#082B68] text-white flex-col border-r border-slate-800 no-print`}
        >
          {/* AICTE Brand Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Official-style placeholder geometric Ashoka/Gear emblem */}
              <div className="w-10 h-10 rounded-lg bg-white/10 border border-[#FF9933]/60 flex items-center justify-center shrink-0">
                <svg
                  className="w-6 h-6 text-[#FF9933]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="8" />
                  <circle cx="12" cy="12" r="3" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-base tracking-tight text-white leading-tight">
                  {t('appShortTitle', language)}
                </div>
                <div className="text-[11px] text-slate-300 leading-tight mt-0.5">
                  Single-Window Governance
                </div>
              </div>
            </div>
            {mobileNavOpen && (
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close sidebar"
                className="lg:hidden p-1 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Primary Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#FF9933] text-slate-950 font-semibold'
                        : 'text-slate-200 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span className="font-mono-tabular text-xs font-semibold px-1.5 py-0.5 rounded bg-black/25 text-white">
                      {item.count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Active Official Role Card in Sidebar Footer */}
          <div className="p-4 border-t border-white/10 bg-[#06204F] space-y-2.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">
              Active Official Session
            </div>
            <div className="text-xs font-semibold text-white leading-snug">
              {currentUser.name}
            </div>
            <div className="text-[11px] text-slate-300 leading-snug">
              {currentUser.designation}
            </div>
            <div className="text-[11px] text-[#FF9933] font-mono-tabular">
              Bureau: {currentUser.bureau}
              {currentUser.region ? ` · Region: ${currentUser.region}` : ''}
            </div>
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{t('switchRole', language)}</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header Bar */}
          <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <div className="text-xs text-slate-500">
                  AICTE HQ Single-Window Portal · {currentBreadcrumb}
                </div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {currentBreadcrumb}
                </h1>
              </div>
            </div>

            {/* Global Search + Role Quick Switcher + Primary Actions */}
            <div className="flex flex-wrap items-center gap-3 flex-1 max-w-3xl justify-end">
              <form onSubmit={handleGlobalSearchSubmit} className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label="Global complaint and institution search"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  placeholder={t('searchPlaceholder', language)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D91] focus:bg-white"
                />
              </form>

              {/* Quick Role Selector Dropdown */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="header-role-select" className="sr-only">
                  Switch Official Role
                </label>
                <select
                  id="header-role-select"
                  aria-label="Active Official Role"
                  value={currentUser.id}
                  onChange={(e) => switchUserRole(e.target.value)}
                  className="text-xs font-medium bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B3D91] cursor-pointer"
                >
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.bureau === 'HQ' ? u.roleType.replace('_', ' ') : u.bureau} — {u.name.split('(')[0].trim()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Alerts Bell Button */}
              <button
                type="button"
                onClick={() => navigate('/alerts')}
                aria-label={`Alerts and Notifications (${unreadAlertsCount} unread)`}
                className="relative p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-mono-tabular font-bold px-1.5 py-0.2 rounded-full">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              {/* Re-scan Overlaps Button */}
              <button
                type="button"
                onClick={() => rescanOverlaps()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('rescanOverlaps', language)}</span>
              </button>

              {/* Register New Complaint Primary Action */}
              <button
                type="button"
                onClick={() => setCreateComplaintModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0B3D91] rounded-lg hover:bg-[#082B68] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{t('newComplaint', language)}</span>
              </button>
            </div>
          </header>

          {/* Regional Officer Scope Notice if applicable */}
          {currentUser.roleType === 'REGIONAL_OFFICER' && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-xs text-amber-900 no-print">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Regional Access Policy Active:</strong> Logged in as{' '}
                  <strong>{currentUser.designation}</strong>. Viewing complaints, institutions, and cross-bureau overlap alerts scoped strictly to the{' '}
                  <strong>{currentUser.region} Region</strong>. PII is masked per governance norms.
                </span>
              </div>
              <button
                type="button"
                onClick={() => switchUserRole('USR-CHAIRMAN')}
                className="underline font-semibold hover:text-amber-950 whitespace-nowrap ml-4 cursor-pointer"
              >
                Switch to Chairman Office (Global View)
              </button>
            </div>
          )}

          {/* Main Viewport */}
          <main className="flex-1 p-4 lg:p-6 overflow-x-hidden print-full-width">
            {children}
          </main>

          {/* Clean Institutional Footer */}
          <footer className="bg-white border-t border-slate-200 px-6 py-3 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 no-print">
            <div>
              All India Council for Technical Education (AICTE) · Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
            </div>
            <div className="flex items-center gap-4">
              <span>Single-Window Inter-Bureau Governance System</span>
              <span aria-hidden="true">·</span>
              <span>WCAG 2.1 AA Compliant</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Toast Feedback Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none no-print"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-slate-900 text-white border border-slate-700 rounded-lg p-3 shadow-lg flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : toast.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-semibold">{toast.title}</div>
                  {toast.description && (
                    <div className="text-[11px] text-slate-300 mt-0.5">{toast.description}</div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
