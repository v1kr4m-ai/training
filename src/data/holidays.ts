/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HolidayEntry } from '../types/index.ts';

const gh = (date: string, name: string, moon = false): HolidayEntry => ({
  date,
  name,
  type: 'PUBLIC_HOLIDAY',
  description: moon
    ? 'Gazetted holiday (Govt. of India 2026 list). Date follows moon sighting and may move by a day - confirm against the current Naval/Command order.'
    : 'Gazetted holiday (Govt. of India 2026 list).'
});

/**
 * Central Government gazetted holidays for 2026. Fixed-date holidays are certain;
 * moon-dependent ones are flagged and can be corrected in the Blackout Manager.
 */
export const DEFAULT_HOLIDAYS_2026: HolidayEntry[] = [
  gh('2026-01-26', 'Republic Day'),
  gh('2026-03-04', 'Holi', true),
  gh('2026-03-21', 'Id-ul-Fitr', true),
  gh('2026-03-26', 'Ram Navami', true),
  gh('2026-03-31', 'Mahavir Jayanti', true),
  gh('2026-04-03', 'Good Friday'),
  gh('2026-05-01', 'Buddha Purnima', true),
  gh('2026-05-27', 'Bakrid / Id-ul-Zuha', true),
  gh('2026-06-26', 'Muharram', true),
  gh('2026-08-15', 'Independence Day'),
  gh('2026-08-26', 'Milad-un-Nabi', true),
  gh('2026-09-04', 'Janmashtami', true),
  gh('2026-10-02', 'Mahatma Gandhi Jayanti'),
  gh('2026-10-20', 'Dussehra', true),
  gh('2026-11-08', 'Diwali', true),
  gh('2026-11-24', 'Guru Nanak Jayanti', true),
  gh('2026-12-25', 'Christmas Day')
];

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Good Friday = Easter Sunday - 2 days (anonymous Gregorian algorithm). */
export function goodFriday(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(y, month - 1, day, 12);
  easter.setDate(easter.getDate() - 2);
  return iso(easter.getFullYear(), easter.getMonth() + 1, easter.getDate());
}

/**
 * Holidays to start a year with. 2026 has the full gazetted list. Other years get only the dates that can be
 * computed (fixed national holidays and Good Friday); add Holi, Eid, Diwali etc. in the Blackout manager from that year's gazette.
 */
export function defaultHolidays(year: number): HolidayEntry[] {
  if (year === 2026) return DEFAULT_HOLIDAYS_2026;
  return [
    gh(iso(year, 1, 26), 'Republic Day'),
    gh(goodFriday(year), 'Good Friday'),
    gh(iso(year, 8, 15), 'Independence Day'),
    gh(iso(year, 10, 2), 'Mahatma Gandhi Jayanti'),
    gh(iso(year, 12, 25), 'Christmas Day')
  ];
}
