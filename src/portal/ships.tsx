/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import { emptyDb } from './db';
import { addShipRef, dbKey, loadRegistry, Registry, removeShipRef, saveRegistry, sessionKey, ShipRef, trainingKey } from './registry';
import { blankShip } from './ship';
import type { Db } from './types';

type Settings = Pick<Db, 'leaveTypes' | 'subDepartments' | 'maxLeavePctPerDept' | 'departments' | 'lists' | 'importFields'>;

interface ShipsStore {
  ships: ShipRef[];
  active: ShipRef;
  switchShip: (id: string) => void;
  /** Creates an empty workspace for a new ship and switches to it. `copy` brings over leave types, sections and the warning threshold. */
  createShip: (name: string, pennant: string, copy?: Settings) => string | null;
  renameShip: (id: string, name: string, pennant: string) => void;
  /** Deletes the ship's data (profile, personnel, leave, logins, training). The last ship cannot be deleted. */
  deleteShip: (id: string) => void;
}

const Ctx = createContext<ShipsStore | null>(null);

export const useShips = (): ShipsStore => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useShips outside ShipsProvider');
  return s;
};

export const ShipsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reg, setReg] = useState<Registry>(() => loadRegistry(localStorage));

  const commit = useCallback((r: Registry) => {
    setReg(r);
    try { saveRegistry(localStorage, r); } catch (e) { console.error('Could not save ship list', e); }
  }, []);

  const store: ShipsStore = {
    ships: reg.ships,
    active: reg.ships.find(s => s.id === reg.activeId) || reg.ships[0],
    switchShip: id => { if (reg.ships.some(s => s.id === id)) commit({ ...reg, activeId: id }); },
    createShip: (name, pennant, copy) => {
      if (!name.trim()) return 'Enter the ship\'s name.';
      if (reg.ships.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) return 'A ship with that name already exists.';
      const { registry, id } = addShipRef(reg, name, pennant);
      const db = { ...emptyDb(blankShip(name.trim(), pennant.trim())), ...(copy || {}) };
      try { localStorage.setItem(dbKey(id), JSON.stringify(db)); } catch { return 'Could not save: browser storage is full or blocked.'; }
      commit(registry);
      return null;
    },
    renameShip: (id, name, pennant) => commit({ ...reg, ships: reg.ships.map(s => (s.id === id ? { ...s, name, pennant } : s)) }),
    deleteShip: id => {
      const next = removeShipRef(reg, id);
      if (next === reg) return;
      try {
        localStorage.removeItem(dbKey(id));
        localStorage.removeItem(trainingKey(id));
        sessionStorage.removeItem(sessionKey(id));
      } catch { /* storage unavailable: the registry change below still hides the ship */ }
      commit(next);
    }
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
};
