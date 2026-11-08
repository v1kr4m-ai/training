/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Db, LeaveRequest, LeaveStatus, Person, Role, User } from './types.ts';

const DAY = 86_400_000;
const toMs = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Inclusive number of calendar days; 0 if the range is invalid. */
export function daysBetween(from: string, to: string): number {
  if (!from || !to || to < from) return 0;
  return Math.round((toMs(to) - toMs(from)) / DAY) + 1;
}

/** Days of [from,to] that fall inside the given calendar year. */
export function daysInYear(from: string, to: string, year: number): number {
  const a = from > `${year}-01-01` ? from : `${year}-01-01`;
  const b = to < `${year}-12-31` ? to : `${year}-12-31`;
  return daysBetween(a, b);
}

export const isPending = (s: LeaveStatus) => s === 'PENDING_HOD' || s === 'PENDING_CO' || s === 'PENDING_ADMIN';

export interface Balance {
  typeId: string;
  typeName: string;
  entitled: number | null; // null = not capped
  availed: number;   // approved days up to and including `today`
  upcoming: number;  // approved days after `today`
  pending: number;   // days awaiting approval
  available: number | null; // entitled - availed - upcoming; null when not capped
}

/** Leave balance of one person for a calendar year, per leave type. */
export function balances(db: Db, personId: string, year: number, today: string): Balance[] {
  return db.leaveTypes.map(t => {
    let availed = 0, upcoming = 0, pending = 0;
    for (const r of db.leaveRequests) {
      if (r.personId !== personId || r.typeId !== t.id) continue;
      if (r.status === 'APPROVED') {
        const upTo = today < r.to ? (today < r.from ? '' : today) : r.to;
        if (upTo) availed += daysInYear(r.from, upTo, year);
        const after = today < r.from ? r.from : toIso(toMs(today) + DAY);
        if (after <= r.to) upcoming += daysInYear(after, r.to, year);
      } else if (isPending(r.status)) {
        pending += daysInYear(r.from, r.to, year);
      }
    }
    return {
      typeId: t.id,
      typeName: t.name,
      entitled: t.annualDays,
      availed,
      upcoming,
      pending,
      available: t.annualDays == null ? null : t.annualDays - availed - upcoming
    };
  });
}

/** Error text if the application cannot be accepted, else null. */
export function validateApplication(
  db: Db, personId: string, typeId: string, from: string, to: string, today: string, ignoreRequestId?: string
): string | null {
  if (!typeId || !db.leaveTypes.some(t => t.id === typeId)) return 'Choose a leave type.';
  if (!from || !to) return 'Enter the first and last day of leave.';
  if (to < from) return 'The last day is before the first day.';
  const clash = db.leaveRequests.find(r =>
    r.id !== ignoreRequestId && r.personId === personId && (r.status === 'APPROVED' || isPending(r.status)) && r.from <= to && from <= r.to);
  if (clash) return `Overlaps an existing ${clash.status === 'APPROVED' ? 'approved' : 'pending'} request (${clash.from} to ${clash.to}).`;
  const type = db.leaveTypes.find(t => t.id === typeId)!;
  if (type.annualDays != null) {
    for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) {
      const need = daysInYear(from, to, y);
      const bal = balances({ ...db, leaveRequests: db.leaveRequests.filter(r => r.id !== ignoreRequestId) }, personId, y, today)
        .find(b => b.typeId === typeId)!;
      const free = (bal.available ?? 0) - bal.pending;
      if (need > free) return `${type.name} ${y}: ${need} days requested but only ${Math.max(free, 0)} available (after pending requests).`;
    }
  }
  return null;
}

const userOfPerson = (db: Db, personId: string) => db.users.find(u => u.active && u.personId === personId);

/** First approval stage for an application, from who the applicant is. */
export function firstStatus(db: Db, person: Person): LeaveStatus {
  const role: Role = userOfPerson(db, person.id)?.role ?? 'USER';
  if (role === 'CO') return 'PENDING_ADMIN';
  if (role === 'HOD' || role === 'ADMIN') return 'PENDING_CO';
  // Personnel go to their department head; if the department has none, straight to the CO
  const hasHod = db.users.some(u => u.active && u.role === 'HOD' && u.personId &&
    db.personnel.find(p => p.id === u.personId)?.department === person.department);
  return hasHod ? 'PENDING_HOD' : 'PENDING_CO';
}

/** Can this user act on this request at its current stage? */
export function canDecide(db: Db, user: User, req: LeaveRequest): boolean {
  if (!user.active || user.personId === req.personId) return false;
  if (req.status === 'PENDING_CO') return user.role === 'CO';
  if (req.status === 'PENDING_ADMIN') return user.role === 'ADMIN';
  if (req.status === 'PENDING_HOD') {
    const applicant = db.personnel.find(p => p.id === req.personId);
    const me = db.personnel.find(p => p.id === user.personId);
    return user.role === 'HOD' && !!applicant && !!me && me.department === applicant.department;
  }
  return false;
}

/** Status after an approval at the current stage. */
export const statusAfterApproval = (s: LeaveStatus): LeaveStatus => (s === 'PENDING_HOD' ? 'PENDING_CO' : 'APPROVED');

/** Active personnel on approved leave (or approved/pending when includePending) on a date. */
export function onLeave(db: Db, date: string, includePending = false): LeaveRequest[] {
  return db.leaveRequests.filter(r => r.from <= date && date <= r.to && (r.status === 'APPROVED' || (includePending && isPending(r.status))));
}

export interface MonthForecast { month: number; approvedDays: number; pendingDays: number; peakOnLeave: number }

/** Person-days of leave per month of a year, and the highest number of people away on one day. */
export function monthlyForecast(db: Db, year: number): MonthForecast[] {
  const out: MonthForecast[] = Array.from({ length: 12 }, (_, m) => ({ month: m, approvedDays: 0, pendingDays: 0, peakOnLeave: 0 }));
  const perDay = new Map<string, number>();
  for (const r of db.leaveRequests) {
    if (r.status !== 'APPROVED' && !isPending(r.status)) continue;
    const a = r.from > `${year}-01-01` ? r.from : `${year}-01-01`;
    const b = r.to < `${year}-12-31` ? r.to : `${year}-12-31`;
    for (let ms = toMs(a); ms <= toMs(b) && a <= b; ms += DAY) {
      const d = toIso(ms), m = +d.slice(5, 7) - 1;
      if (r.status === 'APPROVED') out[m].approvedDays++; else out[m].pendingDays++;
      perDay.set(d, (perDay.get(d) || 0) + 1);
    }
  }
  perDay.forEach((n, d) => { const m = +d.slice(5, 7) - 1; if (n > out[m].peakOnLeave) out[m].peakOnLeave = n; });
  return out;
}

export interface Shortfall { department: string; from: string; to: string; peakPct: number; peakCount: number; headcount: number }

/** Date ranges where more than db.maxLeavePctPerDept of a department is on (approved or pending) leave. */
export function shortfalls(db: Db, from: string, to: string): Shortfall[] {
  const result: Shortfall[] = [];
  const depts = [...new Set(db.personnel.filter(p => p.active).map(p => p.department))];
  for (const department of depts) {
    const people = new Set(db.personnel.filter(p => p.active && p.department === department).map(p => p.id));
    const head = people.size;
    if (!head) continue;
    let open: Shortfall | null = null;
    for (let ms = toMs(from); ms <= toMs(to); ms += DAY) {
      const d = toIso(ms);
      const n = onLeave(db, d, true).filter(r => people.has(r.personId)).length;
      const pct = (n / head) * 100;
      if (pct > db.maxLeavePctPerDept) {
        if (!open) open = { department, from: d, to: d, peakPct: pct, peakCount: n, headcount: head };
        open.to = d;
        if (pct > open.peakPct) { open.peakPct = pct; open.peakCount = n; }
      } else if (open) { result.push(open); open = null; }
    }
    if (open) result.push(open);
  }
  return result;
}

/** Today as YYYY-MM-DD in the computer's local time. */
export function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
