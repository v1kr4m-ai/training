/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SHIP_WIDE } from '../data/departments';
import { addDepartment, deptList, hasDept, removeDepartment, renameDepartment, renameInTraining, trainingUses } from './departmentOps';
import { usePortal } from './store';
import { btnGhost, btnPrimary, inputCls, Modal } from './ui';

/** Add, rename, describe and remove the ship's departments. Everything that names a department (people, sections, training) follows a rename. */
export const DepartmentsManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { db, update, shipId } = usePortal();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const list = deptList(db);

  const taken = (name: string, except?: string) => name.toLowerCase() === SHIP_WIDE.toLowerCase() || list.some(e => e.name !== except && e.name.toLowerCase() === name.toLowerCase());

  const rename = (from: string, raw: string) => {
    const to = raw.trim();
    if (!to || to === from) return;
    if (taken(to, from)) return setError(`"${to}" already exists.`);
    setError(null);
    update(d => renameDepartment(d, from, to));
    renameInTraining(shipId, from, to);
  };
  const patch = (name: string, change: Partial<(typeof list)[number]>) =>
    update(d => ({ ...d, departments: deptList(d).map(e => (e.name === name ? { ...e, ...change } : e)) }));
  const remove = (name: string) => {
    const people = db.personnel.filter(p => p.department === name).length;
    const topics = trainingUses(shipId, name);
    if (list.length <= 1) return setError('The ship needs at least one department.');
    if (people > 0 || topics > 0) return setError(`${name} still has ${people} people on the Nominal Roll and ${topics} training topics. Move or delete them first.`);
    if (!window.confirm(`Remove the department "${name}"?`)) return;
    setError(null);
    update(d => removeDepartment(d, name));
  };
  const add = () => {
    const n = newName.trim();
    if (!n) return;
    if (taken(n) || hasDept(db, n)) return setError(`"${n}" already exists.`);
    setError(null);
    update(d => addDepartment(d, n));
    setNewName('');
  };

  return (
    <Modal title="Manage departments" onClose={onClose} wide>
      <p className="text-xs text-slate-400">
        Departments take turns in the training rota and group the Nominal Roll and leave figures. Renaming one updates the Nominal Roll, its sections and its training topics.
        "{SHIP_WIDE}" training is always there and cannot be changed.
      </p>
      <ul className="space-y-2">
        {list.map(e => (
          <li key={e.name} className="grid grid-cols-12 gap-2 items-center">
            <input key={`n-${e.name}`} className={`${inputCls} col-span-4`} defaultValue={e.name} aria-label={`Name of ${e.name}`}
              onBlur={ev => rename(e.name, ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }} />
            <input className={`${inputCls} col-span-2 font-mono uppercase`} maxLength={4} defaultValue={e.code} aria-label={`Code of ${e.name}`}
              onBlur={ev => patch(e.name, { code: ev.target.value.trim().toUpperCase() || e.code })} />
            <input className={`${inputCls} col-span-5`} defaultValue={e.description} placeholder="What the department covers" aria-label={`Description of ${e.name}`}
              onBlur={ev => patch(e.name, { description: ev.target.value.trim() })} />
            <button aria-label={`Remove ${e.name}`} onClick={() => remove(e.name)} className="col-span-1 p-1.5 text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5 mx-auto" /></button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="New department" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button className={btnPrimary} onClick={add}><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>
      {error && <div className="text-xs text-rose-400" role="alert">{error}</div>}
      <div className="flex justify-end"><button className={btnGhost} onClick={onClose}>Done</button></div>
    </Modal>
  );
};
