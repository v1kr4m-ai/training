/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DeptEdit } from '../data/departments.ts';
import type { ShipProfile } from './ship.ts';

export type Role = 'ADMIN' | 'CO' | 'HOD' | 'USER';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  CO: 'Commanding Officer',
  HOD: 'Head of Department',
  USER: 'Personnel'
};

export type Category = 'Officer' | 'Sailor' | 'Civilian';

export interface Person {
  id: string;
  serviceNo: string;
  name: string;
  rank: string;
  designation: string; // appointment on board, optional
  category: Category;
  department: string;
  subDepartment: string;
  active: boolean;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  personId: string | null;
  salt: string;
  hash: string;
  active: boolean;
}

export interface LeaveType {
  id: string;
  name: string;
  /** Days per calendar year; null = tracked but not capped. */
  annualDays: number | null;
}

export type LeaveStatus = 'PENDING_HOD' | 'PENDING_CO' | 'PENDING_ADMIN' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveEvent {
  at: string; // ISO timestamp
  byUserId: string;
  byName: string;
  action: 'APPLIED' | 'APPROVED' | 'FORWARDED' | 'REJECTED' | 'CANCELLED';
  remark: string;
}

export interface LeaveRequest {
  id: string;
  personId: string;
  typeId: string;
  from: string; // YYYY-MM-DD, inclusive
  to: string;   // YYYY-MM-DD, inclusive
  days: number; // calendar days, inclusive
  reason: string;
  addressDuringLeave: string;
  status: LeaveStatus;
  history: LeaveEvent[];
  createdAt: string;
}

/** How one column of an import is set up for this ship. Anything not listed keeps its default. */
export interface FieldSetting { header?: string; enabled?: boolean; required?: boolean }
export type FieldSettings = Record<string, FieldSetting>;

/** Entries added by users, shared by everyone on this ship. The standard Navy ranks are built in. */
export interface ShipLists {
  ranks: Record<Category, string[]>;
  designations: string[];
}

export interface Db {
  version: 1;
  ship: ShipProfile;
  users: User[];
  personnel: Person[];
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequest[];
  /** Edited section lists; a department not present here uses its default list. */
  subDepartments: Record<string, string[]>;
  /** Edited department list; null = the standard departments. */
  departments: DeptEdit[] | null;
  lists: ShipLists;
  /** Column names and requirements of the Nominal Roll and Topic imports, so one sheet can be used by every department. */
  importFields: { roll: FieldSettings; topics: FieldSettings };
  /** Warn when more than this share of a department's active personnel is on leave on one day. */
  maxLeavePctPerDept: number;
}
