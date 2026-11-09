/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Anchor, ChevronDown, Plus } from 'lucide-react';
import { useShips } from './ships';
import { usePortal } from './store';
import { btnGhost, btnPrimary, Field, inputCls, Modal } from './ui';

/** Lists the ships to switch between and adds a new one. `pill` is the white header button; `block` is the full-width login version. */
export const ShipSwitcher: React.FC<{ variant?: 'pill' | 'block' }> = ({ variant = 'pill' }) => {
  const { ships, active, switchShip } = useShips();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const pill = variant === 'pill';

  return (
    <div className="relative z-50">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={pill
          ? 'flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 shadow-sm'
          : 'w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs text-slate-100 hover:bg-white/5'}
      >
        <Anchor className="w-3.5 h-3.5" />
        <span className="truncate">{pill ? 'Ships' : `${active.name}${active.pennant ? ` · ${active.pennant}` : ''}`}</span>
        <ChevronDown className="w-3.5 h-3.5 ml-auto" />
      </button>

      {open && (
        <>
          <button aria-label="Close ship menu" className="fixed inset-0 z-[140] cursor-default" onClick={() => setOpen(false)} />
          <div role="listbox" className="absolute z-[150] right-0 mt-2 w-64 bg-[#12151a] border border-white/20 rounded-2xl shadow-2xl p-1.5 text-left">
            {ships.map(s => (
              <button
                key={s.id}
                role="option"
                aria-selected={s.id === active.id}
                onClick={() => { setOpen(false); switchShip(s.id); }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs ${s.id === active.id ? 'bg-white text-black' : 'text-slate-200 hover:bg-white/10'}`}
              >
                <span className="font-semibold">{s.name}</span>{s.pennant && <span className="opacity-60"> · {s.pennant}</span>}
              </button>
            ))}
            <button onClick={() => { setOpen(false); setAdding(true); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/10 border-t border-white/10 mt-1">
              <Plus className="w-3.5 h-3.5" /> Add a ship
            </button>
          </div>
        </>
      )}
      {adding && <AddShipModal onClose={() => setAdding(false)} />}
    </div>
  );
};

const AddShipModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { createShip } = useShips();
  const { db, ship } = usePortal();
  const [name, setName] = useState('');
  const [pennant, setPennant] = useState('');
  const [copy, setCopy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    const err = createShip(name, pennant, copy ? { leaveTypes: db.leaveTypes, subDepartments: db.subDepartments, maxLeavePctPerDept: db.maxLeavePctPerDept, departments: db.departments, lists: db.lists, importFields: db.importFields } : undefined);
    if (err) return setError(err);
    onClose();
  };

  return (
    <Modal title="Add a ship" onClose={onClose}>
      <p className="text-xs text-slate-400">
        A new ship gets its own empty workspace: its own profile, personnel, leave, logins and training. All modules work the same; only the ship's data differs.
        You will create that ship's administrator account on first sign-in.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Field label="Ship name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="INS ..." autoFocus /></Field></div>
        <Field label="Pennant"><input className={inputCls} value={pennant} onChange={e => setPennant(e.target.value)} /></Field>
      </div>
      <label className="flex items-start gap-2 text-xs text-slate-300">
        <input type="checkbox" className="mt-0.5" checked={copy} onChange={e => setCopy(e.target.checked)} />
        <span>Copy settings from {ship.name || 'this ship'}: departments, sections, ranks and appointments you added, sheet columns, leave types and yearly days, manpower warning level. People, leave history and logins are never copied.</span>
      </label>
      {error && <div className="text-xs text-rose-400" role="alert">{error}</div>}
      <div className="flex justify-end gap-2"><button className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} onClick={create}>Create and switch</button></div>
    </Modal>
  );
};
