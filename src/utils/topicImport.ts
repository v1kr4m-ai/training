/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Topic } from '../types/index.ts';
import { ALL_TRACK_DEPARTMENTS, SHIP_WIDE } from '../data/departments.ts';
import { validDuration } from './time.ts';

export const TOPIC_TEMPLATE_HEADER = ['id', 'title', 'department', 'section', 'speaker', 'prerequisite', 'venue', 'duration', 'description'];

const ALIASES: Record<string, string> = {
  topic: 'title', name: 'title', track: 'department', dept: 'department', sub: 'section',
  subdepartment: 'section', 'sub-department': 'section', 'sub department': 'section', instructor: 'speaker', faculty: 'speaker',
  prereq: 'prerequisite', minutes: 'duration', 'duration (min)': 'duration', 'duration minutes': 'duration', 'prerequisite id': 'prerequisite', prerequisiteid: 'prerequisite', location: 'venue'
};

/** Split one delimited line, honouring "quoted, fields" and "" escapes. */
export function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const matchDepartment = (v: string) => {
  const key = v.toLowerCase().replace(/[\s-]+/g, '');
  return ALL_TRACK_DEPARTMENTS.find(d => d.toLowerCase().replace(/[\s-]+/g, '') === key);
};

/**
 * Parse a pasted table (tab, comma or semicolon separated). The first row must be a header containing at least
 * "title" and "department". A row with an unknown department, a missing title, a duplicate id or an
 * unresolvable prerequisite is rejected with a message; nothing is guessed.
 * `prerequisite` may be a topic id or the exact title of another topic in the same paste or already stored.
 */
export function parseTopicTable(text: string, existing: Topic[] = [], required: Record<string, string> = {}): { topics: Topic[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { topics: [], errors: ['Paste a header row followed by at least one topic row.'] };

  const head = lines[0];
  const count = (ch: string) => head.split(ch).length - 1;
  const delim = count('\t') >= count(',') && count('\t') >= count(';') ? '\t' : count(',') >= count(';') ? ',' : ';';
  const cols = splitLine(head, delim).map(h => h.toLowerCase()).map(h => ALIASES[h] || h);
  const col = (name: string) => cols.indexOf(name);
  if (col('title') < 0 || col('department') < 0) {
    return { topics: [], errors: ['Header row must contain "title" and "department" columns.'] };
  }

  const usedIds = new Set(existing.map(t => t.id.toLowerCase()));
  let nextNum = existing.reduce((m, t) => Math.max(m, Number(/^T-(\d+)$/.exec(t.id)?.[1] || 0)), 0) + 1;
  const rows: Array<{ topic: Topic; prereq: string; line: number }> = [];

  lines.slice(1).forEach((line, i) => {
    const lineNo = i + 2;
    const cells = splitLine(line, delim);
    const get = (name: string) => (col(name) >= 0 ? cells[col(name)] || '' : '');

    const title = get('title');
    const department = matchDepartment(get('department'));
    if (!title) return void errors.push(`Row ${lineNo}: missing title.`);
    if (!department) return void errors.push(`Row ${lineNo} ("${title}"): department "${get('department')}" is not one of ${ALL_TRACK_DEPARTMENTS.join(', ')}.`);

    for (const [k, label] of Object.entries(required)) {
      if (!get(k)) return void errors.push(`Row ${lineNo} ("${title}"): ${label} is required.`);
    }

    // duration is optional: empty means none; otherwise whole minutes
    const rawDur = get('duration').replace(/\s*min(ute)?s?$/i, '');
    const durationMinutes = rawDur ? Number(rawDur) : undefined;
    if (rawDur && !validDuration(durationMinutes)) return void errors.push(`Row ${lineNo} ("${title}"): duration "${get('duration')}" must be a whole number of minutes (1 to 1439) or empty.`);

    let id = get('id');
    if (!id) { while (usedIds.has(`t-${nextNum}`)) nextNum++; id = `T-${String(nextNum++).padStart(3, '0')}`; }
    if (usedIds.has(id.toLowerCase())) return void errors.push(`Row ${lineNo} ("${title}"): duplicate id ${id}.`);
    usedIds.add(id.toLowerCase());

    rows.push({
      line: lineNo,
      prereq: get('prerequisite'),
      topic: {
        id, title, department,
        subDepartment: get('section'),
        trackType: department === SHIP_WIDE ? 'COMPANY_WIDE' : 'DEPARTMENTAL',
        speaker: get('speaker'),
        venue: get('venue'),
        durationMinutes,
        prerequisiteId: null,
        description: get('description')
      }
    });
  });

  const all = [...existing, ...rows.map(r => r.topic)];
  const topics: Topic[] = [];
  for (const { topic, prereq, line } of rows) {
    if (prereq && prereq !== '-') {
      const hit = all.find(t => t.id.toLowerCase() === prereq.toLowerCase())
        || all.find(t => t.title.toLowerCase() === prereq.toLowerCase());
      if (!hit) { errors.push(`Row ${line} ("${topic.title}"): prerequisite "${prereq}" matches no topic id or title.`); continue; }
      if (hit.id === topic.id) { errors.push(`Row ${line} ("${topic.title}"): a topic cannot be its own prerequisite.`); continue; }
      topic.prerequisiteId = hit.id;
    }
    topics.push(topic);
  }
  return { topics, errors };
}

/** Ready-to-fill CSV with the header row only. */
export const topicTemplateCsv = () => TOPIC_TEMPLATE_HEADER.join(',') + '\n';

// Self-check: node --experimental-strip-types src/utils/topicImport.ts
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('topicImport.ts')) {
  const ok = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const r = parseTopicTable(
    'title,department,speaker,prerequisite,description\n' +
    'Fire Drill,Ship-Wide,"Lt A, XO",,"Hose, party"\n' +
    'Advanced Fire,engineering,,Fire Drill,\n' +
    'Bad,Finance,,,\n' +
    'Orphan,Weapons,,Nope,\n');
  ok(r.topics.length === 2, 'two valid rows');
  ok(r.topics[0].speaker === 'Lt A, XO' && r.topics[0].trackType === 'COMPANY_WIDE', 'quoted comma + track');
  ok(r.topics[1].department === 'Engineering' && r.topics[1].prerequisiteId === r.topics[0].id, 'dept + prereq by title');
  ok(r.errors.length === 2, 'two rejected rows');
  console.log('topicImport ok');
}
