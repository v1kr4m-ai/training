/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FieldDef } from '../utils/columnMap.ts';
import type { FieldSettings } from './types.ts';

/** A column the importer understands. `hard` columns are needed to build a record at all, so they can be renamed but not dropped. */
export interface BaseField extends FieldDef { hard?: boolean }

export const ROLL_FIELDS: BaseField[] = [
  { key: 'serviceno', label: 'Personal Number', required: true, hard: true, aliases: ['service no', 'service number', 'service no.', 'personal no', 'id', 'number'] },
  { key: 'name', label: 'Name', required: true, hard: true },
  { key: 'rank', label: 'Rank' },
  { key: 'category', label: 'Category', required: true, hard: true },
  { key: 'department', label: 'Department', required: true, hard: true, aliases: ['dept', 'branch'] },
  { key: 'section', label: 'Section', aliases: ['subdepartment', 'sub-department', 'sub department', 'sub'] },
  { key: 'designation', label: 'Appointment / trade', aliases: ['designation', 'appointment', 'trade'] }
];

export const TOPIC_FIELDS: BaseField[] = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Title', required: true, hard: true, aliases: ['topic', 'name'] },
  { key: 'department', label: 'Department', required: true, hard: true, aliases: ['dept', 'track'] },
  { key: 'section', label: 'Section', aliases: ['subdepartment', 'sub-department', 'sub department', 'sub'] },
  { key: 'speaker', label: 'Speaker', aliases: ['instructor', 'faculty'] },
  { key: 'prerequisite', label: 'Prerequisite', aliases: ['prereq', 'prerequisite id'] },
  { key: 'venue', label: 'Venue', aliases: ['location'] },
  { key: 'duration', label: 'Duration (min)', aliases: ['duration', 'minutes', 'duration minutes'] },
  { key: 'description', label: 'Description' }
];

export interface ResolvedField extends BaseField { enabled: boolean; defaultLabel: string }

/** Apply the ship's settings to the built-in columns: the header name, whether the column is used, and whether it must be filled in. */
export function resolveFields(base: BaseField[], settings: FieldSettings = {}): ResolvedField[] {
  return base.map(f => {
    const s = settings[f.key] || {};
    const header = (s.header || '').trim() || f.label;
    return {
      ...f,
      defaultLabel: f.label,
      label: header,
      enabled: f.hard ? true : s.enabled !== false,
      required: f.hard ? true : !!s.required,
      // a sheet that still uses the original name keeps matching
      aliases: [...(f.aliases || []), ...(header !== f.label ? [f.label] : [])]
    };
  });
}

/** Columns in use, as the importer and the column matcher see them. */
export const activeFields = (base: BaseField[], settings?: FieldSettings): ResolvedField[] =>
  resolveFields(base, settings).filter(f => f.enabled);

/** Columns beyond the built-in ones that the ship has made compulsory: key -> header, for the parsers' "is required" check. */
export const extraRequired = (fields: ResolvedField[]): Record<string, string> =>
  Object.fromEntries(fields.filter(f => f.required && !f.hard).map(f => [f.key, f.label]));

/** Header row of the blank sheet that can be handed round. */
export const templateCsv = (fields: ResolvedField[]) => fields.map(f => f.label).join(',') + '\n';
