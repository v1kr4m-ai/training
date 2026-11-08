/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

const cls = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500';
const ADD = '__add_new__';

/**
 * A dropdown whose first entry adds a new value. `onAdd` is where the caller saves it (so it is remembered for everyone);
 * the new value is then selected. A value that is not in `options` (an older record) is still shown.
 */
export const ComboSelect: React.FC<{
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onAdd?: (v: string) => void;
  noun: string;
  emptyLabel?: string | null;
}> = ({ value, options, onChange, onAdd, noun, emptyLabel = '— none —' }) => {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const list = value && !options.includes(value) ? [value, ...options] : options;

  const commit = () => {
    const v = text.trim();
    if (!v) return;
    onAdd?.(v);
    onChange(v);
    setText('');
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <input autoFocus className={cls} value={text} placeholder={`New ${noun}`} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setAdding(false); }} />
        <button type="button" className="px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold" onClick={commit}>Add</button>
        <button type="button" className="px-2 rounded-lg bg-slate-800 text-slate-300 text-xs" onClick={() => setAdding(false)}>✕</button>
      </div>
    );
  }
  return (
    <select className={cls} value={value} onChange={e => (e.target.value === ADD ? setAdding(true) : onChange(e.target.value))}>
      {onAdd && <option value={ADD}>+ Add new {noun}…</option>}
      {emptyLabel !== null && <option value="">{emptyLabel}</option>}
      {list.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
};
