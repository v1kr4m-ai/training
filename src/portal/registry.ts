/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TUSHIL_ID } from './tushilSeed.ts';

/** Light record per ship, enough to list and switch. Everything else lives in that ship's own database. */
export interface ShipRef { id: string; name: string; pennant: string }
export interface Registry { ships: ShipRef[]; activeId: string }

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const REGISTRY_KEY = 'TUSHIL_PORTAL_SHIPS_V1';
export const dbKey = (id: string) => `TUSHIL_PORTAL_DB_V1:${id}`;
export const sessionKey = (id: string) => `TUSHIL_PORTAL_SESSION:${id}`;
export const trainingKey = (id: string) => `TUSHIL_TRAINING_STATE_V1:${id}`;

// keys used before ships existed (single-ship version)
const LEGACY_DB = 'TUSHIL_PORTAL_DB_V1';
const LEGACY_TRAINING = 'ANNUAL_TRAINING_MATRIX_STATE_V1';

export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ship';

/** Unused id derived from the ship's name. */
export function uniqueId(name: string, taken: string[]): string {
  const base = slugify(name);
  let id = base, n = 2;
  while (taken.includes(id)) id = `${base}-${n++}`;
  return id;
}

export function saveRegistry(store: Store, r: Registry) {
  store.setItem(REGISTRY_KEY, JSON.stringify(r));
}

/**
 * Read the ship list. First start: INS Tushil is created as the first ship, and any data saved by the
 * single-ship version is moved under it.
 */
export function loadRegistry(store: Store): Registry {
  try {
    const r = JSON.parse(store.getItem(REGISTRY_KEY) || 'null') as Registry | null;
    if (r && Array.isArray(r.ships) && r.ships.length > 0 && r.ships.some(s => s.id === r.activeId)) return r;
  } catch { /* fall through to a fresh registry */ }

  const first: ShipRef = { id: TUSHIL_ID, name: 'INS Tushil', pennant: 'F70' };
  const legacyDb = store.getItem(LEGACY_DB);
  if (legacyDb && !store.getItem(dbKey(first.id))) { store.setItem(dbKey(first.id), legacyDb); store.removeItem(LEGACY_DB); }
  const legacyTraining = store.getItem(LEGACY_TRAINING);
  if (legacyTraining && !store.getItem(trainingKey(first.id))) { store.setItem(trainingKey(first.id), legacyTraining); store.removeItem(LEGACY_TRAINING); }
  const reg = { ships: [first], activeId: first.id };
  saveRegistry(store, reg);
  return reg;
}

export function addShipRef(r: Registry, name: string, pennant: string): { registry: Registry; id: string } {
  const id = uniqueId(name, r.ships.map(s => s.id));
  return { id, registry: { ships: [...r.ships, { id, name: name.trim(), pennant: pennant.trim() }], activeId: id } };
}

/** Remove a ship. The last ship cannot be removed. */
export function removeShipRef(r: Registry, id: string): Registry {
  if (r.ships.length <= 1) return r;
  const ships = r.ships.filter(s => s.id !== id);
  return { ships, activeId: r.activeId === id ? ships[0].id : r.activeId };
}
