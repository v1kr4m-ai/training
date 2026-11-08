/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { blankShip, type ShipProfile } from './ship.ts';
import type { Db } from './types.ts';

/**
 * Starting leave types. The yearly day counts are editable defaults (Leave > Settings);
 * set them to match the current leave regulations. null = tracked, not capped.
 */
export function emptyDb(ship: ShipProfile = blankShip('', '')): Db {
  return {
    version: 1,
    ship,
    users: [],
    personnel: [],
    leaveTypes: [
      { id: 'annual', name: 'Annual Leave', annualDays: 60 },
      { id: 'casual', name: 'Casual Leave', annualDays: 30 },
      { id: 'sick', name: 'Sick Leave', annualDays: null },
      { id: 'special', name: 'Special Leave', annualDays: null }
    ],
    leaveRequests: [],
    subDepartments: {},
    departments: null,
    lists: { ranks: { Officer: [], Sailor: [], Civilian: [] }, designations: [] },
    importFields: { roll: {}, topics: {} },
    maxLeavePctPerDept: 25
  };
}

/** Accept only a structurally valid saved object; anything else falls back to an empty database. */
export function parseDb(raw: string | null, ship?: ShipProfile): Db {
  if (!raw) return emptyDb(ship);
  try {
    const d = JSON.parse(raw) as Partial<Db>;
    const base = emptyDb(ship);
    if (d.version !== 1 || !Array.isArray(d.users) || !Array.isArray(d.personnel) || !Array.isArray(d.leaveRequests)) return base;
    return {
      ...base,
      ...d,
      ship: d.ship && typeof d.ship === 'object' && typeof d.ship.name === 'string' ? { ...base.ship, ...d.ship } : base.ship,
      leaveTypes: Array.isArray(d.leaveTypes) && d.leaveTypes.length ? d.leaveTypes : base.leaveTypes,
      subDepartments: d.subDepartments && typeof d.subDepartments === 'object' ? d.subDepartments : {},
      departments: Array.isArray(d.departments) && d.departments.length ? d.departments : null,
      lists: {
        ranks: { ...base.lists.ranks, ...(d.lists?.ranks || {}) },
        designations: Array.isArray(d.lists?.designations) ? d.lists!.designations : []
      },
      importFields: { roll: d.importFields?.roll || {}, topics: d.importFields?.topics || {} },
      maxLeavePctPerDept: typeof d.maxLeavePctPerDept === 'number' ? d.maxLeavePctPerDept : base.maxLeavePctPerDept
    } as Db;
  } catch {
    return emptyDb(ship);
  }
}

export const newId = () => globalThis.crypto.randomUUID();
