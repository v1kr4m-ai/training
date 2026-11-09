/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DeptEdit } from '../data/departments.ts';
import type { ShipProfile } from './ship.ts';

export type Role = 'ADMIN' | 'CO' | 'EXO' | 'HOD' | 'USER';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  CO: 'Commanding Officer',
  EXO: 'Executive Officer',
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

export type LeaveStatus =
  | 'PENDING_DO'
  | 'PENDING_HOD'
  | 'PENDING_EXO'
  | 'PENDING_CO'
  | 'PENDING_ADMIN'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

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
  /** Flagged when a sailor's leave is approved by the Executive Officer (EXO) to alert the Gunnery Office */
  gunneryNotified?: boolean;
}

export type NotificationType =
  | 'LEAVE_SUBMITTED'
  | 'LEAVE_FORWARDED'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'GUNNERY_NOTICE'
  | 'DAILY_ORDER_PUBLISHED';

export interface SystemNotification {
  id: string;
  createdAt: string; // ISO
  targetRole?: Role;
  targetPersonId?: string;
  targetDepartment?: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  type: NotificationType;
  fromName?: string;
}

export interface DepartmentLeaveForecastEntry {
  id: string;
  personId: string;
  department: string;
  subDepartment?: string;
  year: number;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  proposedFrom: string; // YYYY-MM-DD
  proposedTo: string;   // YYYY-MM-DD
  plannedDays: number;
  leaveTypeId: string;
  relieverName?: string;
  priority: 'NORMAL' | 'HIGH' | 'ESSENTIAL';
  remarks?: string;
  status: 'PLANNED' | 'CONFIRMED' | 'SUBMITTED_AS_LEAVE';
  updatedAt: string;
}

export interface PublishedDailyOrder {
  id: string;
  serialNo: string; // e.g. "DO/GUNNERY/2026/043"
  orderDate: string; // YYYY-MM-DD
  publishedAt: string; // ISO
  publishedBy: string; // Name & Designation
  shipName: string;
  pennant: string;
  routineState: string; // e.g. "Harbour Routine - Berth No. 4, Naval Dockyard"
  routines: Array<{ time: string; evolution: string; remarks?: string }>;
  selectedSessionIds: string[];
  trainingSessions: Array<{
    id: string;
    sequenceNumber: number;
    title: string;
    speaker: string;
    startTime: string;
    endTime?: string;
    department: string;
    location?: string;
    trackType?: string;
  }>;
  duties: {
    officerOfTheDay: string;
    dutyEngineerOfficer: string;
    dutyMedicalOfficer: string;
    quartermaster: string;
    pettyOfficerOfTheDay: string;
    dutyGunneryInstructor: string;
  };
  customFields?: Array<{ id: string; label: string; value: string }>;
  dressOfTheDay: string;
  specialDirectives: string;
  noticeBoardStatus: 'ACTIVE' | 'ARCHIVED';
}

export interface SpecialParty {
  id: string;
  name: string; // e.g., "Aviation Core Team", "Boarding & Search Party", "VBSS Team", "Harbour Emergency Fire Party"
  code: string; // e.g., "ACT", "VBSS"
  description: string;
  excuseFromWatchbill: boolean; // When true, members are automatically excused from routine watches & general stations
  memberPersonIds: string[];
}

export interface WatchStationAssignment {
  personId: string;
  watchDivision: 'PORT' | 'STARBOARD' | 'RED' | 'WHITE' | 'BLUE' | 'EXCUSED_SPECIAL';
  partOfShip: 'FORECASTLE' | 'TOP' | 'MAINTOP' | 'QUARTERDECK' | 'TECH_HQ' | 'FLIGHT_DECK';
  actionStation: string; // e.g., "Ops Room Radar Plot", "76mm SRGM Turret", "MCR Watch", "DCHQ-1 Repair Party"
  emergencyStation: string; // e.g., "Fire & Repair Party No. 1", "Liferaft Station No. 3"
  harbourWatchRole: string; // e.g., "Quartermaster", "Gangway Sentry", "Duty Tech Hand", "Duty Officer"
  specialPartyIds: string[];
  remarks?: string;
}

export interface DailyDutyRosterEntry {
  date: string; // YYYY-MM-DD
  mode: 'HARBOUR' | 'SEA';
  officerOfTheDayId: string;
  dutyEngineerOfficerId: string;
  dutyElectricalOfficerId: string;
  quartermasterId: string;
  pettyOfficerOfTheDayId: string;
  gangwaySentryId: string;
  dutyGunneryInstructorId: string;
  harbourFirePartyLeaderId: string;
  notes?: string;
  generatedAt: string;
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
  /** In-app system notifications for leave chain of command and daily order publication */
  notifications?: SystemNotification[];
  /** Manual or baseline availed leave records per personId -> typeId -> { days, remarks, updatedAt } */
  availedAdjustments?: Record<string, Record<string, { days: number; remarks?: string; updatedAt?: string }>>;
  /** Department leave forecast entries collated across personnel */
  leaveForecasts?: DepartmentLeaveForecastEntry[];
  /** Published Daily Orders displayed on ship digital notice board */
  dailyOrders?: PublishedDailyOrder[];
  /** Special parties (e.g. Aviation Core Team) that excuse members from routine Watch & Station Bill */
  specialParties?: SpecialParty[];
  /** Watch and Station Bill assignments keyed by personId */
  watchStationBill?: Record<string, WatchStationAssignment>;
  /** Daily Harbour & Sea Duty Rosters keyed by YYYY-MM-DD */
  dutyRosters?: Record<string, DailyDutyRosterEntry>;
}
