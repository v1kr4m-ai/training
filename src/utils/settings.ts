/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DayUse, ScheduleSettings } from '../types/index.ts';
import { addMinutes, validDuration } from './time.ts';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Starting point only; the user changes it in Schedule Settings. */
export const DEFAULT_SETTINGS: ScheduleSettings = {
  days: { 0: null, 1: 'COMPANY_WIDE', 2: 'DEPARTMENTAL', 3: 'DEPARTMENTAL', 4: 'COMPANY_WIDE', 5: 'DEPARTMENTAL', 6: null },
  startTime: '13:45',
  durationMinutes: null
};

export const isTrainingDay = (s: ScheduleSettings, dow: number) => s.days[dow] != null;

/** Error message, or null when the settings can be used. */
export function validateSettings(s: ScheduleSettings): string | null {
  if (!/^\d{2}:\d{2}$/.test(s.startTime)) return 'Enter the start time as HH:MM.';
  if (s.durationMinutes != null) {
    if (!validDuration(s.durationMinutes)) return 'Duration must be a whole number of minutes, or left empty.';
    if (addMinutes(s.startTime, s.durationMinutes) === null) return 'Start time plus duration must end before midnight.';
  }
  if (![0, 1, 2, 3, 4, 5, 6].some(d => s.days[d] != null)) return 'Pick at least one training day.';
  return null;
}

const list = (s: ScheduleSettings, use: DayUse) => [1, 2, 3, 4, 5, 6, 0].filter(d => s.days[d] === use).map(d => SHORT[d]).join('/');

/** e.g. "Mon/Thu ship-wide · Tue/Wed/Fri departmental". */
export function describeDays(s: ScheduleSettings): string {
  return ([['COMPANY_WIDE', 'ship-wide'], ['DEPARTMENTAL', 'departmental'], ['ANY', 'either track']] as const)
    .map(([use, label]) => (list(s, use) ? `${list(s, use)} ${label}` : ''))
    .filter(Boolean)
    .join(' · ');
}

export const describeTime = (s: ScheduleSettings) => `from ${s.startTime}${s.durationMinutes ? ` · ${s.durationMinutes} min` : ''}`;

/** Merge saved settings with defaults so a missing/old field never breaks the app. */
export function normalizeSettings(raw: unknown): ScheduleSettings {
  const r = raw as Partial<ScheduleSettings> | null;
  if (!r || typeof r !== 'object' || !r.days) return DEFAULT_SETTINGS;
  const days: Record<number, DayUse> = {};
  for (let d = 0; d < 7; d++) {
    const v = (r.days as Record<number, unknown>)[d];
    days[d] = v === 'COMPANY_WIDE' || v === 'DEPARTMENTAL' || v === 'ANY' ? v : null;
  }
  // an older saved fixed end time is dropped: sessions now have a start time and an optional duration
  const merged: ScheduleSettings = { days, startTime: r.startTime || DEFAULT_SETTINGS.startTime, durationMinutes: validDuration(r.durationMinutes) ? r.durationMinutes : null };
  return validateSettings(merged) ? DEFAULT_SETTINGS : merged;
}
