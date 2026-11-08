/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Topic,
  ScheduledSession,
  ScheduleConflict,
  HolidayEntry,
  TrackType,
  DayUse,
  ScheduleSettings,
  MatrixMetrics
} from '../types/index.ts';
import { DEFAULT_SETTINGS, isTrainingDay, DAY_NAMES } from './settings.ts';
import { DEPARTMENT_NAMES, SHIP_WIDE } from '../data/departments.ts';
import { addMinutes, validDuration } from './time.ts';

/**
 * Format Date to YYYY-MM-DD in local calendar time
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD into a Date object at noon (to avoid UTC midnight timezone shifts)
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Check if a date string is a weekend (Saturday or Sunday)
 */
export function isWeekend(dateStr: string): boolean {
  const d = parseDate(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6; // 0=Sunday, 6=Saturday
}

/** What the given weekday is used for under the settings (null = not a training day). */
export function getExpectedTrackType(dayOfWeek: number, settings: ScheduleSettings = DEFAULT_SETTINGS): DayUse {
  return settings.days[dayOfWeek] ?? null;
}

/**
 * Next date that is a configured training day and not in the blackout/holiday list
 */
export function getNextValidWorkingDate(
  currentDate: Date, 
  blackoutDateSet: Set<string>,
  inclusive: boolean = false,
  settings: ScheduleSettings = DEFAULT_SETTINGS
): Date {
  const date = new Date(currentDate);
  if (!inclusive) {
    date.setDate(date.getDate() + 1);
  }

  // Cap guard to prevent infinite loop in case of bad configuration
  let attempts = 0;
  while (attempts < 365) {
    const dayOfWeek = date.getDay();
    const dateStr = formatDate(date);

    const isSatSun = !isTrainingDay(settings, dayOfWeek);
    const isHoliday = blackoutDateSet.has(dateStr);

    if (!isSatSun && !isHoliday) {
      return date;
    }

    date.setDate(date.getDate() + 1);
    attempts++;
  }

  return date;
}

/** Week of the year (1-53), counted in 7-day blocks from 1 January. */
export function weekOfYear(dateStr: string): number {
  const d = parseDate(dateStr);
  const start = new Date(d.getFullYear(), 0, 1, 12, 0, 0, 0);
  return Math.floor(Math.round((d.getTime() - start.getTime()) / 86400000) / 7) + 1;
}

/**
 * Every configured training day of `year` that is not a holiday/blackout, in order.
 * The count is whatever the calendar gives; nothing is padded.
 */
export function generateAnnualWorkingSlots(
  year: number,
  blackoutDates: HolidayEntry[],
  settings: ScheduleSettings = DEFAULT_SETTINGS
): Array<{ date: string; dayOfWeek: number; weekNumber: number; expectedTrack: Exclude<DayUse, null> }> {
  const blackoutSet = new Set(blackoutDates.map(h => h.date));
  const slots: Array<{ date: string; dayOfWeek: number; weekNumber: number; expectedTrack: Exclude<DayUse, null> }> = [];

  for (let d = new Date(year, 0, 1, 12); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const date = formatDate(d);
    const use = getExpectedTrackType(dayOfWeek, settings);
    if (!use || blackoutSet.has(date)) continue;
    slots.push({ date, dayOfWeek, weekNumber: weekOfYear(date), expectedTrack: use });
  }
  return slots;
}

/**
 * Detect cyclic dependencies in a list of topics using Kahn's algorithm
 */
export function detectTopicCycles(topics: Topic[]): { hasCycle: boolean; cycleTopicIds: string[] } {
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  topics.forEach(t => {
    adj.set(t.id, []);
    inDegree.set(t.id, 0);
  });

  topics.forEach(t => {
    if (t.prerequisiteId && adj.has(t.prerequisiteId)) {
      adj.get(t.prerequisiteId)!.push(t.id);
      inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
    }
  });

  const queue: string[] = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });

  let processedCount = 0;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    processedCount++;
    const neighbors = adj.get(curr) || [];
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  const hasCycle = processedCount < topics.length;
  const cycleTopicIds = hasCycle 
    ? Array.from(inDegree.entries()).filter(([_, deg]) => deg > 0).map(([id]) => id)
    : [];

  return { hasCycle, cycleTopicIds };
}


/**
 * Build the year's schedule from the topic list. Each topic is delivered once, on a training day whose track
 * fits it (per `settings`; a day set to "either" takes whichever track is further behind) and only after its prerequisite.
 * Departments with topics left take departmental slots in fair-share order (longest wait first).
 * A slot with no eligible topic stays empty: no filler sessions are invented.
 * Locked and Completed sessions keep their date, time and topic. Unplaceable topics are reported by findUnscheduledTopics.
 */
export function generateFullSchedule(
  year: number,
  topics: Topic[],
  blackoutDates: HolidayEntry[],
  existingSessions?: ScheduledSession[],
  settings: ScheduleSettings = DEFAULT_SETTINGS
): ScheduledSession[] {
  const slots = generateAnnualWorkingSlots(year, blackoutDates, settings);
  const locked = (existingSessions || []).filter(s => (s.isCustomLocked || s.status === 'Completed' || s.status === 'Skipped' || s.status === 'Rescheduled') && s.date.startsWith(`${year}-`));
  const lockedDates = new Set(locked.map(s => s.date));

  const scheduledTopicDates = new Map<string, string>();
  locked.forEach(s => scheduledTopicDates.set(s.topicId, s.date));

  const pending = topics.filter(t => !scheduledTopicDates.has(t.id));
  const cwPool = pending.filter(t => t.trackType === 'COMPANY_WIDE');
  const deptPool = new Map<string, Topic[]>();
  DEPARTMENT_NAMES.forEach(d => deptPool.set(d, pending.filter(t => t.trackType === 'DEPARTMENTAL' && t.department === d)));
  const wait = new Map<string, number>(DEPARTMENT_NAMES.map(d => [d, 0]));
  const cwTotal = cwPool.length;
  const deptTotal = [...deptPool.values()].reduce((n, p) => n + p.length, 0);
  const deptLeft = () => [...deptPool.values()].reduce((n, p) => n + p.length, 0);

  const eligible = (t: Topic, date: string) => {
    if (!t.prerequisiteId) return true;
    const pre = scheduledTopicDates.get(t.prerequisiteId);
    return !!pre && pre < date;
  };
  const take = (pool: Topic[], date: string): Topic | null => {
    const i = pool.findIndex(t => eligible(t, date));
    return i < 0 ? null : pool.splice(i, 1)[0];
  };
  const pickShipWide = (date: string) => {
    const topic = take(cwPool, date);
    return topic ? { topic, department: SHIP_WIDE } : null;
  };
  const pickDepartmental = (date: string) => {
    const order = DEPARTMENT_NAMES.filter(d => (deptPool.get(d) || []).length > 0)
      .sort((a, b) => (wait.get(b) || 0) - (wait.get(a) || 0));
    for (const department of order) {
      const topic = take(deptPool.get(department)!, date);
      if (topic) {
        DEPARTMENT_NAMES.forEach(d => wait.set(d, d === department ? 0 : (wait.get(d) || 0) + 1));
        return { topic, department };
      }
    }
    return null;
  };

  const generated: ScheduledSession[] = [];
  for (const slot of slots) {
    if (lockedDates.has(slot.date)) continue;

    let order = [pickShipWide, pickDepartmental];
    if (slot.expectedTrack === 'DEPARTMENTAL') order = [pickDepartmental];
    else if (slot.expectedTrack === 'COMPANY_WIDE') order = [pickShipWide];
    else {
      // either track: serve the one with the smaller share already placed
      const cwShare = cwTotal ? (cwTotal - cwPool.length) / cwTotal : 1;
      const deptShare = deptTotal ? (deptTotal - deptLeft()) / deptTotal : 1;
      if (deptShare < cwShare) order = [pickDepartmental, pickShipWide];
    }

    let pick: { topic: Topic; department: string } | null = null;
    for (const fn of order) { pick = fn(slot.date); if (pick) break; }
    if (!pick) continue;

    scheduledTopicDates.set(pick.topic.id, slot.date);
    generated.push(sessionFromTopic(pick.topic, year, slot.date, slot.dayOfWeek, pick.department, settings));
  }

  return [...locked, ...generated]
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .map((s, i) => ({ ...s, sequenceNumber: i + 1, id: `SESSION-${year}-${String(i + 1).padStart(3, '0')}`, weekNumber: weekOfYear(s.date) }));
}

function sessionFromTopic(
  t: Topic, year: number, date: string, dayOfWeek: number, department: string, settings: ScheduleSettings
): ScheduledSession {
  // a topic's own length wins over the default; with neither, the session has a start time only
  const mins = validDuration(t.durationMinutes) ? t.durationMinutes : validDuration(settings.durationMinutes) ? settings.durationMinutes : null;
  return {
    id: `SESSION-${year}-000`,
    sequenceNumber: 0,
    weekNumber: weekOfYear(date),
    dayOfWeek,
    date,
    startTime: settings.startTime,
    durationMinutes: mins,
    endTime: mins ? addMinutes(settings.startTime, mins) ?? '' : '',
    topicId: t.id,
    title: t.title,
    department,
    subDepartment: t.subDepartment,
    trackType: t.trackType,
    speaker: t.speaker,
    prerequisiteId: t.prerequisiteId,
    description: t.description,
    location: t.venue || '',
    status: 'Scheduled'
  };
}

/** Topics that have no session yet (prerequisite never placed, unknown department, cycle, or no free slot). */
export function findUnscheduledTopics(topics: Topic[], sessions: ScheduledSession[]): Topic[] {
  const used = new Set(sessions.map(s => s.topicId));
  return topics.filter(t => !used.has(t.id));
}

/**
 * Conflict Detection Engine: Audits schedule against all rules and returns conflicts
 */
export function auditScheduleConflicts(
  sessions: ScheduledSession[],
  blackoutDates: HolidayEntry[],
  topics: Topic[],
  settings: ScheduleSettings = DEFAULT_SETTINGS
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const blackoutMap = new Map<string, HolidayEntry>();
  blackoutDates.forEach(h => blackoutMap.set(h.date, h));

  const topicMap = new Map<string, Topic>();
  topics.forEach(t => topicMap.set(t.id, t));

  // Track session date by topic ID to evaluate DAG prerequisites
  const topicScheduledDates = new Map<string, { date: string; session: ScheduledSession }>();
  sessions.forEach(s => {
    // If a topic is scheduled multiple times, store the earliest date
    if (!topicScheduledDates.has(s.topicId)) {
      topicScheduledDates.set(s.topicId, { date: s.date, session: s });
    }
  });

  // Track date collisions (duplicate sessions on same date). Skipped and cancelled sessions are not held, so they never collide.
  const held = sessions.filter(s => s.status !== 'Skipped' && s.status !== 'Cancelled');
  const dateCounts = new Map<string, ScheduledSession[]>();
  held.forEach(s => {
    const list = dateCounts.get(s.date) || [];
    list.push(s);
    dateCounts.set(s.date, list);
  });

  // Department starvation tracker
  let lastDeptSeen = new Map<string, number>();
  DEPARTMENT_NAMES.forEach(d => lastDeptSeen.set(d, 0));

  held.forEach((s) => {
    const dateObj = parseDate(s.date);
    const dayOfWeek = dateObj.getDay();

    // 1. Weekend Collision
    // Weekend sessions are fine when the settings use that weekday for training.
    if ((dayOfWeek === 0 || dayOfWeek === 6) && !isTrainingDay(settings, dayOfWeek)) {
      conflicts.push({
        sessionId: s.id,
        sessionTitle: s.title,
        sessionDate: s.date,
        type: 'WEEKEND_COLLISION',
        severity: 'error',
        message: `Scheduled on a weekend (${dayOfWeek === 0 ? 'Sunday' : 'Saturday'}). Not a configured training day.`
      });
    }

    // 2. Holiday / Corporate Blackout Collision
    if (blackoutMap.has(s.date)) {
      const holiday = blackoutMap.get(s.date)!;
      conflicts.push({
        sessionId: s.id,
        sessionTitle: s.title,
        sessionDate: s.date,
        type: 'HOLIDAY_COLLISION',
        severity: 'error',
        message: `Collides with ${holiday.name} (${holiday.type.replace('_', ' ')}).`,
        details: {
          conflictingDate: s.date,
          holidayName: holiday.name
        }
      });
    }

    // 3. Slot Type Mismatch: only when the weekday is set to the other track. Days that are off in the
    // settings are allowed (a deliberate manual move), and 'either' days take both tracks.
    const expectedTrack = getExpectedTrackType(dayOfWeek, settings);
    if (expectedTrack && expectedTrack !== 'ANY' && s.trackType !== expectedTrack) {
      conflicts.push({
        sessionId: s.id,
        sessionTitle: s.title,
        sessionDate: s.date,
        type: 'SLOT_TYPE_MISMATCH',
        severity: 'warning',
        message: `${DAY_NAMES[dayOfWeek]} is set to ${expectedTrack === 'COMPANY_WIDE' ? 'ship-wide' : 'departmental'} sessions, but this one is ${s.trackType === 'COMPANY_WIDE' ? 'ship-wide' : 'departmental'}.`,
        details: {
          expectedSlotType: expectedTrack,
          actualSlotType: s.trackType
        }
      });
    }

    // 4. DAG Prerequisite Violation
    if (s.prerequisiteId) {
      const prereqInfo = topicScheduledDates.get(s.prerequisiteId);
      const prereqTopic = topicMap.get(s.prerequisiteId);
      const prereqTitle = prereqTopic ? prereqTopic.title : s.prerequisiteId;

      if (!prereqInfo) {
        conflicts.push({
          sessionId: s.id,
          sessionTitle: s.title,
          sessionDate: s.date,
          type: 'PREREQUISITE_VIOLATION',
          severity: 'error',
          message: `Required prerequisite "${prereqTitle}" is not scheduled anywhere in the curriculum.`,
          details: {
            prerequisiteId: s.prerequisiteId,
            prerequisiteTitle: prereqTitle
          }
        });
      } else if (prereqInfo.date >= s.date) {
        conflicts.push({
          sessionId: s.id,
          sessionTitle: s.title,
          sessionDate: s.date,
          type: 'PREREQUISITE_VIOLATION',
          severity: 'error',
          message: `Prerequisite "${prereqTitle}" is scheduled on ${prereqInfo.date}, which is on or after this session (${s.date}).`,
          details: {
            prerequisiteId: s.prerequisiteId,
            prerequisiteDate: prereqInfo.date,
            prerequisiteTitle: prereqTitle
          }
        });
      }
    }

    // 5. Same day: other sessions that day, and whether their time overlaps (same start counts when an end is not set)
    const sameDay = (dateCounts.get(s.date) || []).filter(o => o.id !== s.id);
    const overlapping = sameDay.filter(o => o.startTime === s.startTime || (o.endTime && s.endTime && o.startTime < s.endTime && s.startTime < o.endTime));
    if (overlapping.length > 0) {
      conflicts.push({
        sessionId: s.id,
        sessionTitle: s.title,
        sessionDate: s.date,
        type: 'DUPLICATE_DATE',
        severity: 'warning',
        message: `Overlaps ${overlapping.length} other session(s) on ${s.date} (${s.startTime}${s.endTime ? `-${s.endTime}` : ''}).`
      });
    } else if (sameDay.length > 0) {
      conflicts.push({
        sessionId: s.id,
        sessionTitle: s.title,
        sessionDate: s.date,
        type: 'DUPLICATE_DATE',
        severity: 'warning',
        message: `${sameDay.length} other session(s) on ${s.date}, at different times (more than one session on one day).`
      });
    }
  });

  return conflicts;
}

/**
 * Conflict Resolution Action 1: "Shift 1 Day"
 * Shifts a single session (and cascades forward any colliding subsequent sessions) by 1 working day.
 */
export function shiftSessionByOneWorkingDay(
  sessionId: string,
  sessions: ScheduledSession[],
  blackoutDates: HolidayEntry[],
  settings: ScheduleSettings = DEFAULT_SETTINGS
): ScheduledSession[] {
  const blackoutSet = new Set(blackoutDates.map(h => h.date));
  const targetIndex = sessions.findIndex(s => s.id === sessionId);
  if (targetIndex === -1) return sessions;

  const updatedSessions = [...sessions];
  const target = { ...updatedSessions[targetIndex] };

  // Calculate next valid business day for target
  const currDate = parseDate(target.date);
  const nextDateObj = getNextValidWorkingDate(currDate, blackoutSet, false, settings);
  const nextDateStr = formatDate(nextDateObj);

  target.date = nextDateStr;
  target.dayOfWeek = nextDateObj.getDay();
  updatedSessions[targetIndex] = target;

  // Cascade downstream dates if dates collide
  let lastAssignedDate = nextDateObj;
  for (let i = targetIndex + 1; i < updatedSessions.length; i++) {
    const s = { ...updatedSessions[i] };
    const sDate = parseDate(s.date);

    if (sDate <= lastAssignedDate) {
      // Must push forward to next available working slot
      const shifted = getNextValidWorkingDate(lastAssignedDate, blackoutSet, false, settings);
      s.date = formatDate(shifted);
      s.dayOfWeek = shifted.getDay();
      updatedSessions[i] = s;
      lastAssignedDate = shifted;
    } else {
      lastAssignedDate = sDate;
    }
  }

  return updatedSessions;
}

/**
 * Conflict Resolution Action 2: "Cascade Reschedule"
 * Recalculates clean dates across all sessions starting from start date or from a specific sequence,
 * skipping weekends and all blackouts/holidays, and topologically reordering prerequisite topics.
 */
export function cascadeReschedule(
  sessions: ScheduledSession[],
  blackoutDates: HolidayEntry[],
  topics: Topic[],
  fromSequenceNumber: number = 1,
  settings: ScheduleSettings = DEFAULT_SETTINGS
): ScheduledSession[] {
  if (sessions.length === 0) return sessions;
  const blackoutSet = new Set(blackoutDates.map(h => h.date));
  const updated = [...sessions];

  // Determine starting date
  let current: Date;
  if (fromSequenceNumber <= 1) {
    // Start from the first session's date or Jan of year
    current = parseDate(sessions[0].date);
  } else {
    const prev = sessions.find(s => s.sequenceNumber === fromSequenceNumber - 1);
    current = parseDate((prev || sessions[0]).date);
    current = getNextValidWorkingDate(current, blackoutSet, false, settings);
  }

  // Ensure current is valid working day
  current = getNextValidWorkingDate(current, blackoutSet, true, settings);

  const topicScheduledDates = new Map<string, string>();
  // Pre-seed earlier sessions before fromSequenceNumber
  for (let i = 0; i < fromSequenceNumber - 1; i++) {
    if (updated[i]) {
      topicScheduledDates.set(updated[i].topicId, updated[i].date);
    }
  }

  // Reschedule from target sequence to end
  for (let i = fromSequenceNumber - 1; i < updated.length; i++) {
    const s = { ...updated[i] };

    // Respect locked sessions if user explicitly locked it
    if (s.isCustomLocked) {
      topicScheduledDates.set(s.topicId, s.date);
      current = getNextValidWorkingDate(parseDate(s.date), blackoutSet, false, settings);
      continue;
    }

    // Keep each session on a weekday that belongs to its own track
    for (let guard = 0; guard < 370; guard++) {
      const use = getExpectedTrackType(current.getDay(), settings);
      if (use === 'ANY' || use === s.trackType) break;
      current = getNextValidWorkingDate(current, blackoutSet, false, settings);
    }
    const assignedDateStr = formatDate(current);
    s.date = assignedDateStr;
    s.dayOfWeek = current.getDay();
    s.weekNumber = weekOfYear(assignedDateStr);

    // Track topic date
    topicScheduledDates.set(s.topicId, assignedDateStr);

    updated[i] = s;

    // Advance to next valid business day
    current = getNextValidWorkingDate(current, blackoutSet, false, settings);
  }

  // Check if any prerequisite orders were violated by date shifts and re-sort downstream topics
  for (let i = 0; i < updated.length; i++) {
    const currentSession = updated[i];
    if (currentSession.prerequisiteId) {
      const prereqIdx = updated.findIndex(s => s.topicId === currentSession.prerequisiteId);
      if (prereqIdx > i && updated[prereqIdx].trackType === currentSession.trackType) {
        // only swap within the same track, otherwise a session would land on the wrong weekday
        // Swap topics between currentSession and prereq to restore DAG validity
        const prereqSession = updated[prereqIdx];
        
        // Swap topic details while preserving slot date
        const tempTopicId = currentSession.topicId;
        const tempTitle = currentSession.title;
        const tempDept = currentSession.department;
        const tempSubDept = currentSession.subDepartment;
        const tempSpeaker = currentSession.speaker;
        const tempPrereq = currentSession.prerequisiteId;
        const tempDesc = currentSession.description;
        const tempTrack = currentSession.trackType;
        const tempLoc = currentSession.location;

        currentSession.topicId = prereqSession.topicId;
        currentSession.title = prereqSession.title;
        currentSession.department = prereqSession.department;
        currentSession.subDepartment = prereqSession.subDepartment;
        currentSession.speaker = prereqSession.speaker;
        currentSession.prerequisiteId = prereqSession.prerequisiteId;
        currentSession.description = prereqSession.description;
        currentSession.trackType = prereqSession.trackType;
        currentSession.location = prereqSession.location;

        prereqSession.topicId = tempTopicId;
        prereqSession.title = tempTitle;
        prereqSession.department = tempDept;
        prereqSession.subDepartment = tempSubDept;
        prereqSession.speaker = tempSpeaker;
        prereqSession.prerequisiteId = tempPrereq;
        prereqSession.description = tempDesc;
        prereqSession.trackType = tempTrack;
        prereqSession.location = tempLoc;
      }
    }
  }

  return updated;
}

/**
 * Calculate executive metrics for the current matrix
 */
export function calculateMatrixMetrics(
  sessions: ScheduledSession[],
  conflicts: ScheduleConflict[]
): MatrixMetrics {
  const companyWideCount = sessions.filter(s => s.trackType === 'COMPANY_WIDE').length;
  const departmentalCount = sessions.filter(s => s.trackType === 'DEPARTMENTAL').length;
  const completedCount = sessions.filter(s => s.status === 'Completed').length;
  const uniqueTopics = new Set(sessions.map(s => s.topicId)).size;

  const errorConflicts = conflicts.filter(c => c.severity === 'error').length;
  const warningConflicts = conflicts.filter(c => c.severity === 'warning').length;

  // Calculate starvation gaps: maximum consecutive departmental slots where a department was unrepresented
  const starvationGaps = new Map<string, { currentGap: number; maxGap: number }>();
  DEPARTMENT_NAMES.forEach(d => starvationGaps.set(d, { currentGap: 0, maxGap: 0 }));

  let departmentalSlotIndex = 0;
  sessions.forEach(s => {
    if (s.trackType === 'DEPARTMENTAL') {
      departmentalSlotIndex++;
      DEPARTMENT_NAMES.forEach(dept => {
        const record = starvationGaps.get(dept)!;
        if (s.department === dept) {
          record.currentGap = 0;
        } else {
          record.currentGap++;
          if (record.currentGap > record.maxGap) {
            record.maxGap = record.currentGap;
          }
        }
      });
    }
  });

  let maxStarvationDays = 0;
  const starvationAlerts: Array<{ department: string; maxGapSessions: number }> = [];

  starvationGaps.forEach((val, dept) => {
    if (val.maxGap > maxStarvationDays) {
      maxStarvationDays = val.maxGap;
    }
    // Gaps over 8 slots indicate an anomaly in fair-share rotation
    if (val.maxGap > 8) {
      starvationAlerts.push({ department: dept, maxGapSessions: val.maxGap });
    }
  });

  return {
    totalSessions: sessions.length,
    companyWideCount,
    departmentalCount,
    conflictCount: conflicts.length,
    errorConflictCount: errorConflicts,
    warningConflictCount: warningConflicts,
    completedCount,
    uniqueTopicsCount: uniqueTopics,
    maxStarvationDays,
    starvationAlerts
  };
}
