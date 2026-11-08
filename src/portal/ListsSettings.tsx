/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BUILT_IN_RANKS } from '../data/ranks';
import { DepartmentsManager } from './DepartmentsManager';
import { ImportColumnsEditor } from './ImportColumnsEditor';
import { usePortal } from './store';
import type { Category } from './types';
import { btnGhost, btnPrimary, inputCls } from './ui';

/** Rename / remove / add entries of one list. Renaming also changes the people who carry the old value. */
const ListEditor: React.FC<{
  title: string;
  hint?: string;
  items: string[];
  fixed?: string[];
  onAdd: (v: string) => void;
  onRename: (from: string, to: string) => void;
  onRemove: (v: string) => void;
}> = ({ title, hint, items, fixed = [], onAdd, onRename, onRemove }) => {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (!v || items.includes(v) || fixed.includes(v)) return;
    onAdd(v);
    setText('');
  };
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        {hint && <p className="text-xs text-white/50">{hint}</p>}
      </div>
      {fixed.length > 0 && <p className="text-[11px] text-slate-500">Standard: {fixed.join(', ')}</p>}
      <ul className="space-y-1.5">
        {items.map(v => (
          <li key={v} className="flex items-center gap-2">
            <input key={v} className={inputCls} defaultValue={v} aria-label={`Rename ${v}`}
              onBlur={e => { const t = e.target.value.trim(); if (t && t !== v && !items.includes(t) && !fixed.includes(t)) onRename(v, t); else e.target.value = v; }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
            <button aria-label={`Remove ${v}`} onClick={() => onRemove(v)} className="p-1.5 text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-slate-500">Nothing added yet. Entries added from the Nominal Roll form appear here.</li>}
      </ul>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Add" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button className={btnPrimary} onClick={add}><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>
    </div>
  );
};

/** Settings > Lists & sheets: everything the ship customises once and everybody then shares. */
export const ListsSettings: React.FC = () => {
  const { db, user, update } = usePortal();
  const [open, setOpen] = useState<null | 'roll' | 'topics' | 'departments'>(null);
  if (user?.role !== 'ADMIN') return <p className="text-xs text-white/50">Only the administrator can change these lists.</p>;

  const cats: Category[] = ['Officer', 'Sailor', 'Civilian'];
  const setRanks = (cat: Category, fn: (a: string[]) => string[]) =>
    update(d => ({ ...d, lists: { ...d.lists, ranks: { ...d.lists.ranks, [cat]: fn(d.lists.ranks[cat]) } } }));

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
        <p className="text-sm font-medium text-white">Departments and sheet columns</p>
        <p className="text-xs text-white/50">One blank sheet can go to every department: set its column names once and everyone imports the same way.</p>
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} onClick={() => setOpen('departments')}>Departments…</button>
          <button className={btnGhost} onClick={() => setOpen('roll')}>Nominal Roll sheet columns…</button>
          <button className={btnGhost} onClick={() => setOpen('topics')}>Training topic sheet columns…</button>
        </div>
      </div>

      {cats.map(cat => (
        <ListEditor key={cat} title={`${cat} ranks added by you`} hint="Shown first in the rank list for this category, ahead of the standard Navy ranks."
          items={db.lists.ranks[cat]} fixed={BUILT_IN_RANKS[cat]}
          onAdd={v => setRanks(cat, a => [v, ...a])}
          onRename={(from, to) => {
            setRanks(cat, a => a.map(x => (x === from ? to : x)));
            update(d => ({ ...d, personnel: d.personnel.map(p => (p.category === cat && p.rank === from ? { ...p, rank: to } : p)) }));
          }}
          onRemove={v => setRanks(cat, a => a.filter(x => x !== v))} />
      ))}

      <ListEditor title="Appointments / trades" hint="Offered in the Appointment / trade list on the Nominal Roll form."
        items={db.lists.designations}
        onAdd={v => update(d => ({ ...d, lists: { ...d.lists, designations: [v, ...d.lists.designations] } }))}
        onRename={(from, to) => update(d => ({
          ...d,
          lists: { ...d.lists, designations: d.lists.designations.map(x => (x === from ? to : x)) },
          personnel: d.personnel.map(p => (p.designation === from ? { ...p, designation: to } : p))
        }))}
        onRemove={v => update(d => ({ ...d, lists: { ...d.lists, designations: d.lists.designations.filter(x => x !== v) } }))} />

      <p className="text-xs text-white/40">Sections are edited inside each department (Departments, then open one).</p>

      {open === 'departments' && <DepartmentsManager onClose={() => setOpen(null)} />}
      {(open === 'roll' || open === 'topics') && <ImportColumnsEditor which={open} onClose={() => setOpen(null)} />}
    </div>
  );
};
