/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Db, LeaveRequest, LeaveStatus, Person, Role, User, SystemNotification, DepartmentLeaveForecastEntry } from './types.ts';

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

export const isPending = (s: LeaveStatus) =>
  s === 'PENDING_DO' || s === 'PENDING_HOD' || s === 'PENDING_EXO' || s === 'PENDING_CO' || s === 'PENDING_ADMIN';

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
    // Include baseline or manual availed adjustments recorded on the person's record
    const manualAvailed = db.availedAdjustments?.[personId]?.[t.id]?.days ?? 0;
    const totalAvailed = availed + manualAvailed;

    return {
      typeId: t.id,
      typeName: t.name,
      entitled: t.annualDays,
      availed: totalAvailed,
      upcoming,
      pending,
      available: t.annualDays == null ? null : Math.max(0, t.annualDays - totalAvailed - upcoming)
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

/** 
 * Naval approval chain:
 * - Sailor: Section Officer / Department Officer (DO) -> HOD -> EXO (Executive Officer) -> Approved -> Notification to Gunnery Office
 * - Officer: HOD -> Commanding Officer (CO) -> Approved
 * - HOD / EXO: Commanding Officer (CO) -> Approved
 * - CO: Administrator -> Approved
 */
export function firstStatus(db: Db, person: Person): LeaveStatus {
  const user = userOfPerson(db, person.id);
  const role: Role = user?.role ?? 'USER';
  const designation = (person.designation || '').toLowerCase();

  if (role === 'CO' || designation.includes('commanding officer')) return 'PENDING_ADMIN';
  if (role === 'HOD' || role === 'EXO' || designation.includes('head of department') || designation.includes('executive officer')) {
    return 'PENDING_CO';
  }

  // Officer leave goes to HOD, then from HOD to CO
  if (person.category === 'Officer') {
    const hasHod = db.users.some(u => u.active && u.role === 'HOD' && u.personId &&
      db.personnel.find(p => p.id === u.personId)?.department === person.department);
    return hasHod ? 'PENDING_HOD' : 'PENDING_CO';
  }

  // Sailor leave goes to Section Officer / Department Officer
  return 'PENDING_DO';
}

/** Can this user act on this request at its current stage? */
export function canDecide(db: Db, user: User, req: LeaveRequest): boolean {
  if (!user.active || user.personId === req.personId) return false;
  if (user.role === 'ADMIN') return true; // Administrator can act at any level

  const applicant = db.personnel.find(p => p.id === req.personId);
  const me = db.personnel.find(p => p.id === user.personId);
  const userDesignation = (me?.designation || '').toLowerCase();

  if (req.status === 'PENDING_CO') {
    return user.role === 'CO' || userDesignation.includes('commanding officer');
  }

  if (req.status === 'PENDING_ADMIN') {
    return false;
  }

  if (req.status === 'PENDING_EXO') {
    return user.role === 'EXO' || userDesignation.includes('executive officer') || userDesignation.includes('exo');
  }

  if (req.status === 'PENDING_HOD') {
    return user.role === 'HOD' && !!applicant && !!me && me.department === applicant.department;
  }

  if (req.status === 'PENDING_DO') {
    // Section Officer or Department Officer: Officer belonging to the same department
    return !!applicant && !!me && me.department === applicant.department && me.category === 'Officer';
  }

  return false;
}

export interface ApprovalStepResult {
  nextStatus: LeaveStatus;
  gunneryNotified: boolean;
  actionDescription: string;
}

/** 
 * Status progression after an approval:
 * - Sailor: PENDING_DO -> PENDING_HOD -> PENDING_EXO -> APPROVED (and triggers Gunnery Office notification)
 * - Officer: PENDING_HOD -> PENDING_CO -> APPROVED
 */
export function getApprovalStepResult(status: LeaveStatus, person?: Person | null): ApprovalStepResult {
  if (status === 'PENDING_DO') {
    return {
      nextStatus: 'PENDING_HOD',
      gunneryNotified: false,
      actionDescription: 'Recommended by Department Officer; forwarded to Head of Department (HOD)'
    };
  }

  if (status === 'PENDING_HOD') {
    if (person?.category === 'Sailor') {
      return {
        nextStatus: 'PENDING_EXO',
        gunneryNotified: false,
        actionDescription: 'Recommended by HOD; forwarded to Executive Officer (EXO)'
      };
    }
    return {
      nextStatus: 'PENDING_CO',
      gunneryNotified: false,
      actionDescription: 'Recommended by HOD; forwarded to Commanding Officer (CO)'
    };
  }

  if (status === 'PENDING_EXO') {
    return {
      nextStatus: 'APPROVED',
      gunneryNotified: true,
      actionDescription: 'Approved by Executive Officer (EXO). Notification dispatched to Gunnery Office.'
    };
  }

  if (status === 'PENDING_CO' || status === 'PENDING_ADMIN') {
    return {
      nextStatus: 'APPROVED',
      gunneryNotified: false,
      actionDescription: 'Approved by Commanding Officer'
    };
  }

  return {
    nextStatus: 'APPROVED',
    gunneryNotified: false,
    actionDescription: 'Approved'
  };
}

/** Backward-compatible signature returning next LeaveStatus */
export function statusAfterApproval(s: LeaveStatus, person?: Person | null): LeaveStatus {
  return getApprovalStepResult(s, person).nextStatus;
}

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

export interface ApprovalStepInfo {
  step: number;
  label: string;
  role: Role | 'DO';
  statusMatch: LeaveStatus;
  description: string;
  isGunneryAlert?: boolean;
}

/**
 * Returns the exact tiered naval approval chain for a person based on Category & Designation:
 * - Sailor: Section Officer -> Dept Officer -> HOD -> EXO -> Gunnery Office Notified
 * - Officer: HOD -> CO
 * - HOD: CO
 */
export function getApprovalRoute(applicant: Person): ApprovalStepInfo[] {
  const isSailor = applicant.category === 'Sailor';
  const designation = (applicant.designation || '').toLowerCase();
  const isHod = designation.includes('hod') || designation.includes('head of department') || designation.includes('officer-in-charge');
  const isExo = designation.includes('executive officer') || designation.includes('exo');

  if (isSailor) {
    return [
      {
        step: 1,
        label: 'Section Officer',
        role: 'DO',
        statusMatch: 'PENDING_DO',
        description: 'First review by divisional/section officer'
      },
      {
        step: 2,
        label: 'Dept Officer',
        role: 'DO',
        statusMatch: 'PENDING_DO',
        description: 'Recommendation by Department Officer (DO)'
      },
      {
        step: 3,
        label: 'Head of Dept (HOD)',
        role: 'HOD',
        statusMatch: 'PENDING_HOD',
        description: 'Departmental endorsement by Head of Department'
      },
      {
        step: 4,
        label: 'Executive Officer (EXO)',
        role: 'EXO',
        statusMatch: 'PENDING_EXO',
        description: 'Final sanction & authority by Executive Officer',
        isGunneryAlert: true
      }
    ];
  }

  if (isHod || isExo) {
    return [
      {
        step: 1,
        label: 'Commanding Officer (CO)',
        role: 'CO',
        statusMatch: 'PENDING_CO',
        description: 'Direct sanction by Commanding Officer'
      }
    ];
  }

  // General Officer route
  return [
    {
      step: 1,
      label: 'Head of Dept (HOD)',
      role: 'HOD',
      statusMatch: 'PENDING_HOD',
      description: 'Recommendation by Head of Department'
    },
    {
      step: 2,
      label: 'Commanding Officer (CO)',
      role: 'CO',
      statusMatch: 'PENDING_CO',
      description: 'Final sanction by Commanding Officer'
    }
  ];
}

/** Creates a system notification for the next authority in the tiered leave chain */
export function createLeaveNotification(
  applicant: Person,
  req: LeaveRequest,
  action: 'SUBMITTED' | 'FORWARDED' | 'APPROVED' | 'REJECTED',
  actorName?: string,
  leaveTypeName?: string
): SystemNotification[] {
  const notifications: SystemNotification[] = [];
  const now = new Date().toISOString();
  const randomSuffix = Math.random().toString(36).slice(2, 7);
  const typeLabel = leaveTypeName || 'Leave';

  if (action === 'SUBMITTED') {
    // Notify next authority based on initial status
    if (req.status === 'PENDING_DO') {
      notifications.push({
        id: `notif-${Date.now()}-${randomSuffix}`,
        createdAt: now,
        targetDepartment: applicant.department,
        targetRole: 'USER',
        title: `New Leave Request: ${applicant.rank} ${applicant.name}`,
        message: `${applicant.rank} ${applicant.name} (${applicant.department}/${applicant.subDepartment}) applied for ${req.days} days ${typeLabel} (${req.from} to ${req.to}). Awaiting Section/Dept Officer recommendation.`,
        link: 'leave',
        read: false,
        type: 'LEAVE_SUBMITTED',
        fromName: applicant.name
      });
      // Also notify HOD of incoming departmental application
      notifications.push({
        id: `notif-${Date.now()}-${randomSuffix}-hod`,
        createdAt: now,
        targetDepartment: applicant.department,
        targetRole: 'HOD',
        title: `Dept Leave Alert: ${applicant.rank} ${applicant.name}`,
        message: `${applicant.rank} ${applicant.name} submitted ${req.days} days ${typeLabel}. Under initial review by Section Officer.`,
        link: 'leave',
        read: false,
        type: 'LEAVE_SUBMITTED',
        fromName: applicant.name
      });
    } else if (req.status === 'PENDING_HOD') {
      notifications.push({
        id: `notif-${Date.now()}-${randomSuffix}`,
        createdAt: now,
        targetDepartment: applicant.department,
        targetRole: 'HOD',
        title: `Officer Leave Request: ${applicant.rank} ${applicant.name}`,
        message: `${applicant.rank} ${applicant.name} (${applicant.department}) applied for ${req.days} days ${typeLabel} (${req.from} to ${req.to}). Awaiting HOD recommendation.`,
        link: 'leave',
        read: false,
        type: 'LEAVE_SUBMITTED',
        fromName: applicant.name
      });
    } else if (req.status === 'PENDING_CO') {
      notifications.push({
        id: `notif-${Date.now()}-${randomSuffix}`,
        createdAt: now,
        targetRole: 'CO',
        title: `Leave Application: ${applicant.rank} ${applicant.name}`,
        message: `${applicant.rank} ${applicant.name} (${applicant.department}) submitted leave request for ${req.days} days ${typeLabel}. Awaiting CO sanction.`,
        link: 'leave',
        read: false,
        type: 'LEAVE_SUBMITTED',
        fromName: applicant.name
      });
    }
  } else if (action === 'FORWARDED') {
    // Notify next authority based on current forwarded status
    if (req.status === 'PENDING_HOD') {
      notifications.push({
        id: `notif-${Date.now()}-${randomSuffix}`,
        createdAt: now,
        targetDepartment: applicant.department,
        targetRole: 'HOD',
        title: `Leave Forwarded to HOD: ${applicant.rank} ${applicant.name}`,
        message: `Recommended by ${actorName || 'Dept Officer'}. Awaiting Head of Department endorsement.`,
        link: 'leave',
        read: false,
        type: 'LEAVE_FORWARDED',
        fromName: actorName
      });
    } else if (req.status === 'PENDING_EXO') {
      notifications.push({
        id: `notif-${Date.now()}-${randomSuffix}`,
        createdAt: now,
        targetRole: 'EXO',
        title: `Sailor Leave for EXO Sanction: ${applicant.rank} ${applicant.name}`,
        message: `Endorsed by HOD (${applicant.department}). Awaiting Executive Officer final approval.`,
        link: 'leave',
        read: false,
        type: 'LEAVE_FORWARDED',
        fromName: actorName
      });
    } else if (req.status === 'PENDING_CO') {
      notifications.push({
        id: `notif-${Date.now()}-${randomSuffix}`,
        createdAt: now,
        targetRole: 'CO',
        title: `Officer Leave for CO Sanction: ${applicant.rank} ${applicant.name}`,
        message: `Endorsed by HOD (${applicant.department}). Awaiting Commanding Officer sanction.`,
        link: 'leave',
        read: false,
        type: 'LEAVE_FORWARDED',
        fromName: actorName
      });
    }
  } else if (action === 'APPROVED') {
    // Notify applicant
    notifications.push({
      id: `notif-${Date.now()}-${randomSuffix}-appr`,
      createdAt: now,
      targetPersonId: applicant.id,
      title: `Leave Approved: ${req.from} to ${req.to}`,
      message: `Your ${typeLabel} request for ${req.days} days has received final approval by ${actorName || 'Command'}.`,
      link: 'leave',
      read: false,
      type: 'LEAVE_APPROVED',
      fromName: actorName
    });

    // If sailor, send special notification to Gunnery Office
    if (applicant.category === 'Sailor' || req.gunneryNotified) {
      notifications.push({
        id: `notif-${Date.now()}-${randomSuffix}-gunnery`,
        createdAt: now,
        targetDepartment: 'Executive',
        title: `Gunnery Office Alert: Sailor on Leave`,
        message: `${applicant.rank} ${applicant.name} (${applicant.department}/${applicant.subDepartment}) approved by EXO for leave from ${req.from} to ${req.to} (${req.days} days). Updated in Daily Orders record.`,
        link: 'daily-orders',
        read: false,
        type: 'GUNNERY_NOTICE',
        fromName: 'Executive Officer'
      });
    }
  } else if (action === 'REJECTED') {
    notifications.push({
      id: `notif-${Date.now()}-${randomSuffix}-rej`,
      createdAt: now,
      targetPersonId: applicant.id,
      title: `Leave Request Not Approved`,
      message: `Your ${typeLabel} request for ${req.from} to ${req.to} was not approved by ${actorName || 'Authority'}.`,
      link: 'leave',
      read: false,
      type: 'LEAVE_REJECTED',
      fromName: actorName
    });
  }

  return notifications;
}
