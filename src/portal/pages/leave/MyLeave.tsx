/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { balances, Balance, daysBetween, firstStatus, isPending, todayIso, validateApplication, createLeaveNotification } from '../../leaveLogic';
import { newId } from '../../db';
import { usePortal } from '../../store';
import type { DepartmentLeaveForecastEntry, LeaveRequest, Person } from '../../types';
import { btnDanger, btnGhost, btnPrimary, Card, Empty, Field, inputCls, StatusChip } from '../../ui';
import { LeavePathStepper } from './LeavePathStepper';
import { CalendarPlus, Upload, ArrowRight, Trash2, CheckCircle2 } from 'lucide-react';

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

function inferQuarter(dateStr: string): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  const m = Number(dateStr.slice(5, 7)) || 1;
  if (m <= 3) return 'Q1';
  if (m <= 6) return 'Q2';
  if (m <= 9) return 'Q3';
  return 'Q4';
}

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

  // Individual Leave Forecast Plan states
  const [fcFrom, setFcFrom] = useState('');
  const [fcTo, setFcTo] = useState('');
  const [fcTypeId, setFcTypeId] = useState(db.leaveTypes[0]?.id || '');
  const [fcReliever, setFcReliever] = useState('');
  const [fcPriority, setFcPriority] = useState<'NORMAL' | 'HIGH' | 'ESSENTIAL'>('NORMAL');
  const [fcRemarks, setFcRemarks] = useState('');
  const [fcMsg, setFcMsg] = useState<string | null>(null);
  const fcFileRef = useRef<HTMLInputElement>(null);

  const bal = useMemo(() => (person ? balances(db, person.id, year, today) : []), [db, person, year, today]);
  const mine = useMemo(() => db.leaveRequests.filter(r => r.personId === person?.id).sort((a, b) => b.from.localeCompare(a.from)), [db.leaveRequests, person]);
  const myForecasts = useMemo(
    () => (db.leaveForecasts || []).filter(f => f.personId === person?.id).sort((a, b) => a.proposedFrom.localeCompare(b.proposedFrom)),
    [db.leaveForecasts, person]
  );

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
    const initialStatus = firstStatus(db, person);
    const leaveType = db.leaveTypes.find(t => t.id === typeId);
    const req: LeaveRequest = {
      id: newId(),
      personId: person.id,
      typeId,
      from,
      to,
      days,
      reason: reason.trim(),
      addressDuringLeave: address.trim(),
      status: initialStatus,
      history: [{
        at: new Date().toISOString(),
        byUserId: user.id,
        byName: user.displayName,
        action: 'APPLIED',
        remark: person.id === me?.id ? '' : 'Applied on behalf by administrator'
      }],
      createdAt: new Date().toISOString()
    };

    const notifs = createLeaveNotification(person, req, 'SUBMITTED', user.displayName, leaveType?.name);

    update(d => ({
      ...d,
      leaveRequests: [...d.leaveRequests, req],
      notifications: [...(d.notifications || []), ...notifs]
    }));
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

  const submitPersonalForecast = () => {
    if (!fcFrom || !fcTo || fcTo < fcFrom) return;
    const plannedDays = daysBetween(fcFrom, fcTo);
    const entry: DepartmentLeaveForecastEntry = {
      id: newId(),
      personId: person.id,
      department: person.department,
      subDepartment: person.subDepartment,
      year: Number(fcFrom.slice(0, 4)) || year,
      quarter: inferQuarter(fcFrom),
      proposedFrom: fcFrom,
      proposedTo: fcTo,
      plannedDays,
      leaveTypeId: fcTypeId || db.leaveTypes[0]?.id || '',
      relieverName: fcReliever.trim() || undefined,
      priority: fcPriority,
      remarks: fcRemarks.trim() || undefined,
      status: 'PLANNED',
      updatedAt: new Date().toISOString()
    };

    update(d => ({
      ...d,
      leaveForecasts: [...(d.leaveForecasts || []).filter(f => !(f.personId === person.id && f.proposedFrom === fcFrom)), entry]
    }));

    setFcFrom('');
    setFcTo('');
    setFcReliever('');
    setFcRemarks('');
    setFcMsg(`Added ${plannedDays}-day planned leave requirement (${entry.quarter}) to ${person.department} Forecast.`);
    setTimeout(() => setFcMsg(null), 4000);
  };

  const handleUploadPersonalForecastSheet = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        const added: DepartmentLeaveForecastEntry[] = [];

        rows.forEach(row => {
          const rawFrom = String(row['From'] || row['Proposed From'] || row['Start Date'] || '').trim().slice(0, 10);
          const rawTo = String(row['To'] || row['Proposed To'] || row['End Date'] || '').trim().slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(rawFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(rawTo) || rawTo < rawFrom) return;
          const typeStr = String(row['Leave Type'] || row['Type'] || '').toLowerCase();
          const matchedType = db.leaveTypes.find(t => t.name.toLowerCase().includes(typeStr)) || db.leaveTypes[0];
          const prioStr = String(row['Priority'] || 'NORMAL').toUpperCase();
          const priority: 'NORMAL' | 'HIGH' | 'ESSENTIAL' =
            prioStr === 'HIGH' || prioStr === 'ESSENTIAL' ? prioStr : 'NORMAL';

          added.push({
            id: newId(),
            personId: person.id,
            department: person.department,
            subDepartment: person.subDepartment,
            year: Number(rawFrom.slice(0, 4)) || year,
            quarter: inferQuarter(rawFrom),
            proposedFrom: rawFrom,
            proposedTo: rawTo,
            plannedDays: daysBetween(rawFrom, rawTo),
            leaveTypeId: matchedType?.id || '',
            relieverName: String(row['Reliever'] || '').trim() || undefined,
            priority,
            remarks: String(row['Remarks'] || row['Reason'] || '').trim() || undefined,
            status: 'PLANNED',
            updatedAt: new Date().toISOString()
          });
        });

        if (added.length > 0) {
          update(d => ({
            ...d,
            leaveForecasts: [...(d.leaveForecasts || []), ...added]
          }));
          setFcMsg(`Imported ${added.length} personal leave forecast requirement(s) into the Departmental Forecast.`);
          setTimeout(() => setFcMsg(null), 4500);
        }
      } catch (err) {
        console.error('Failed to parse personal leave forecast sheet:', err);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const removePersonalForecast = (id: string) => {
    update(d => ({
      ...d,
      leaveForecasts: (d.leaveForecasts || []).filter(f => f.id !== id)
    }));
  };

  const convertForecastToApplication = (f: DepartmentLeaveForecastEntry) => {
    setTypeId(f.leaveTypeId || db.leaveTypes[0]?.id || '');
    setFrom(f.proposedFrom);
    setTo(f.proposedTo);
    setReason(f.remarks || `As per approved ${f.quarter} Departmental Leave Forecast${f.relieverName ? ` (Reliever: ${f.relieverName})` : ''}`);
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

        {/* Individual Leave Forecast Submission & Upload Card */}
        <Card
          title={`My Annual Leave Forecast Plan (${person.department})`}
          actions={
            <div>
              <input
                type="file"
                ref={fcFileRef}
                onChange={handleUploadPersonalForecastSheet}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fcFileRef.current?.click()}
                className={`${btnGhost} flex items-center gap-1.5 text-[11px]`}
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>Upload My Forecast (.xlsx/.csv)</span>
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Submit your planned leave windows for the year so your Department Officer and HOD can collate the {person.department} Leave Forecast and de-conflict watchkeeping.
            </p>

            {fcMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{fcMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <Field label="Proposed From">
                <input
                  type="date"
                  className={inputCls}
                  value={fcFrom}
                  onChange={e => {
                    setFcFrom(e.target.value);
                    if (!fcTo || fcTo < e.target.value) setFcTo(e.target.value);
                  }}
                />
              </Field>
              <Field label="Proposed To">
                <input
                  type="date"
                  className={inputCls}
                  min={fcFrom}
                  value={fcTo}
                  onChange={e => setFcTo(e.target.value)}
                />
              </Field>
              <Field label="Leave Type">
                <select className={inputCls} value={fcTypeId} onChange={e => setFcTypeId(e.target.value)}>
                  {db.leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Proposed Reliever">
                <input
                  type="text"
                  placeholder="Rank & Name"
                  className={inputCls}
                  value={fcReliever}
                  onChange={e => setFcReliever(e.target.value)}
                />
              </Field>
              <Field label="Priority">
                <select
                  className={inputCls}
                  value={fcPriority}
                  onChange={e => setFcPriority(e.target.value as 'NORMAL' | 'HIGH' | 'ESSENTIAL')}
                >
                  <option value="NORMAL">Normal Routine</option>
                  <option value="HIGH">High Priority</option>
                  <option value="ESSENTIAL">Essential / Refit</option>
                </select>
              </Field>
              <Field label="Remarks / Occasion">
                <input
                  type="text"
                  placeholder="e.g. Annual home visit"
                  className={inputCls}
                  value={fcRemarks}
                  onChange={e => setFcRemarks(e.target.value)}
                />
              </Field>
              <div className="sm:col-span-3 flex items-center justify-between pt-1">
                <span className="text-[11px] font-mono text-slate-400">
                  {fcFrom && fcTo ? `${daysBetween(fcFrom, fcTo)} days (${inferQuarter(fcFrom)})` : 'Select dates to add to forecast'}
                </span>
                <button
                  type="button"
                  disabled={!fcFrom || !fcTo}
                  onClick={submitPersonalForecast}
                  className={`${btnPrimary} flex items-center gap-1.5`}
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>Add to My Leave Forecast</span>
                </button>
              </div>
            </div>

            {myForecasts.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  My Submitted Forecast Entries ({myForecasts.length})
                </div>
                <div className="divide-y divide-slate-800/70 border border-slate-800 rounded-xl overflow-hidden">
                  {myForecasts.map(f => {
                    const lt = db.leaveTypes.find(t => t.id === f.leaveTypeId);
                    return (
                      <div key={f.id} className="p-2.5 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-bold text-blue-300">{f.quarter}</span>
                          <span className="text-slate-600 mx-1.5">·</span>
                          <span className="font-semibold text-white">{lt?.name || 'Leave'}</span>
                          <span className="text-slate-600 mx-1.5">·</span>
                          <span className="font-mono text-slate-300">{f.proposedFrom} → {f.proposedTo} ({f.plannedDays}d)</span>
                          {f.relieverName && (
                            <span className="block text-[11px] text-slate-400 mt-0.5">
                              Reliever: {f.relieverName}{f.remarks ? ` · ${f.remarks}` : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => convertForecastToApplication(f)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>Apply Now</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePersonalForecast(f.id)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                            title="Remove forecast entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="My requests">
          {mine.length === 0 ? <Empty>No leave requests yet.</Empty> : (
            <ul className="divide-y divide-slate-800">
              {mine.map(r => {
                const t = db.leaveTypes.find(x => x.id === r.typeId);
                return (
                  <li key={r.id} className="py-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-semibold text-white">{t?.name || 'Leave'}</span>
                        <span className="font-mono text-slate-400"> · {r.from} to {r.to} · {r.days} days</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusChip status={r.status} />
                        <button className="text-[11px] text-blue-400 hover:underline" onClick={() => setOpenId(openId === r.id ? null : r.id)}>{openId === r.id ? 'Hide Path' : 'Route & History'}</button>
                        {(isPending(r.status) || (r.status === 'APPROVED' && r.from > today)) && <button className={btnDanger} onClick={() => cancel(r)}>Cancel</button>}
                      </div>
                    </div>

                    {/* Compact preview of tiered status */}
                    <LeavePathStepper applicant={person} status={r.status} history={r.history} gunneryNotified={r.gunneryNotified} compact={true} />

                    {openId === r.id && (
                      <div className="pt-2 space-y-3">
                        <LeavePathStepper applicant={person} status={r.status} history={r.history} gunneryNotified={r.gunneryNotified} compact={false} />
                        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                          <div className="font-semibold text-slate-300 mb-1">Approval Audit Log:</div>
                          <ol className="text-slate-400 space-y-1 pl-3 border-l border-slate-800">
                            {r.history.map((h, i) => <li key={i}>{h.at.slice(0, 16).replace('T', ' ')} · <strong className="text-slate-200">{h.action.toLowerCase()}</strong> by {h.byName}{h.remark ? ` — "${h.remark}"` : ''}</li>)}
                          </ol>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Apply for leave" className="xl:col-span-2 self-start">
        <div className="space-y-4">
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

          {/* Dynamic Tiered Command Route Stepper */}
          <div className="pt-2">
            <LeavePathStepper applicant={person} status={firstStatus(db, person)} compact={false} />
          </div>

          <button className={`${btnPrimary} w-full justify-center py-2.5`} disabled={!from || !to || !!live} onClick={submit}>Submit request</button>
        </div>
      </Card>
    </div>
  );
};
