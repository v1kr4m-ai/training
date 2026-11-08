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

type Tab = 'mine' | 'approvals' | 'forecast' | 'settings';

export const LeavePage: React.FC = () => {
  const { db, user } = usePortal();
  const [tab, setTab] = useState<Tab>('mine');
  if (!user) return null;

  const waiting = db.leaveRequests.filter(r => canDecide(db, user, r)).length;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'mine', label: 'My leave' },
    ...(user.role !== 'USER' ? [{ id: 'approvals' as Tab, label: `Approvals${waiting ? ` (${waiting})` : ''}` }] : []),
    { id: 'forecast', label: 'Forecast & status' },
    ...(user.role === 'ADMIN' ? [{ id: 'settings' as Tab, label: 'Settings' }] : [])
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Leave" subtitle="Balances, applications, approvals and the leave forecast." />
      <div className="flex gap-1 border-b border-slate-800" role="tablist">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'mine' && <MyLeave />}
      {tab === 'approvals' && <Approvals />}
      {tab === 'forecast' && <Forecast />}
      {tab === 'settings' && <LeaveSettings />}
    </div>
  );
};
