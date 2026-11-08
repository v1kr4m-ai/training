/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, '0');

/** HH:MM plus minutes, or null when it would reach midnight. */
export function addMinutes(start: string, mins: number): string | null {
  const e = toMin(start) + mins;
  return e >= 24 * 60 ? null : `${pad(Math.floor(e / 60))}:${pad(e % 60)}`;
}

/** Valid optional duration: a whole number of minutes, 1 to 1439. */
export const validDuration = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n < 24 * 60;

/** "13:45" or "13:45–14:45" when the session has an end. */
export const timeLabel = (s: { startTime: string; endTime?: string }) => (s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime);
