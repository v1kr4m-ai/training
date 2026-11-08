/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DEPARTMENT_NAMES, getDepartmentConfig } from '../../../data/departments';
import { downloadBlob } from '../../../utils/exporters';
import { balances, daysInYear, monthlyForecast, onLeave, shortfalls, todayIso } from '../../leaveLogic';
import { usePortal } from '../../store';
import { btnGhost, Card, Empty, inputCls, StatusChip } from '../../ui';
import { BalanceBar } from './MyLeave';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const Forecast: React.FC = () => {
  const { db, user, me } = usePortal();
  const today = todayIso();
  const [year, setYear] = useState(+today.slice(0, 4));
  const [deptFilter, setDeptFilter] = useState('ALL');

  const role = user?.role;
  const seesNames = role === 'ADMIN' || role === 'CO' || role === 'HOD';
  // A head of department sees their own department; admin and CO see the whole ship.
  const scope = useMemo(() => {
    const active = db.personnel.filter(p => p.active);
    if (role === 'ADMIN' || role === 'CO') return active;
    if (role === 'HOD' && me) {
      const myDept = me.department;
      const mySubs = db.subDepartments[myDept] ?? DEPARTMENT_NAMES.find(d => d === myDept) ? [] : [];
      // simplified: HOD sees their dept + any explicitly listed sub-depts in store
      const visibleDepts = [myDept, ...(db.subDepartments[myDept] ?? [])];
      return active.filter(p => visibleDepts.includes(p.department));
    }
    if (me) return active.filter(p => p.department === me.department);
    return [];
  }, [db.personnel, role, me, db.subDepartments]);
  const scopeIds = useMemo(() => new Set(scope.map(p => p.id)), [scope]);
  const scoped = useMemo(() => ({ ...db, leaveRequests: db.leaveRequests.filter(r => scopeIds.has(r.personId)) }), [db, scopeIds]);

  const monthly = useMemo(() => monthlyForecast(scoped, year).map(m => ({ name: MONTHS[m.month], Approved: m.approvedDays, Pending: m.pendingDays, peak: m.peakOnLeave })), [scoped, year]);
  const warn = useMemo(() => shortfalls(scoped, `${year}-01-01`, `${year}-12-31`), [scoped, year]);
  const awayToday = useMemo(() => onLeave(scoped, today), [scoped, today]);

  const byDept = useMemo(() => DEPARTMENT_NAMES.map(name => {
    const ids = new Set(scope.filter(p => p.department === name).map(p => p.id));
    const dayCount = db.leaveRequests.filter(r => r.status === 'APPROVED' && ids.has(r.personId)).reduce((n, r) => n + daysInYear(r.from, r.to, year), 0);
    return { name, value: dayCount, color: getDepartmentConfig(name).color };
  }).filter(d => d.value > 0), [db.leaveRequests, scope, year]);

  const people = useMemo(
    () => scope.filter(p => deptFilter === 'ALL' || p.department === deptFilter).sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name)),
    [scope, deptFilter]
  );

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Personal Number', 'Name', 'Rank', 'Department', 'Leave type', 'From', 'To', 'Days', 'Status', 'Reason']];
    scoped.leaveRequests.filter(r => r.from.startsWith(String(year)) || r.to.startsWith(String(year))).forEach(r => {
      const p = db.personnel.find(x => x.id === r.personId);
      rows.push([p?.serviceNo, p?.name, p?.rank, p?.department, db.leaveTypes.find(t => t.id === r.typeId)?.name, r.from, r.to, r.days, r.status, r.reason].map(v => String(v ?? '')));
    });
    downloadBlob('﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n'), `leave_${year}.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate-400 flex items-center gap-2">Year
          <input type="number" className={`${inputCls} w-24`} value={year} min={2000} max={2100} onChange={e => e.target.value && setYear(+e.target.value)} />
        </label>
        <span className="text-xs text-slate-500">{role === 'HOD' && me ? `Showing ${me.department} & subordinates` : role === 'USER' && me ? `Showing ${me.department} department` : 'Showing the whole ship'} · approved and pending leave</span>
        {seesNames && <button className={`${btnGhost} ml-auto`} onClick={exportCsv}>Export CSV</button>}
      </div>

      {warn.length > 0 && (
        <Card title={`Manpower warnings (more than ${db.maxLeavePctPerDept}% of a department away)`}>
          <ul className="space-y-1 text-xs">
            {warn.slice(0, 12).map((w, i) => (
              <li key={i} className="text-amber-300">
                <span className="font-semibold">{w.department}</span> · {w.from === w.to ? w.from : `${w.from} to ${w.to}`} · up to {w.peakCount} of {w.headcount} away ({Math.round(w.peakPct)}%)
              </li>
            ))}
            {warn.length > 12 && <li className="text-slate-500">+{warn.length - 12} more</li>}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={`Leave forecast ${year} (person-days per month)`} className="lg:col-span-2">
          <div className="h-64" role="img" aria-label="Bar chart of approved and pending leave days per month">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Approved" stackId="a" fill="#10b981" />
                <Bar dataKey="Pending" stackId="a" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Highest number away on one day: {Math.max(0, ...monthly.map(m => m.peak))}</p>
        </Card>

        <Card title="Approved days by department">
          {byDept.length === 0 ? <Empty>No approved leave in {year}.</Empty> : (
            <div className="h-64" role="img" aria-label="Pie chart of approved leave days by department">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byDept} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {byDept.map(d => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card title={`On leave today (${awayToday.length})`}>
        {awayToday.length === 0 ? <Empty>No one is on approved leave today.</Empty> : seesNames ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {awayToday.map(r => {
              const p = db.personnel.find(x => x.id === r.personId);
              return <li key={r.id} className="px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800"><span className="text-slate-200">{p?.rank} {p?.name}</span><span className="block text-[10px] text-slate-500 font-mono">{p?.department} · until {r.to}</span></li>;
            })}
          </ul>
        ) : <p className="text-xs text-slate-300">{awayToday.length} on approved leave today.</p>}
      </Card>

      {seesNames && (
        <Card title="Leave balances by person" actions={
          <select className={`${inputCls} w-44`} value={deptFilter} onChange={e => setDeptFilter(e.target.value)} aria-label="Department filter">
            <option value="ALL">All departments</option>{DEPARTMENT_NAMES.map(d => <option key={d}>{d}</option>)}
          </select>}>
          {people.length === 0 ? <Empty>No personnel to show.</Empty> : (
            <div className="space-y-5 max-h-[32rem] overflow-y-auto pr-1">
              {people.map(p => {
                const bal = balances(db, p.id, year, today).filter(b => b.entitled != null);
                const pend = db.leaveRequests.filter(r => r.personId === p.id && (r.status.startsWith('PENDING'))).length;
                return (
                  <div key={p.id} className="space-y-2">
                    <div className="text-xs font-bold text-white">{p.rank} {p.name} <span className="font-normal text-slate-500">· {p.department}{pend ? ` · ${pend} pending` : ''}</span></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{bal.map(b => <BalanceBar key={b.typeId} b={b} />)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {seesNames && (
        <Card title="Requests">
          {scoped.leaveRequests.length === 0 ? <Empty>No leave requests.</Empty> : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase text-slate-400 border-b border-slate-800 sticky top-0 bg-slate-900"><tr><th className="py-2 pr-3">Person</th><th className="pr-3">Type</th><th className="pr-3">Dates</th><th className="pr-3">Days</th><th>Status</th></tr></thead>
                <tbody className="divide-y divide-slate-800/70">
                  {[...scoped.leaveRequests].sort((a, b) => b.from.localeCompare(a.from)).map(r => {
                    const p = db.personnel.find(x => x.id === r.personId);
                    return (
                      <tr key={r.id}>
                        <td className="py-2 pr-3 text-slate-200">{p?.rank} {p?.name}<span className="block text-[10px] text-slate-500">{p?.department}</span></td>
                        <td className="pr-3 text-slate-300">{db.leaveTypes.find(t => t.id === r.typeId)?.name}</td>
                        <td className="pr-3 font-mono text-slate-300">{r.from} → {r.to}</td>
                        <td className="pr-3 font-mono">{r.days}</td>
                        <td><StatusChip status={r.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
