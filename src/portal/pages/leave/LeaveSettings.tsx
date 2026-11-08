/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { newId } from '../../db';
import { usePortal } from '../../store';
import { btnGhost, Card, Field, inputCls } from '../../ui';

export const LeaveSettings: React.FC = () => {
  const { db, update } = usePortal();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setType = (id: string, patch: Partial<{ name: string; annualDays: number | null }>) =>
    update(d => ({ ...d, leaveTypes: d.leaveTypes.map(t => (t.id === id ? { ...t, ...patch } : t)) }));

  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (db.leaveTypes.some(t => t.name.toLowerCase() === n.toLowerCase())) return setError('That leave type already exists.');
    setError(null);
    update(d => ({ ...d, leaveTypes: [...d.leaveTypes, { id: newId(), name: n, annualDays: null }] }));
    setName('');
  };

  const remove = (id: string) => {
    if (db.leaveRequests.some(r => r.typeId === id)) return setError('Leave requests already use this type, so it cannot be removed.');
    setError(null);
    update(d => ({ ...d, leaveTypes: d.leaveTypes.filter(t => t.id !== id) }));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card title="Leave types and yearly entitlement">
        <p className="text-xs text-amber-300 mb-3">The day counts below are starting values. Set them to match the current leave regulations. Leave a count blank for a type that is tracked but not capped.</p>
        {error && <div className="text-xs text-rose-400 mb-2" role="alert">{error}</div>}
        <div className="space-y-2">
          {db.leaveTypes.map(t => (
            <div key={t.id} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-center">
              <input className={inputCls} defaultValue={t.name} aria-label="Leave type name" onBlur={e => e.target.value.trim() && setType(t.id, { name: e.target.value.trim() })} />
              <input className={inputCls} type="number" min={0} placeholder="no cap" aria-label={`${t.name} days per year`}
                defaultValue={t.annualDays ?? ''} onBlur={e => setType(t.id, { annualDays: e.target.value === '' ? null : Math.max(0, Math.floor(+e.target.value)) })} />
              <button className={btnGhost} onClick={() => remove(t.id)}>Remove</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input className={inputCls} placeholder="New leave type" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button className={btnGhost} onClick={add}><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
      </Card>

      <Card title="Manpower warning">
        <Field label="Warn when more than this share of a department is on leave on one day (%)">
          <input className={`${inputCls} w-28`} type="number" min={1} max={100} defaultValue={db.maxLeavePctPerDept}
            onBlur={e => { const v = Math.round(+e.target.value); if (v >= 1 && v <= 100) update(d => ({ ...d, maxLeavePctPerDept: v })); }} />
        </Field>
      </Card>
    </div>
  );
};
