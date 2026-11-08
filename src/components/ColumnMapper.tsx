/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { applyMapping, autoMap, FIXED, FieldDef, Mapping, NONE, readTable } from '../utils/columnMap';

/** Holds the column choices for pasted/uploaded text. `mappedText` is the table rebuilt with the parser's own headers (null until there is a header and a data row). */
export function useColumnMapping(text: string, fields: FieldDef[]) {
  const table = useMemo(() => readTable(text), [text]);
  const sig = (table ? table.header.join('\u0001') : '') + '\u0002' + fields.map(f => f.key + f.label).join('\u0001');
  const [mapping, setMapping] = useState<Mapping>({});
  // a different header row (new file or paste) starts again from the automatic match
  useEffect(() => { setMapping(table ? autoMap(table.header, fields) : {}); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const mappedText = table ? applyMapping(table, fields, mapping) : null;
  return { table, mapping, setMapping, mappedText };
}

const sel = 'bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500';

/** One row per import field: pick which column of the file feeds it, leave it empty, or give every row the same value. */
export const ColumnMapper: React.FC<{
  table: NonNullable<ReturnType<typeof readTable>>;
  fields: FieldDef[];
  mapping: Mapping;
  onChange: (m: Mapping) => void;
}> = ({ table, fields, mapping, onChange }) => {
  const set = (key: string, patch: Partial<Mapping[string]>) =>
    onChange({ ...mapping, [key]: { ...(mapping[key] || { col: NONE, fixed: '' }), ...patch } });

  return (
    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-xs font-semibold text-slate-300">
        Match the columns <span className="font-normal text-slate-500">({table.header.length} columns found, {table.rows.length} rows). Choose which column fills each field, or give every row the same value.</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {fields.map(f => {
          const m = mapping[f.key] || { col: NONE, fixed: '' };
          return (
            <div key={f.key} className="flex items-center gap-2 text-xs">
              <span className="w-32 shrink-0 text-slate-400">{f.label}{f.required && <span className="text-rose-400"> *</span>}</span>
              <select className={`${sel} flex-1 min-w-0`} value={m.col} aria-label={`Column for ${f.label}`} onChange={e => set(f.key, { col: Number(e.target.value) })}>
                <option value={NONE}>— leave empty —</option>
                {table.header.map((h, i) => <option key={i} value={i}>{h || `(column ${i + 1})`}</option>)}
                <option value={FIXED}>Same value for every row…</option>
              </select>
              {m.col === FIXED && (
                <input className={`${sel} w-28`} value={m.fixed} placeholder="value" aria-label={`Value for ${f.label}`} onChange={e => set(f.key, { fixed: e.target.value })} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
