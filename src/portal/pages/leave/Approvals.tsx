/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { balances, canDecide, statusAfterApproval, todayIso } from '../../leaveLogic';
import { usePortal } from '../../store';
import type { LeaveRequest } from '../../types';
import { btnDanger, btnPrimary, Card, Empty, inputCls, StatusChip } from '../../ui';

export const Approvals: React.FC = () => {
  const { db, user, update } = usePortal();
  const today = todayIso();
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const queue = useMemo(
    () => (user ? db.leaveRequests.filter(r => canDecide(db, user, r)).sort((a, b) => a.from.localeCompare(b.from)) : []),
    [db, user]
  );
  const decided = useMemo(
    () => db.leaveRequests.filter(r => r.history.some(h => h.byUserId === user?.id && h.action !== 'APPLIED' && h.action !== 'CANCELLED')).slice(-10).reverse(),
    [db.leaveRequests, user]
  );

  const decide = (r: LeaveRequest, approve: boolean) => {
    if (!user) return;
    const remark = (remarks[r.id] || '').trim();
    if (!approve && !remark) return setError('Give a reason when rejecting.');
    setError(null);
    update(d => ({
      ...d,
      leaveRequests: d.leaveRequests.map(x => x.id !== r.id ? x : {
        ...x,
        status: approve ? statusAfterApproval(x.status) : 'REJECTED',
        history: [...x.history, {
          at: new Date().toISOString(), byUserId: user.id, byName: user.displayName,
          action: approve ? (x.status === 'PENDING_HOD' ? 'FORWARDED' : 'APPROVED') : 'REJECTED', remark
        }]
      })
    }));
  };

  const detail = (r: LeaveRequest) => {
    const p = db.personnel.find(x => x.id === r.personId);
    const t = db.leaveTypes.find(x => x.id === r.typeId);
    const bal = balances(db, r.personId, +r.from.slice(0, 4), today).find(b => b.typeId === r.typeId);
    const deptIds = new Set(db.personnel.filter(x => x.active && x.department === p?.department).map(x => x.id));
    const others = db.leaveRequests.filter(o => o.id !== r.id && deptIds.has(o.personId) && (o.status === 'APPROVED') && o.from <= r.to && r.from <= o.to).length;
    return { p, t, bal, others, head: deptIds.size };
  };

  return (
    <div className="space-y-6">
      {error && <div className="text-xs text-rose-400" role="alert">{error}</div>}
      <Card title={`Awaiting your decision (${queue.length})`}>
        {queue.length === 0 ? <Empty>Nothing is waiting for you.</Empty> : (
          <ul className="space-y-4">
            {queue.map(r => {
              const { p, t, bal, others, head } = detail(r);
              return (
                <li key={r.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-white">{p?.rank} {p?.name}</div>
                      <div className="text-[11px] text-slate-400">{p?.department}{p?.subDepartment ? ` · ${p.subDepartment}` : ''} · {p?.serviceNo}</div>
                    </div>
                    <StatusChip status={r.status} />
                  </div>
                  <div className="text-xs text-slate-300">
                    <span className="font-semibold">{t?.name}</span> · <span className="font-mono">{r.from} to {r.to} ({r.days} days)</span>
                    {r.reason && <div className="text-slate-400 mt-1">Reason: {r.reason}</div>}
                    {r.addressDuringLeave && <div className="text-slate-400">Contact: {r.addressDuringLeave}</div>}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {bal && (bal.available == null ? `${t?.name}: not capped` : `${t?.name}: ${bal.available} available before this request`)}
                    {' · '}{others} of {head} in {p?.department} already on approved leave in these dates
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input className={`${inputCls} flex-1 min-w-[12rem]`} placeholder="Remark (required to reject)" value={remarks[r.id] || ''} onChange={e => setRemarks({ ...remarks, [r.id]: e.target.value })} />
                    <button className={btnPrimary} onClick={() => decide(r, true)}>{r.status === 'PENDING_HOD' ? 'Recommend & forward' : 'Approve'}</button>
                    <button className={btnDanger} onClick={() => decide(r, false)}>Reject</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Your recent decisions">
        {decided.length === 0 ? <Empty>No decisions yet.</Empty> : (
          <ul className="divide-y divide-slate-800 text-xs">
            {decided.map(r => {
              const p = db.personnel.find(x => x.id === r.personId);
              return (
                <li key={r.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-200">{p?.rank} {p?.name} <span className="font-mono text-slate-500">{r.from} to {r.to}</span></span>
                  <StatusChip status={r.status} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};
