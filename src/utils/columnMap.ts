/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { splitLine } from './topicImport.ts';

/** A field an import understands. `key` is the header the parser reads; `aliases` are other header names matched automatically. */
export interface FieldDef { key: string; label: string; required?: boolean; aliases?: string[] }

/** col >= 0: use that column of the file; -1: leave empty; -2: the same fixed value on every row. */
export type Mapping = Record<string, { col: number; fixed: string }>;

export interface Table { header: string[]; rows: string[][]; delim: string }

export const NONE = -1;
export const FIXED = -2;

/** Split pasted/uploaded text into a header row and data rows (tab, comma or semicolon separated). */
export function readTable(text: string): Table | null {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const count = (c: string) => lines[0].split(c).length - 1;
  const delim = count('\t') >= count(',') && count('\t') >= count(';') ? '\t' : count(',') >= count(';') ? ',' : ';';
  return { header: splitLine(lines[0], delim), rows: lines.slice(1).map(l => splitLine(l, delim)), delim };
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_.-]+/g, '');

/** Match every field to the file column with the same name (or alias); unmatched fields start empty. */
export function autoMap(header: string[], fields: FieldDef[]): Mapping {
  const m: Mapping = {};
  for (const f of fields) {
    const names = [f.key, f.label, ...(f.aliases || [])].map(norm);
    m[f.key] = { col: header.findIndex(h => names.includes(norm(h))), fixed: '' };
  }
  return m;
}

const cell = (v: string) => (/[",\n\t;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Rebuild the table with the parser's own header names, in field order, taking each value from the chosen column or fixed value. */
export function applyMapping(t: Table, fields: FieldDef[], m: Mapping): string {
  const head = fields.map(f => f.key).join(',');
  const body = t.rows.map(r => fields.map(f => {
    const s = m[f.key] || { col: NONE, fixed: '' };
    const v = s.col === FIXED ? s.fixed : s.col >= 0 ? r[s.col] || '' : '';
    return cell(v.replace(/\s*[\r\n]+\s*/g, ' '));
  }).join(','));
  return [head, ...body].join('\n');
}

// Self-check: node --experimental-strip-types src/utils/columnMap.ts
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('columnMap.ts')) {
  const ok = (c: boolean, msg: string) => { if (!c) { console.error('FAIL', msg); process.exit(1); } };
  const fields: FieldDef[] = [{ key: 'title', label: 'Title', aliases: ['topic'] }, { key: 'department', label: 'Department' }, { key: 'venue', label: 'Venue' }];
  const t = readTable('Dept;Topic;Room\nEngineering;"Fire, drill";Hangar')!;
  const m = autoMap(t.header, fields);
  ok(m.title.col === 1 && m.department.col === -1 && m.venue.col === -1, 'auto map by alias, rest empty');
  m.department = { col: 0, fixed: '' };
  m.venue = { col: FIXED, fixed: 'Mess' };
  ok(applyMapping(t, fields, m) === 'title,department,venue\n"Fire, drill",Engineering,Mess', applyMapping(t, fields, m));
  console.log('columnMap ok');
}
