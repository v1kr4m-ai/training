/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TrackType = 'COMPANY_WIDE' | 'DEPARTMENTAL';

/** What a weekday is used for: a track, 'ANY' (either track fits), or null (no training). Keys 0=Sun..6=Sat. */
export type DayUse = TrackType | 'ANY' | null;

export interface ScheduleSettings {
  days: Record<number, DayUse>;
  startTime: string; // HH:MM default start for generated sessions
  /** Default length in minutes. Optional: without it sessions have a start time only. */
  durationMinutes?: number | null;
}

export type SessionStatus = 'Scheduled' | 'Completed' | 'Skipped' | 'Rescheduled' | 'Postponed' | 'Cancelled';

/** One move of a session to a later date, kept so the history can be shown. */
export interface RescheduleEntry { at: string; from: string; to: string; reason: string }

export type ConflictSeverity = 'error' | 'warning' | 'info';

export type ConflictType = 
  | 'PREREQUISITE_VIOLATION' 
  | 'HOLIDAY_COLLISION' 
  | 'WEEKEND_COLLISION' 
  | 'SLOT_TYPE_MISMATCH' 
  | 'STARVATION_ANOMALY' 
  | 'DUPLICATE_DATE';

export interface Topic {
  id: string;
  title: string;
  department: string;
  subDepartment: string;
  trackType: TrackType;
  speaker: string;
  speakerRole?: string;
  venue?: string;
  /** Length in minutes; optional. */
  durationMinutes?: number;
  prerequisiteId?: string | null;
  description: string;
  learningOutcomes?: string[];
  tags?: string[];
  level?: 'Fundamental' | 'Intermediate' | 'Advanced' | 'Executive';
}

export interface ScheduledSession {
  id: string;
  sequenceNumber: number; // 1..n in date order
  weekNumber: number; // 1..53, 7-day blocks from 1 January
  dayOfWeek: number; // 0=Sun .. 6=Sat
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM, editable per session
  /** Length in minutes; optional. When set, endTime is start + duration. */
  durationMinutes?: number | null;
  /** HH:MM, or '' when the session has a start time only. */
  endTime: string;
  topicId: string;
  title: string;
  department: string;
  subDepartment: string;
  trackType: TrackType;
  speaker: string;
  prerequisiteId?: string | null;
  description: string;
  location: string;
  notes?: string;
  isCustomLocked?: boolean;
  /** The administrator saved this session knowing it conflicts with another or with a rule. */
  adminOverride?: boolean;
  rescheduledFrom?: RescheduleEntry[];
  status: SessionStatus;
}

export interface ScheduleConflict {
  sessionId: string;
  sessionTitle: string;
  sessionDate: string;
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  details?: {
    conflictingDate?: string;
    prerequisiteId?: string;
    prerequisiteDate?: string;
    prerequisiteTitle?: string;
    holidayName?: string;
    expectedSlotType?: TrackType;
    actualSlotType?: TrackType;
  };
}

export interface HolidayEntry {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'PUBLIC_HOLIDAY' | 'CORPORATE_BLACKOUT' | 'EXECUTIVE_OFFSITE';
  description?: string;
}

export interface DepartmentConfig {
  name: string;
  code: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  subDepartments: string[];
  description?: string;
}

export interface MatrixMetrics {
  totalSessions: number;
  companyWideCount: number;
  departmentalCount: number;
  conflictCount: number;
  errorConflictCount: number;
  warningConflictCount: number;
  completedCount: number;
  uniqueTopicsCount: number;
  maxStarvationDays: number;
  starvationAlerts: Array<{ department: string; maxGapSessions: number }>;
}

export type ActiveTab = 'DASHBOARD' | 'DEPARTMENTS' | 'ADMIN' | 'PUBLIC' | 'ANALYTICS';
