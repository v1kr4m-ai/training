/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Settings2, Trash2 } from 'lucide-react';
import { DEPARTMENT_NAMES, getDepartmentConfig } from '../../data/departments';
import { onLeave, todayIso } from '../leaveLogic';
import { usePortal } from '../store';
import { btnGhost, btnPrimary, Card, Empty, inputCls, PageHeader } from '../ui';
import { DepartmentsOrbit } from './DepartmentsOrbit';
import { DepartmentsManager } from '../DepartmentsManager';

export const DepartmentsPage: React.FC<{ selected: string | null; go: (p: string) => void }> = ({ selected, go }) => {
  const { db, user, update, subDepartments } = usePortal();
  const [newSub, setNewSub] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const isAdmin = user?.role === 'ADMIN';
  const awayToday = useMemo(() => new Set(onLeave(db, todayIso()).map(r => r.personId)), [db]);

  if (selected && DEPARTMENT_NAMES.includes(selected)) {
    const cfg = getDepartmentConfig(selected);
    const subs = subDepartments(selected);
    const people = db.personnel.filter(p => p.active && p.department === selected);
    const orphan = people.filter(p => !subs.includes(p.subDepartment));

    const setSubs = (next: string[]) => update(d => ({ ...d, subDepartments: { ...d.subDepartments, [selected]: next } }));
    const rename = (from: string, to: string) => {
      to = to.trim();
      if (!to || to === from) return;
      if (subs.includes(to)) return setError(`"${to}" already exists.`);
      setError(null);
      update(d => ({
        ...d,
        subDepartments: { ...d.subDepartments, [selected]: subs.map(s => (s === from ? to : s)) },
        personnel: d.personnel.map(p => (p.department === selected && p.subDepartment === from ? { ...p, subDepartment: to } : p))
      }));
    };
    const remove = (name: string) => {
      const used = db.personnel.filter(p => p.department === selected && p.subDepartment === name).length;
      if (used > 0) return setError(`${used} personnel are in "${name}". Move them to another section first.`);
      setError(null);
      setSubs(subs.filter(s => s !== name));
    };
    const add = () => {
      const n = newSub.trim();
      if (!n) return;
      if (subs.includes(n)) return setError(`"${n}" already exists.`);
      setError(null);
      setSubs([...subs, n]);
      setNewSub('');
    };

    return (
      <div className="space-y-6">
        <PageHeader
          title={cfg.name}
          subtitle={cfg.description}
          actions={<button className={btnGhost} onClick={() => go('departments')}><ArrowLeft className="w-3.5 h-3.5" /> All departments</button>}
        />
        {error && <div className="text-xs text-rose-400" role="alert">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Sections" className="lg:col-span-1">
            <ul className="space-y-1.5">
              {subs.map(s => (
                <li key={s} className="flex items-center gap-2">
                  {isAdmin ? (
                    <input
                      key={s}
                      defaultValue={s}
                      aria-label={`Rename ${s}`}
                      onBlur={e => rename(s, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className={inputCls}
                    />
                  ) : (
                    <span className="flex-1 text-xs text-slate-200">{s}</span>
                  )}
                  <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{people.filter(p => p.subDepartment === s).length}</span>
                  {isAdmin && (
                    <button aria-label={`Remove ${s}`} onClick={() => remove(s)} className="p-1.5 text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </li>
              ))}
            </ul>
            {isAdmin && (
              <div className="flex gap-2 mt-3">
                <input className={inputCls} placeholder="New section" value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
                <button className={btnPrimary} onClick={add}><Plus className="w-3.5 h-3.5" /> Add</button>
              </div>
            )}
          </Card>

          <Card title={`Roll (${people.length})`} className="lg:col-span-2">
            {people.length === 0 ? (
              <Empty>No personnel in {cfg.name} yet. Add them in Nominal Roll.</Empty>
            ) : (
              <div className="space-y-4">
                {[...subs, ...(orphan.length ? ['(no section)'] : [])].map(s => {
                  const list = s === '(no section)' ? orphan : people.filter(p => p.subDepartment === s);
                  if (list.length === 0) return null;
                  return (
                    <div key={s}>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">{s} · {list.length}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {list.map(p => (
                          <div key={p.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs">
                            <span className="text-slate-200 truncate">{p.rank} {p.name}</span>
                            {awayToday.has(p.id) ? <span className="text-[10px] text-amber-400 font-semibold">On leave</span> : <span className="text-[10px] text-emerald-500">Present</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        subtitle="Turn the ring to browse the ship's departments; open one to see its sections and Nominal Roll."
        actions={isAdmin && <button className={btnGhost} onClick={() => setManaging(true)}><Settings2 className="w-3.5 h-3.5" /> Manage departments</button>}
      />
      <DepartmentsOrbit go={go} />
      {managing && <DepartmentsManager onClose={() => setManaging(false)} />}
    </div>
  );
};
