/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEPARTMENTS, defaultDeptEdits, type DeptEdit } from '../data/departments.ts';
import { trainingKey } from './registry.ts';
import type { Db } from './types.ts';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const deptList = (d: Db): DeptEdit[] => d.departments ?? defaultDeptEdits();
export const hasDept = (d: Db, name: string) => deptList(d).some(e => same(e.name, name));

/** Sections of a department as the ship currently has them (edited list, else the built-in one). */
export const sectionsOf = (d: Db, dept: string): string[] => d.subDepartments[dept] ?? DEPARTMENTS[dept]?.subDepartments ?? [];

/** Add a department. The caller has already checked the name is not taken. */
export function addDepartment(d: Db, name: string): Db {
  const list = deptList(d);
  const clean = name.trim();
  return { ...d, departments: [...list, { name: clean, code: clean.slice(0, 3).toUpperCase(), description: '', palette: list.length }] };
}

/** Add a section to a department unless it is already there. */
export function addSection(d: Db, dept: string, name: string): Db {
  const cur = sectionsOf(d, dept);
  const clean = name.trim();
  if (!clean || cur.some(s => same(s, clean))) return d;
  return { ...d, subDepartments: { ...d.subDepartments, [dept]: [...cur, clean] } };
}

/** Rename a department everywhere in this ship's database: list, people and the section lists. (Training data is handled by renameInTraining.) */
export function renameDepartment(d: Db, from: string, to: string): Db {
  const { [from]: oldSubs, ...rest } = d.subDepartments;
  return {
    ...d,
    departments: deptList(d).map(e => (e.name === from ? { ...e, name: to } : e)),
    personnel: d.personnel.map(p => (p.department === from ? { ...p, department: to } : p)),
    subDepartments: { ...rest, [to]: oldSubs ?? DEPARTMENTS[from]?.subDepartments ?? [] }
  };
}

export function removeDepartment(d: Db, name: string): Db {
  const { [name]: _gone, ...rest } = d.subDepartments;
  return { ...d, departments: deptList(d).filter(e => e.name !== name), subDepartments: rest };
}

type Saved = { topics?: Array<{ department?: string }>; sessions?: Array<{ department?: string }> } & Record<string, unknown>;
const readTraining = (shipId: string): Saved | null => {
  try { return JSON.parse(localStorage.getItem(trainingKey(shipId)) || 'null'); } catch { return null; }
};

/** How many training topics of this ship use the department. */
export const trainingUses = (shipId: string, dept: string): number =>
  (readTraining(shipId)?.topics || []).filter(t => t.department === dept).length;

/** Keep the training module's saved topics and sessions in step with a renamed department. */
export function renameInTraining(shipId: string, from: string, to: string) {
  const s = readTraining(shipId);
  if (!s) return;
  const fix = <T extends { department?: string }>(a?: T[]) => (Array.isArray(a) ? a.map(x => (x.department === from ? { ...x, department: to } : x)) : a);
  try { localStorage.setItem(trainingKey(shipId), JSON.stringify({ ...s, topics: fix(s.topics), sessions: fix(s.sessions) })); } catch { /* storage full or blocked: topics keep the old name */ }
}
