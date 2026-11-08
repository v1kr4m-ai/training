/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DepartmentConfig } from '../types/index.ts';

/** Name of the track held on Mondays and Thursdays, open to the whole ship's company. */
export const SHIP_WIDE = 'Ship-Wide';

/**
 * Main departments and their default sections. Sections can be edited in the portal (Departments page);
 * the main departments are defined here and used by every module and by the training scheduler.
 */
const DEFAULTS: Record<string, DepartmentConfig> = {
  [SHIP_WIDE]: {
    name: SHIP_WIDE,
    code: 'SHIP',
    color: '#3b82f6',
    badgeBg: 'bg-blue-950/60',
    badgeText: 'text-blue-300',
    borderColor: 'border-blue-700/50',
    description: "Training for the whole ship's company, scheduled on the days set to ship-wide.",
    subDepartments: ['Command & Discipline', 'Damage Control & Firefighting', 'Seamanship & Boat Work', 'Information Security', 'Safety & Welfare']
  },
  'Executive': {
    name: 'Executive',
    code: 'EXE',
    color: '#06b6d4',
    badgeBg: 'bg-cyan-950/60',
    badgeText: 'text-cyan-300',
    borderColor: 'border-cyan-700/50',
    description: 'Command, operations and navigation, communications, weapons, seamanship and discipline.',
    subDepartments: ['Command & Administration', 'Navigation', 'Operations (CIC)', 'Communications', 'Weapons & Missiles', 'Gunnery', 'Anti-Submarine Warfare', 'Seamanship & Damage Control', 'Regulating']
  },
  'Engineering': {
    name: 'Engineering',
    code: 'ENG',
    color: '#10b981',
    badgeBg: 'bg-emerald-950/60',
    badgeText: 'text-emerald-300',
    borderColor: 'border-emerald-700/50',
    description: 'Propulsion, auxiliary machinery, hull systems and damage-control equipment.',
    subDepartments: ['Gas Turbine Propulsion', 'Auxiliary Machinery', 'Hull & Damage Control Systems', 'Steering & Stabilisers']
  },
  'Electrical': {
    name: 'Electrical',
    code: 'ELE',
    color: '#f59e0b',
    badgeBg: 'bg-amber-950/60',
    badgeText: 'text-amber-300',
    borderColor: 'border-amber-700/50',
    description: 'Power generation and distribution, weapon electrical systems, radar and electronic maintenance.',
    subDepartments: ['Power Generation & Distribution', 'Weapon Electrical', 'Radar & Electronic Maintenance']
  },
  'Logistics': {
    name: 'Logistics',
    code: 'LOG',
    color: '#ec4899',
    badgeBg: 'bg-pink-950/60',
    badgeText: 'text-pink-300',
    borderColor: 'border-pink-700/50',
    description: 'Stores and provisioning, victualling, fuel and ammunition handling, accounts.',
    subDepartments: ['Stores & Provisioning', 'Victualling', 'Fuel & Ammunition Handling', 'Accounts']
  },
  'Medical': {
    name: 'Medical',
    code: 'MED',
    color: '#f97316',
    badgeBg: 'bg-orange-950/60',
    badgeText: 'text-orange-300',
    borderColor: 'border-orange-700/50',
    description: 'First aid and casualty care, hygiene and preventive medicine, mass-casualty drills.',
    subDepartments: ['First Aid & Casualty Care', 'Hygiene & Preventive Medicine', 'Mass Casualty Drills']
  },
  'Miscellaneous': {
    name: 'Miscellaneous',
    code: 'MSC',
    color: '#8b5cf6',
    badgeBg: 'bg-violet-950/60',
    badgeText: 'text-violet-300',
    borderColor: 'border-violet-700/50',
    description: 'Personnel and functions that do not belong to the other departments.',
    subDepartments: ['Aviation', "Ship's Office", 'Other']
  }
};

/** What the portal stores for an edited department. Colours come from PALETTE by index so every module styles it the same way. */
export interface DeptEdit { name: string; code: string; description: string; palette: number }

type Look = Pick<DepartmentConfig, 'color' | 'badgeBg' | 'badgeText' | 'borderColor'>;
// class names are written out in full so Tailwind finds them
export const PALETTE: Look[] = [
  { color: '#06b6d4', badgeBg: 'bg-cyan-950/60', badgeText: 'text-cyan-300', borderColor: 'border-cyan-700/50' },
  { color: '#10b981', badgeBg: 'bg-emerald-950/60', badgeText: 'text-emerald-300', borderColor: 'border-emerald-700/50' },
  { color: '#f59e0b', badgeBg: 'bg-amber-950/60', badgeText: 'text-amber-300', borderColor: 'border-amber-700/50' },
  { color: '#ec4899', badgeBg: 'bg-pink-950/60', badgeText: 'text-pink-300', borderColor: 'border-pink-700/50' },
  { color: '#f97316', badgeBg: 'bg-orange-950/60', badgeText: 'text-orange-300', borderColor: 'border-orange-700/50' },
  { color: '#8b5cf6', badgeBg: 'bg-violet-950/60', badgeText: 'text-violet-300', borderColor: 'border-violet-700/50' },
  { color: '#14b8a6', badgeBg: 'bg-teal-950/60', badgeText: 'text-teal-300', borderColor: 'border-teal-700/50' },
  { color: '#f43f5e', badgeBg: 'bg-rose-950/60', badgeText: 'text-rose-300', borderColor: 'border-rose-700/50' },
  { color: '#6366f1', badgeBg: 'bg-indigo-950/60', badgeText: 'text-indigo-300', borderColor: 'border-indigo-700/50' },
  { color: '#84cc16', badgeBg: 'bg-lime-950/60', badgeText: 'text-lime-300', borderColor: 'border-lime-700/50' }
];

const DEFAULT_ORDER = ['Executive', 'Engineering', 'Electrical', 'Logistics', 'Medical', 'Miscellaneous'];

/** The six standard departments, as they are before anyone edits the list. */
export const defaultDeptEdits = (): DeptEdit[] =>
  DEFAULT_ORDER.map((name, i) => ({ name, code: DEFAULTS[name].code, description: DEFAULTS[name].description || '', palette: i }));

// Live registries. Every module reads these, so applyDepartments() rewrites them in place instead of replacing them.
export const DEPARTMENTS: Record<string, DepartmentConfig> = {};
/** Departments that take turns in the departmental slots (everything except Ship-Wide). */
export const DEPARTMENT_NAMES: string[] = [];
/** Every valid value for Topic.department. */
export const ALL_TRACK_DEPARTMENTS: string[] = [];

/** Make `edits` (null = the standard six) the ship's department list. Ship-Wide is always present and cannot be edited. */
export function applyDepartments(edits: DeptEdit[] | null | undefined) {
  const list = edits && edits.length ? edits : defaultDeptEdits();
  for (const k of Object.keys(DEPARTMENTS)) delete DEPARTMENTS[k];
  DEPARTMENTS[SHIP_WIDE] = DEFAULTS[SHIP_WIDE];
  DEPARTMENT_NAMES.length = 0;
  for (const e of list) {
    DEPARTMENTS[e.name] = { name: e.name, code: e.code, description: e.description, ...PALETTE[e.palette % PALETTE.length], subDepartments: DEFAULTS[e.name]?.subDepartments ?? [] };
    DEPARTMENT_NAMES.push(e.name);
  }
  ALL_TRACK_DEPARTMENTS.length = 0;
  ALL_TRACK_DEPARTMENTS.push(SHIP_WIDE, ...DEPARTMENT_NAMES);
}
applyDepartments(null);

export function getDepartmentConfig(departmentName: string): DepartmentConfig {
  return DEPARTMENTS[departmentName] || {
    name: departmentName,
    code: departmentName.substring(0, 3).toUpperCase(),
    color: '#64748b',
    badgeBg: 'bg-slate-900',
    badgeText: 'text-slate-300',
    borderColor: 'border-slate-700',
    subDepartments: []
  };
}
