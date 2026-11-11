/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HolidayEntry, ScheduledSession, ScheduleSettings, Topic } from '../types';

/** Saved training state of one ship, as stored under its training key. */
export interface TrainingSaved {
  year: number;
  topics: Topic[];
  blackoutDates: HolidayEntry[];
  sessions: ScheduledSession[];
  settings: ScheduleSettings;
  lastSaved?: string;
}

/** Fired after training data is changed from outside the Training page; an open Training page reloads from storage. */
export const TRAINING_CHANGED = 'tushil:training-changed';

/** Null when nothing is saved or the saved text is unreadable. */
export function readTraining(key: string): Partial<TrainingSaved> | null {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

/**
 * Change saved training data from outside the Training page. Returns false, and writes nothing, when the
 * stored text cannot be read (so unreadable data is never replaced) or the browser refuses the save.
 */
export function patchTraining(key: string, change: (saved: Partial<TrainingSaved>) => Partial<TrainingSaved>): boolean {
  let current: Partial<TrainingSaved> = {};
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      current = JSON.parse(raw) ?? {};
    } catch {
      return false;
    }
  }
  try {
    localStorage.setItem(key, JSON.stringify({ ...current, ...change(current), lastSaved: new Date().toISOString() }));
  } catch {
    return false;
  }
  window.dispatchEvent(new CustomEvent(TRAINING_CHANGED, { detail: { key } }));
  return true;
}
