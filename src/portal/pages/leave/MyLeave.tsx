/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { balances, Balance, daysBetween, firstStatus, isPending, todayIso, validateApplication } from '../../leaveLogic';
import { newId } from '../../db';
import { usePortal } from '../../store';
import type { LeaveRequest, Person } from '../../types';
import { btnDanger, btnPrimary, Card, Empty, Field, inputCls, StatusChip } from '../../ui';

/** Stacked bar: taken / approved-upcoming / pending / still available. */
export const BalanceBar: React.FC<{ b: Balance }> = ({ b }) => {
  const total = b.entitled ?? Math.max(b.availed + b.upcoming + b.pending, 1);
  const pct = (n: number) => `${Math.min(100, (n / total) * 100)}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="font-semibold text-white">{b.typeName}</span>
        <span className="font-mono text-slate-400">
          {b.entitled == null ? `${b.availed + b.upcoming} days taken or approved` : `${b.available} of ${b.entitled} days available`}
        </span>
      </div>
      <div className="h-3 rounded-full bg-slate-800 overflow-hidden flex" role="img"
        aria-label={`${b.typeName}: ${b.availed} taken, ${b.upcoming} approved upcoming, ${b.pending} pending`}>
        <div className="bg-emerald-500" style={{ width: pct(b.availed) }} title={`Taken: ${b.availed}`} />
        <div className="bg-blue-500" style={{ width: pct(b.upcoming) }} title={`Approved, upcoming: ${b.upcoming}`} />
        <div className="bg-amber-500" style={{ width: pct(b.pending) }} title={`Pending: ${b.pending}`} />
      </div>
      <div className="flex gap-4 mt-1 text-[10px] text-slate-500 font-mono">
        <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 mr-1" />taken {b.availed}</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-500 mr-1" />approved {b.upcoming}</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-500 mr-1" />pending {b.pending}</span>
      </div>
    </div>
  );
};

export const MyLeave: React.FC = () => {
  const { db, user, me, update } = usePortal();
  const today = todayIso();
  const isAdmin = user?.role === 'ADMIN';
  const [forId, setForId] = useState<string>(me?.id || '');
  const person: Person | undefined = db.personnel.find(p => p.id === (isAdmin ? forId || me?.id : me?.id));

  const year = +today.slice(0, 4);
  const [typeId, setTypeId] = useState(db.leaveTypes[0]?.id || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const bal = useMemo(() => (person ? balances(db, person.id, year, today) : []), [db, person, year, today]);
  const mine = useMemo(() => db.leaveRequests.filter(r => r.personId === person?.id).sort((a, b) => b.from.localeCompare(a.from)), [db.leaveRequests, person]);
  const days = daysBetween(from, to);
  const live = person && from && to ? validateApplication(db, person.id, typeId, from, to, today) : null;

  if (!person) {
    return (
      <Card>
        <p className="text-xs text-slate-300">
          {isAdmin
            ? 'Your administrator account is not linked to anyone on the Nominal Roll. Pick the person to apply for or view below.'
            : 'Your login is not linked to a personnel record, so leave cannot be applied for. Ask the administrator to link it.'}
        </p>
        {isAdmin && (
          <select className={`${inputCls} mt-3 max-w-xs`} value={forId} onChange={e => setForId(e.target.value)}>
            <option value="">Choose person…</option>
            {db.personnel.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.rank} {p.name} ({p.serviceNo})</option>)}
          </select>
        )}
      </Card>
    );
  }

  const submit = () => {
    const problem = validateApplication(db, person.id, typeId, from, to, today);
    if (problem) return setError(problem);
    if (!user) return;
    const req: LeaveRequest = {
      id: newId(), personId: person.id, typeId, from, to, days, reason: reason.trim(), addressDuringLeave: address.trim(),
      status: firstStatus(db, person),
      history: [{ at: new Date().toISOString(), byUserId: user.id, byName: user.displayName, action: 'APPLIED', remark: person.id === me?.id ? '' : 'Applied on behalf by administrator' }],
      createdAt: new Date().toISOString()
    };
    update(d => ({ ...d, leaveRequests: [...d.leaveRequests, req] }));
    setFrom(''); setTo(''); setReason(''); setAddress(''); setError(null);
  };

  const cancel = (r: LeaveRequest) => {
    if (!user || !window.confirm('Cancel this leave request?')) return;
    update(d => ({
      ...d,
      leaveRequests: d.leaveRequests.map(x => x.id === r.id
        ? { ...x, status: 'CANCELLED', history: [...x.history, { at: new Date().toISOString(), byUserId: user.id, byName: user.displayName, action: 'CANCELLED', remark: '' }] }
        : x)
    }));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      <div className="xl:col-span-3 space-y-6">
        <Card title={`Leave balance ${year} · ${person.rank} ${person.name}`}>
          {isAdmin && (
            <select className={`${inputCls} mb-4 max-w-xs`} value={person.id} onChange={e => setForId(e.target.value)} aria-label="Person">
              {db.personnel.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.rank} {p.name} ({p.serviceNo})</option>)}
            </select>
          )}
          <div className="space-y-4">{bal.map(b => <BalanceBar key={b.typeId} b={b} />)}</div>
          <p className="text-[10px] text-slate-600 mt-3">Calendar-year balance. Days are counted inclusively, including Sundays and holidays.</p>
        </Card>

        <Card title="My requests">
          {mine.length === 0 ? <Empty>No leave requests yet.</Empty> : (
            <ul className="divide-y divide-slate-800">
              {mine.map(r => {
                const t = db.leaveTypes.find(x => x.id === r.typeId);
                return (
                  <li key={r.id} className="py-3 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-semibold text-white">{t?.name || 'Leave'}</span>
                        <span className="font-mono text-slate-400"> · {r.from} to {r.to} · {r.days} days</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusChip status={r.status} />
                        <button className="text-[11px] text-blue-400 hover:underline" onClick={() => setOpenId(openId === r.id ? null : r.id)}>{openId === r.id ? 'Hide' : 'History'}</button>
                        {(isPending(r.status) || (r.status === 'APPROVED' && r.from > today)) && <button className={btnDanger} onClick={() => cancel(r)}>Cancel</button>}
                      </div>
                    </div>
                    {openId === r.id && (
                      <ol className="text-[11px] text-slate-400 space-y-0.5 pl-3 border-l border-slate-800">
                        {r.history.map((h, i) => <li key={i}>{h.at.slice(0, 16).replace('T', ' ')} · {h.action.toLowerCase()} by {h.byName}{h.remark ? ` — ${h.remark}` : ''}</li>)}
                      </ol>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Apply for leave" className="xl:col-span-2 self-start">
        <div className="space-y-3">
          <Field label="Leave type">
            <select className={inputCls} value={typeId} onChange={e => setTypeId(e.target.value)}>
              {db.leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First day"><input type="date" className={inputCls} value={from} onChange={e => { setFrom(e.target.value); if (!to || to < e.target.value) setTo(e.target.value); }} /></Field>
            <Field label="Last day"><input type="date" className={inputCls} value={to} min={from} onChange={e => setTo(e.target.value)} /></Field>
          </div>
          {days > 0 && <div className="text-xs font-mono text-slate-300">{days} calendar day{days > 1 ? 's' : ''}</div>}
          <Field label="Reason"><textarea rows={2} className={inputCls} value={reason} onChange={e => setReason(e.target.value)} /></Field>
          <Field label="Address / contact during leave"><input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} /></Field>
          {(error || live) && <div className="text-xs text-rose-400" role="alert">{error || live}</div>}
          <p className="text-[11px] text-slate-500">
            Goes to: {from ? ({ PENDING_HOD: 'Head of Department, then Commanding Officer', PENDING_CO: 'Commanding Officer', PENDING_ADMIN: 'Administrator' } as Record<string, string>)[firstStatus(db, person)] : 'approval chain shown once dates are chosen'}.
          </p>
          <button className={`${btnPrimary} w-full justify-center`} disabled={!from || !to || !!live} onClick={submit}>Submit request</button>
        </div>
      </Card>
    </div>
  );
};
