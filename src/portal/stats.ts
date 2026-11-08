/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { DEPARTMENT_NAMES } from '../data/departments';
import { canDecide, onLeave, todayIso } from './leaveLogic';
import { usePortal } from './store';

export interface DeptStat { name: string; total: number; away: number }
export interface LiveStats { active: number; away: number; onBoard: number; waiting: number; perDept: DeptStat[] }

/** Today's figures for the signed-in user, computed from the ship's own records. */
export function useLiveStats(): LiveStats {
  const { db, user } = usePortal();
  const today = todayIso();
  return useMemo(() => {
    const active = db.personnel.filter(p => p.active);
    const away = onLeave(db, today);
    const awayIds = new Set(away.map(r => r.personId));
    return {
      active: active.length,
      away: away.filter(r => active.some(p => p.id === r.personId)).length,
      onBoard: active.filter(p => !awayIds.has(p.id)).length,
      waiting: user ? db.leaveRequests.filter(r => canDecide(db, user, r)).length : 0,
      perDept: DEPARTMENT_NAMES.map(name => {
        const people = active.filter(p => p.department === name);
        return { name, total: people.length, away: people.filter(p => awayIds.has(p.id)).length };
      })
    };
  }, [db, user, today]);
}
