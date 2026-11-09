/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEPARTMENT_NAMES } from '../data/departments.ts';
import { splitLine } from '../utils/topicImport.ts';
import type { Category, Person } from './types.ts';

export const PERSONNEL_HEADER = ['serviceno', 'name', 'rank', 'category', 'department', 'section', 'designation'];

const ALIASES: Record<string, string> = {
  'service no': 'serviceno', 'personal number': 'serviceno', 'personal no': 'serviceno', 'service number': 'serviceno', 'service no.': 'serviceno', id: 'serviceno', number: 'serviceno',
  dept: 'department', branch: 'department', subdepartment: 'section', 'sub-department': 'section', 'sub department': 'section', sub: 'section',
  appointment: 'designation', trade: 'designation'
};
const CATEGORIES: Category[] = ['Officer', 'Sailor', 'Civilian'];
const norm = (v: string) => v.toLowerCase().replace(/[\s-]+/g, '');

/**
 * Parse a pasted table into Person records. First row is a header; required columns are
 * serviceno, name, category (Officer/Sailor/Civilian) and department. A row with an unknown department,
 * category or section, or a duplicate personal number, is rejected with a message; nothing is guessed.
 * `subsOf` returns the allowed sections of a department.
 */
export function parsePersonnelTable(
  text: string, existing: Person[], subsOf: (dept: string) => string[], newId: () => string,
  required: Record<string, string> = {}
): { people: Person[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { people: [], errors: ['Paste a header row followed by at least one person.'] };

  const head = lines[0];
  const count = (c: string) => head.split(c).length - 1;
  const delim = count('\t') >= count(',') && count('\t') >= count(';') ? '\t' : count(',') >= count(';') ? ',' : ';';
  const cols = splitLine(head, delim).map(h => h.toLowerCase()).map(h => ALIASES[h] || h);
  for (const need of ['serviceno', 'name', 'category', 'department']) {
    if (!cols.includes(need)) return { people: [], errors: [`Header row must contain "${need}".`] };
  }
  const get = (cells: string[], name: string) => (cols.includes(name) ? cells[cols.indexOf(name)] || '' : '');

  const seen = new Set(existing.map(p => p.serviceNo.toLowerCase()));
  const people: Person[] = [];

  lines.slice(1).forEach((line, i) => {
    const n = i + 2;
    const cells = splitLine(line, delim);
    const serviceNo = get(cells, 'serviceno');
    const name = get(cells, 'name');
    if (!serviceNo || !name) return void errors.push(`Row ${n}: personal number and name are required.`);
    if (seen.has(serviceNo.toLowerCase())) return void errors.push(`Row ${n} (${serviceNo}): personal number already exists.`);

    for (const [k, label] of Object.entries(required)) {
      if (!get(cells, k)) return void errors.push(`Row ${n} (${serviceNo}): ${label} is required.`);
    }

    const category = CATEGORIES.find(c => norm(c) === norm(get(cells, 'category')));
    if (!category) return void errors.push(`Row ${n} (${serviceNo}): category must be Officer, Sailor or Civilian.`);
    const department = DEPARTMENT_NAMES.find(d => norm(d) === norm(get(cells, 'department')));
    if (!department) return void errors.push(`Row ${n} (${serviceNo}): department "${get(cells, 'department')}" is not one of ${DEPARTMENT_NAMES.join(', ')}.`);

    const rawSub = get(cells, 'section');
    const allowed = subsOf(department);
    const sub = rawSub ? allowed.find(s => norm(s) === norm(rawSub)) : '';
    if (rawSub && !sub) return void errors.push(`Row ${n} (${serviceNo}): section "${rawSub}" is not in ${department} (${allowed.join(', ')}).`);

    seen.add(serviceNo.toLowerCase());
    people.push({ id: newId(), serviceNo, name, rank: get(cells, 'rank'), designation: get(cells, 'designation'), category, department, subDepartment: sub || '', active: true });
  });
  return { people, errors };
}

// Self-check: node --experimental-strip-types src/portal/personnelImport.ts
if (typeof process !== 'undefined' && Array.isArray(process?.argv) && process.argv[1]?.endsWith('personnelImport.ts')) {
  const ok = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  let k = 0;
  const r = parsePersonnelTable(
    'Service No,Name,Rank,Category,Dept,Section\n' +
    '1001,A One,Lt,officer,engineering,gas turbine propulsion\n' +
    '1001,Dup,,Sailor,Medical,\n' +
    '1002,Bad Dept,,Sailor,Finance,\n' +
    '1003,Bad Sub,,Sailor,Medical,Nonsense\n' +
    '1004,No Cat,,,Medical,\n' +
    '1005,"Last, First",PO,Sailor,Executive,Navigation',
    [], d => (d === 'Engineering' ? ['Gas Turbine Propulsion'] : d === 'Executive' ? ['Navigation'] : []), () => String(++k));
  ok(r.people.length === 2 && r.errors.length === 4, JSON.stringify(r));
  ok(r.people[0].department === 'Engineering' && r.people[0].subDepartment === 'Gas Turbine Propulsion' && r.people[0].category === 'Officer', 'normalised values');
  ok(r.people[1].name === 'Last, First', 'quoted comma');
  console.log('personnelImport ok');
}
