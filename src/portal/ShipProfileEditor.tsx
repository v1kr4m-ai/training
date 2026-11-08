/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { imageToDataUrl } from '../utils/image';
import { newId } from './db';
import { heroOf } from './shipImages';
import { ShipProfile, SpecGroup, TimelineItem } from './ship';
import { useShips } from './ships';
import { usePortal } from './store';
import { btnDanger, btnGhost, btnPrimary, Field, inputCls, Modal } from './ui';

const Section: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <section className="space-y-2 pt-3 border-t border-slate-800">
    <div className="flex items-center justify-between"><h3 className="text-xs font-bold text-white uppercase tracking-wide">{title}</h3>{action}</div>
    {children}
  </section>
);
const IconBtn: React.FC<{ label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ label, onClick, children, disabled }) => (
  <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30">{children}</button>
);

export const ShipProfileEditor: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { ship, shipId, updateShip } = usePortal();
  const { ships, deleteShip } = useShips();
  const [p, setP] = useState<ShipProfile>(() => JSON.parse(JSON.stringify(ship)));
  const [error, setError] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState('');

  const set = <K extends keyof ShipProfile>(k: K, v: ShipProfile[K]) => setP(prev => ({ ...prev, [k]: v }));
  const move = <T,>(list: T[], i: number, d: number): T[] => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  const save = () => {
    if (!p.name.trim()) return setError('The ship needs a name.');
    updateShip({
      ...p,
      name: p.name.trim(),
      pennant: p.pennant.trim(),
      facts: p.facts.filter(f => f.label.trim() && f.value.trim()),
      specs: p.specs
        .map(g => ({ ...g, items: g.items.filter(i => i.label.trim() && i.value.trim()) }))
        .filter(g => g.title.trim() && g.items.length > 0),
      timeline: p.timeline.filter(t => t.title.trim())
    });
    onClose();
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { set('heroImage', await imageToDataUrl(f)); setError(null); } catch (err) { setError((err as Error).message); }
  };

  const hero = heroOf(shipId, p);
  const setGroup = (i: number, g: SpecGroup) => set('specs', p.specs.map((x, k) => (k === i ? g : x)));
  const setTl = (i: number, t: TimelineItem) => set('timeline', p.timeline.map((x, k) => (k === i ? t : x)));

  return (
    <Modal title="Edit ship profile" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ship name"><input className={inputCls} value={p.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Pennant number"><input className={inputCls} value={p.pennant} onChange={e => set('pennant', e.target.value)} /></Field>
        <Field label="Class"><input className={inputCls} value={p.shipClass} onChange={e => set('shipClass', e.target.value)} /></Field>
        <Field label="Fleet / command"><input className={inputCls} value={p.command} onChange={e => set('command', e.target.value)} /></Field>
        <Field label="Home port"><input className={inputCls} value={p.homeport} onChange={e => set('homeport', e.target.value)} /></Field>
        <Field label="Motto"><input className={inputCls} value={p.motto} onChange={e => set('motto', e.target.value)} /></Field>
        <div className="col-span-2"><Field label="Meaning of name / motto"><input className={inputCls} value={p.mottoMeaning} onChange={e => set('mottoMeaning', e.target.value)} /></Field></div>
        <div className="col-span-2"><Field label="About"><textarea rows={2} className={inputCls} value={p.about} onChange={e => set('about', e.target.value)} /></Field></div>
      </div>

      <Section title="Banner photo">
        <div className="flex items-center gap-3">
          {hero ? <img src={hero} alt="Banner preview" className="w-32 h-20 object-cover rounded-lg border border-slate-700" /> : <div className="w-32 h-20 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-600">no photo</div>}
          <label className={`${btnGhost} cursor-pointer`}>Choose photo<input type="file" accept="image/*" className="hidden" onChange={upload} /></label>
          {p.heroImage && <button type="button" className={btnGhost} onClick={() => set('heroImage', undefined)}>Remove</button>}
        </div>
      </Section>

      <Section title="Key facts" action={<button type="button" className={btnGhost} onClick={() => set('facts', [...p.facts, { label: '', value: '' }])}><Plus className="w-3 h-3" /> Add</button>}>
        {p.facts.map((f, i) => (
          <div key={i} className="grid grid-cols-[10rem_1fr_auto] gap-2 items-center">
            <input className={inputCls} placeholder="Label" aria-label="Fact label" value={f.label} onChange={e => set('facts', p.facts.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
            <input className={inputCls} placeholder="Value" aria-label="Fact value" value={f.value} onChange={e => set('facts', p.facts.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} />
            <IconBtn label="Remove fact" onClick={() => set('facts', p.facts.filter((_, k) => k !== i))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
          </div>
        ))}
      </Section>

      <Section title="Specifications" action={<button type="button" className={btnGhost} onClick={() => set('specs', [...p.specs, { id: newId(), title: '', description: '', items: [{ label: '', value: '' }] }])}><Plus className="w-3 h-3" /> Add group</button>}>
        {p.specs.map((g, gi) => (
          <div key={g.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex gap-2">
              <input className={inputCls} placeholder="Group title (e.g. Weapons)" aria-label="Group title" value={g.title} onChange={e => setGroup(gi, { ...g, title: e.target.value })} />
              <IconBtn label="Move group up" disabled={gi === 0} onClick={() => set('specs', move(p.specs, gi, -1))}><ArrowUp className="w-3.5 h-3.5" /></IconBtn>
              <IconBtn label="Move group down" disabled={gi === p.specs.length - 1} onClick={() => set('specs', move(p.specs, gi, 1))}><ArrowDown className="w-3.5 h-3.5" /></IconBtn>
              <IconBtn label="Remove group" onClick={() => set('specs', p.specs.filter((_, k) => k !== gi))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
            </div>
            <input className={inputCls} placeholder="Short description (optional)" aria-label="Group description" value={g.description || ''} onChange={e => setGroup(gi, { ...g, description: e.target.value })} />
            {g.items.map((it, ii) => (
              <div key={ii} className="grid grid-cols-[9rem_1fr_1fr_auto] gap-2 items-center">
                <input className={inputCls} placeholder="Item" aria-label="Item" value={it.label} onChange={e => setGroup(gi, { ...g, items: g.items.map((x, k) => (k === ii ? { ...x, label: e.target.value } : x)) })} />
                <input className={inputCls} placeholder="Value" aria-label="Item value" value={it.value} onChange={e => setGroup(gi, { ...g, items: g.items.map((x, k) => (k === ii ? { ...x, value: e.target.value } : x)) })} />
                <input className={inputCls} placeholder="Note (optional)" aria-label="Item note" value={it.note || ''} onChange={e => setGroup(gi, { ...g, items: g.items.map((x, k) => (k === ii ? { ...x, note: e.target.value } : x)) })} />
                <IconBtn label="Remove item" onClick={() => setGroup(gi, { ...g, items: g.items.filter((_, k) => k !== ii) })}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
              </div>
            ))}
            <button type="button" className={btnGhost} onClick={() => setGroup(gi, { ...g, items: [...g.items, { label: '', value: '' }] })}><Plus className="w-3 h-3" /> Add item</button>
          </div>
        ))}
      </Section>

      <Section title="Timeline and news" action={<button type="button" className={btnGhost} onClick={() => set('timeline', [...p.timeline, { id: newId(), date: '', title: '', description: '' }])}><Plus className="w-3 h-3" /> Add</button>}>
        {p.timeline.map((t, i) => (
          <div key={t.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="grid grid-cols-[10rem_1fr_auto_auto_auto] gap-2 items-center">
              <input className={inputCls} placeholder="Date (any format)" aria-label="Timeline date" value={t.date} onChange={e => setTl(i, { ...t, date: e.target.value })} />
              <input className={inputCls} placeholder="Title" aria-label="Timeline title" value={t.title} onChange={e => setTl(i, { ...t, title: e.target.value })} />
              <IconBtn label="Move up" disabled={i === 0} onClick={() => set('timeline', move(p.timeline, i, -1))}><ArrowUp className="w-3.5 h-3.5" /></IconBtn>
              <IconBtn label="Move down" disabled={i === p.timeline.length - 1} onClick={() => set('timeline', move(p.timeline, i, 1))}><ArrowDown className="w-3.5 h-3.5" /></IconBtn>
              <IconBtn label="Remove entry" onClick={() => set('timeline', p.timeline.filter((_, k) => k !== i))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
            </div>
            <textarea rows={2} className={inputCls} placeholder="What happened" aria-label="Timeline description" value={t.description} onChange={e => setTl(i, { ...t, description: e.target.value })} />
            <input className={inputCls} placeholder="Source (optional)" aria-label="Timeline source" value={t.source || ''} onChange={e => setTl(i, { ...t, source: e.target.value })} />
          </div>
        ))}
      </Section>

      {error && <div className="text-xs text-rose-400" role="alert">{error}</div>}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
        <button className={btnGhost} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} onClick={save}>Save profile</button>
      </div>

      {ships.length > 1 && (
        <Section title="Remove this ship">
          <p className="text-xs text-slate-400">Deletes everything held for {ship.name}: profile, personnel, leave, logins and training. This cannot be undone. Take a backup first (Nominal Roll &gt; Backup all data). Type the ship's name to confirm.</p>
          <div className="flex gap-2">
            <input className={inputCls} value={confirmName} onChange={e => setConfirmName(e.target.value)} placeholder={ship.name} aria-label="Type the ship name to confirm" />
            <button className={btnDanger} disabled={confirmName !== ship.name} onClick={() => deleteShip(shipId)}>Delete ship data</button>
          </div>
        </Section>
      )}
    </Modal>
  );
};
