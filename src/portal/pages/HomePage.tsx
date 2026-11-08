/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRight, CalendarDays, Newspaper, Pencil } from 'lucide-react';
import { getDepartmentConfig } from '../../data/departments';
import { todayIso } from '../leaveLogic';
import { trainingKey } from '../registry';
import { shipTitle } from '../ship';
import { heroOf } from '../shipImages';
import { ShipProfileEditor } from '../ShipProfileEditor';
import { useLiveStats } from '../stats';
import { usePortal } from '../store';
import { Card } from '../ui';
import type { ScheduledSession } from '../../types';

const glass = 'rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md';

/** Next scheduled training session from this ship's saved training state, if any. */
function nextTraining(shipId: string, today: string): ScheduledSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(trainingKey(shipId)) || 'null');
    const list: ScheduledSession[] = Array.isArray(s?.sessions) ? s.sessions : [];
    return list.filter(x => x.status === 'Scheduled' && x.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  } catch {
    return null;
  }
}

export const HomePage: React.FC<{ go: (p: string) => void }> = ({ go }) => {
  const { db, user, ship, shipId } = usePortal();
  const stats = useLiveStats();
  const isAdmin = user?.role === 'ADMIN';
  const [editing, setEditing] = useState(false);
  const [group, setGroup] = useState(0);

  const training = nextTraining(shipId, todayIso());
  const hero = heroOf(shipId, ship);
  const hasDossier = !!(ship.about || ship.facts.length || ship.specs.length || ship.timeline.length);
  const specGroup = ship.specs[Math.min(group, ship.specs.length - 1)];
  const latest = ship.timeline[ship.timeline.length - 1];
  const [prefix, ...rest] = ship.name.split(/\s+/);
  const bold = rest.length ? rest.join(' ') : prefix;
  const light = rest.length ? `${prefix} ` : '';
  const commandWords = ship.command.split(/\s+/).filter(Boolean);
  const first = user?.displayName.split(/\s+/)[0];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative rounded-[2rem] overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black">
        {hero && <img src={hero} alt={`${ship.name} at sea`} className="absolute inset-0 w-full h-full object-cover brightness-[0.55]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
        {isAdmin && (
          <button onClick={() => setEditing(true)} className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-black/50 hover:bg-black/70 text-[11px] text-white backdrop-blur">
            <Pencil className="w-3 h-3" /> Edit ship profile
          </button>
        )}

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 sm:p-8 min-h-[640px]">
          {/* Left: stats on top, headline at the bottom */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-8">
            <div className={`${glass} p-4 max-w-sm`}>
              <p className="text-[11px] text-white/60">On the Nominal Roll</p>
              <p className="text-3xl font-light text-white mt-0.5"><strong className="font-bold">{stats.active}</strong></p>
              <div className="flex gap-4 mt-3 text-[11px]">
                <span className="text-white/70"><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" /><strong className="text-white">{stats.onBoard}</strong> present</span>
                <span className="text-white/70"><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" /><strong className="text-white">{stats.away}</strong> on leave</span>
              </div>
            </div>

            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-black/40 backdrop-blur text-[11px] text-white/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {first ? `Welcome, ${first}` : 'Welcome'}{ship.homeport ? ` · ${ship.homeport.split(',')[0]}` : ''}
              </span>

              <h1 className="text-5xl sm:text-6xl font-light text-white tracking-tight leading-[1.05]">
                {light}<strong className="font-bold">{bold}</strong>
                {ship.pennant && <span className="block text-2xl sm:text-3xl text-white/70 mt-1"><strong className="font-semibold text-white">{ship.pennant}</strong></span>}
              </h1>

              {(ship.motto || commandWords.length > 0) && (
                <p className="text-sm text-white/70 max-w-lg">
                  {ship.motto && <><em className="text-white/90">{ship.motto}</em>{ship.mottoMeaning ? ` — ${ship.mottoMeaning}` : ''}</>}
                  {!ship.motto && ship.about}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => go('leave')} className="inline-flex items-center gap-3 pl-5 pr-1.5 py-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur text-sm text-white hover:bg-black/70">
                  Open Leave
                  <span className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center"><ArrowRight className="w-4 h-4" /></span>
                </button>
                <button onClick={() => go('training')} className="inline-flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white">
                  <CalendarDays className="w-4 h-4" /> Training calendar
                </button>
              </div>
            </div>
          </div>

          {/* Right: floating glass panels */}
          <div className="lg:col-span-5 flex flex-col gap-4 lg:pt-10">
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => go('training')} className={`${glass} p-4 text-left hover:bg-black/55`}>
                <p className="text-[11px] text-white/60">Next training</p>
                {training ? (
                  <>
                    <p className="text-sm font-semibold text-white mt-1 line-clamp-2">{training.title}</p>
                    <p className="text-[11px] font-mono text-white/60 mt-1">{training.date} · {training.startTime}</p>
                  </>
                ) : (
                  <p className="text-xs text-white/50 mt-1">Nothing scheduled</p>
                )}
              </button>
              <div className={`${glass} p-4`}>
                <p className="text-[11px] text-white/60 flex items-center gap-1.5"><Newspaper className="w-3 h-3" /> Latest</p>
                {latest ? (
                  <>
                    <p className="text-sm font-semibold text-white mt-1 line-clamp-2">{latest.title}</p>
                    <p className="text-[11px] text-white/60 mt-1">{latest.date}</p>
                  </>
                ) : (
                  <p className="text-xs text-white/50 mt-1">No timeline entries</p>
                )}
              </div>
            </div>

            <div className={`${glass} p-4 flex-1`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white">Departments</p>
                <button onClick={() => go('departments')} className="text-[11px] text-white/60 hover:text-white">All</button>
              </div>
              <ul className="space-y-2">
                {stats.perDept.map(r => {
                  const cfg = getDepartmentConfig(r.name);
                  const state = r.total === 0 ? 'Nominal Roll empty' : r.away === 0 ? 'All present' : `${r.away} on leave`;
                  const dot = r.total === 0 ? 'bg-white/30' : r.away === 0 ? 'bg-emerald-400' : 'bg-amber-400';
                  return (
                    <li key={r.name}>
                      <button onClick={() => go(`departments/${encodeURIComponent(r.name)}`)} className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/5 text-left">
                        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-black shrink-0" style={{ background: cfg.color }}>{cfg.code}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-white">{r.name}</span>
                          <span className="block text-[10px] text-white/50">{r.total} member{r.total === 1 ? '' : 's'}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] text-white/70"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{state}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {db.personnel.length === 0 && (
        <Card>
          <p className="text-xs text-slate-300">
            No personnel have been added yet. Add or import the Nominal Roll in <button className="text-white underline" onClick={() => go('personnel')}>Nominal Roll</button>;
            departments, leave and the daily figures all build on it.
          </p>
        </Card>
      )}

      {/* Ship dossier */}
      {!hasDossier && isAdmin && (
        <Card>
          <p className="text-xs text-slate-300">
            This ship's profile is empty. Add its class, key facts, specifications and history so Home shows the ship's outlook.{' '}
            <button className="text-white underline" onClick={() => setEditing(true)}>Edit ship profile</button>
          </p>
        </Card>
      )}

      {(ship.about || ship.facts.length > 0) && (
        <Card title={`About ${ship.name}`}>
          {ship.about && <p className="text-sm text-slate-300 mb-4 max-w-3xl">{ship.about}</p>}
          {ship.facts.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ship.facts.map((f, i) => (
                <div key={i} className="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                  <dt className="text-[10px] font-mono uppercase text-white/50">{f.label}</dt>
                  <dd className="text-xs text-white mt-0.5">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      )}

      {ship.specs.length > 0 && specGroup && (
        <Card title="Specifications">
          <div className="flex flex-wrap gap-2 mb-4" role="tablist">
            {ship.specs.map((g, i) => (
              <button key={g.id} role="tab" aria-selected={i === group} onClick={() => setGroup(i)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border ${i === group ? 'bg-white text-black border-transparent' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'}`}>
                {g.title}
              </button>
            ))}
          </div>
          {specGroup.description && <p className="text-xs text-slate-400 mb-3">{specGroup.description}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {specGroup.items.map((it, i) => (
              <div key={i} className="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <div className="text-[10px] font-mono uppercase text-white/50">{it.label}</div>
                <div className="text-xs font-semibold text-white mt-0.5">{it.value}</div>
                {it.note && <div className="text-[11px] text-slate-400 mt-0.5">{it.note}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {ship.timeline.length > 0 && (
        <Card title="Timeline and news">
          <ol className="relative border-l border-white/10 ml-2 space-y-5">
            {ship.timeline.map(t => (
              <li key={t.id} className="pl-5 relative">
                <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white" />
                <div className="text-[11px] font-mono text-emerald-300">{t.date}</div>
                <div className="text-sm font-semibold text-white">{t.title}</div>
                {t.description && <p className="text-xs text-slate-300 mt-0.5 max-w-3xl">{t.description}</p>}
                {t.source && <p className="text-[10px] text-slate-500 mt-0.5">Source: {t.source}</p>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {editing && <ShipProfileEditor onClose={() => setEditing(false)} />}
    </div>
  );
};
