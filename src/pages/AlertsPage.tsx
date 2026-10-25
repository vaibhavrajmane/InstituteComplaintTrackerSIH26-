import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Clock,
  AlertTriangle,
  Flame,
  Mail,
  MessageSquare,
  Webhook,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { AlertType } from '../types';

export const AlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    alerts,
    currentUser,
    markAlertRead,
    markAllAlertsRead,
    snoozeAlert,
    notificationSettings,
    updateNotificationSettings,
  } = useAppStore();

  const [typeFilter, setTypeFilter] = useState<AlertType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const roleScopedAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (currentUser.roleType === 'REGIONAL_OFFICER' && currentUser.region) {
        if (a.region && a.region !== currentUser.region) return false;
      } else if (currentUser.roleType === 'BUREAU_OFFICER') {
        if (a.targetBureau !== 'ALL' && a.targetBureau !== currentUser.bureau) return false;
      }

      if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
      if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
      if (unreadOnly && a.read) return false;
      return true;
    });
  }, [alerts, currentUser, typeFilter, severityFilter, unreadOnly]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Alerts Feed (8 cols) */}
      <div className="lg:col-span-8 space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter alerts by type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as AlertType | 'ALL')}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="ALL">All Alert Types</option>
              <option value="Overlap">Duplicate / Overlap Alerts</option>
              <option value="SLA breach">SLA Breached</option>
              <option value="Approaching SLA">Approaching SLA (7/3/1d)</option>
              <option value="Escalation">Escalation</option>
              <option value="Pending reminder">Pending Case Reminder</option>
            </select>

            <select
              aria-label="Filter alerts by severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="ALL">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
            </select>

            <button
              type="button"
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                unreadOnly
                  ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                  : 'bg-slate-50 text-slate-700 border-slate-300'
              }`}
            >
              Unread Only
            </button>
          </div>

          <button
            type="button"
            onClick={markAllAlertsRead}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All as Read</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
          {roleScopedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                !alert.read ? 'bg-blue-50/40' : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`font-bold ${
                      alert.severity === 'Critical'
                        ? 'text-red-700'
                        : alert.severity === 'High'
                        ? 'text-amber-700'
                        : 'text-blue-700'
                    }`}
                  >
                    [{alert.severity}] {alert.type}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-semibold text-slate-700">
                    Target: {alert.targetBureau}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-mono-tabular text-slate-500">
                    {alert.createdAt.replace('T', ' ').slice(0, 16)}
                  </span>
                  {!alert.read && (
                    <span className="text-[11px] font-bold text-[#0B3D91]">· UNREAD</span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-900 font-medium">
                  {alert.message}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {alert.overlapGroupId && (
                  <button
                    type="button"
                    onClick={() => {
                      markAlertRead(alert.id);
                      navigate(`/overlaps?group=${alert.overlapGroupId}`);
                    }}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg cursor-pointer"
                  >
                    Open Overlap
                  </button>
                )}
                {alert.caseId && !alert.overlapGroupId && (
                  <button
                    type="button"
                    onClick={() => {
                      markAlertRead(alert.id);
                      navigate(`/cases/${encodeURIComponent(alert.caseId!)}`);
                    }}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg cursor-pointer"
                  >
                    Inspect Case
                  </button>
                )}
                {!alert.read && (
                  <button
                    type="button"
                    onClick={() => markAlertRead(alert.id)}
                    className="px-2.5 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Mark Read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => snoozeAlert(alert.id, 24)}
                  className="px-2.5 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Snooze 24h
                </button>
              </div>
            </div>
          ))}

          {roleScopedAlerts.length === 0 && (
            <div className="p-10 text-center text-xs text-slate-500">
              No alerts matching your filter criteria.
            </div>
          )}
        </div>
      </div>

      {/* Right Notification Delivery Settings Panel (4 cols) */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Notification Channels & Thresholds
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Simulated AICTE NIC email/SMS gateway and CPGRAMS webhook triggers
          </p>
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-[#0B3D91]" />
              <div>
                <div className="font-semibold text-slate-900">In-App Real-Time Alerts</div>
                <div className="text-[11px] text-slate-500">Instant bell alerts on overlap & SLA</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.inApp}
              onChange={(e) => updateNotificationSettings({ inApp: e.target.checked })}
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-[#0B3D91]" />
              <div>
                <div className="font-semibold text-slate-900">NIC Email Gateway (@aicte-india.org)</div>
                <div className="text-[11px] text-slate-500">Daily digest + critical overlap alerts</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.emailGateway}
              onChange={(e) => updateNotificationSettings({ emailGateway: e.target.checked })}
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-[#0B3D91]" />
              <div>
                <div className="font-semibold text-slate-900">NIC SMS Gateway (Sandes / SMS)</div>
                <div className="text-[11px] text-slate-500">Urgent SLA breach alerts to Bureau Heads</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.smsGateway}
              onChange={(e) => updateNotificationSettings({ smsGateway: e.target.checked })}
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Webhook className="w-4 h-4 text-[#0B3D91]" />
              <div>
                <div className="font-semibold text-slate-900">CPGRAMS / e-Office Sync Webhook</div>
                <div className="text-[11px] text-slate-500">Notify DARPG portal on status change</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.cpgramsWebhook}
              onChange={(e) => updateNotificationSettings({ cpgramsWebhook: e.target.checked })}
            />
          </label>
        </div>

        <div className="pt-3 border-t border-slate-200 text-xs space-y-1.5">
          <div className="font-semibold text-slate-800">Active Approaching-SLA Triggers</div>
          <div className="text-slate-600 font-mono-tabular">
            T-7 Days · T-3 Days · T-1 Day before Expected Disposal Date
          </div>
        </div>
      </div>
    </div>
  );
};
