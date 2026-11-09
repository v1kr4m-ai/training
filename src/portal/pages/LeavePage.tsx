/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { canDecide } from '../leaveLogic';
import { usePortal } from '../store';
import { PageHeader } from '../ui';
import { Approvals } from './leave/Approvals';
import { Forecast } from './leave/Forecast';
import { LeaveSettings } from './leave/LeaveSettings';
import { MyLeave } from './leave/MyLeave';
import { Users, User } from 'lucide-react';

type Tab = 'dashboard' | 'mine' | 'approvals' | 'settings';

export const LeavePage: React.FC = () => {
  const { db, user } = usePortal();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboardViewMode, setDashboardViewMode] = useState<'DEPARTMENTAL' | 'INDIVIDUAL'>('DEPARTMENTAL');
  if (!user) return null;

  const waiting = db.leaveRequests.filter(r => canDecide(db, user, r)).length;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'dashboard', label: 'Multi-Person Dashboard & Forecast' },
    { id: 'mine', label: 'My Leave & Personal Plan' },
    ...(user.role !== 'USER' ? [{ id: 'approvals' as Tab, label: `Approvals${waiting ? ` (${waiting})` : ''}` }] : []),
    ...(user.role === 'ADMIN' ? [{ id: 'settings' as Tab, label: 'Settings' }] : [])
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave & Manning Dashboard"
        subtitle="Multi-person departmental leave cycles, coverage gap analysis, visual calendar, bar/line charts, and tiered approvals."
        actions={
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setTab('dashboard');
                setDashboardViewMode('DEPARTMENTAL');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                tab === 'dashboard' && dashboardViewMode === 'DEPARTMENTAL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Departmental View</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('dashboard');
                setDashboardViewMode('INDIVIDUAL');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                tab === 'dashboard' && dashboardViewMode === 'INDIVIDUAL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Individual View</span>
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1 border-b border-slate-800" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <Forecast
          viewMode={dashboardViewMode}
          onViewModeChange={setDashboardViewMode}
        />
      )}
      {tab === 'mine' && <MyLeave />}
      {tab === 'approvals' && <Approvals />}
      {tab === 'settings' && <LeaveSettings />}
    </div>
  );
};
