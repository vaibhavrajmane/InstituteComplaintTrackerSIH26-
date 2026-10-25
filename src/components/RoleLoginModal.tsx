import React from 'react';
import { X, Shield, UserCheck, Lock, Globe2, Building } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const RoleLoginModal: React.FC = () => {
  const {
    showLoginModal,
    setShowLoginModal,
    availableUsers,
    currentUser,
    switchUserRole,
  } = useAppStore();

  if (!showLoginModal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-login-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full overflow-hidden shadow-2xl my-8">
        {/* Government Branding Banner */}
        <div className="bg-[#0B3D91] text-white px-6 py-5 border-b-4 border-[#FF9933] flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-[#FF9933] flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-[#FF9933]" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-[#FF9933] font-semibold">
                All India Council for Technical Education (AICTE) · Govt. of India
              </div>
              <h2 id="role-login-modal-title" className="text-xl font-bold tracking-tight mt-0.5">
                Single-Window Official Role & Access Selector (RBAC Simulation)
              </h2>
              <p className="text-xs text-slate-200 mt-1">
                Select an official persona to simulate Role-Based Access Control, Bureau edit locks, Regional scoping, and PII masking.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowLoginModal(false)}
            aria-label="Close Role Selector"
            className="p-1.5 text-slate-300 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableUsers.map((u) => {
              const isSelected = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => switchUserRole(u.id)}
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-[#0B3D91] bg-blue-50/60 ring-2 ring-[#0B3D91]'
                      : 'border-slate-200 hover:border-slate-400 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono-tabular font-semibold text-[#0B3D91]">
                        {u.roleType.replace('_', ' ')} · {u.bureau}
                      </span>
                      {isSelected && (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" /> Active
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-1">{u.name}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{u.designation}</div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {u.canEditAll
                        ? 'Full Global Write Access'
                        : u.canEditOwnBureau
                        ? `Edit Own Bureau (${u.bureau}) Only`
                        : 'Global Read-Only'}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Globe2 className="w-3 h-3" />
                      {u.region ? `${u.region} Region Only` : 'All 7 Regions'}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {u.canViewUnmaskedPII ? 'Unmasked PII' : 'Masked PII'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
