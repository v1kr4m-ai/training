/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ActiveTab, ScheduledSession, Topic } from '../types';
import { ALL_TRACK_DEPARTMENTS, getDepartmentConfig } from '../data/departments';
import { Calendar, Sliders } from 'lucide-react';
import { useSettings } from '../utils/settingsContext';
import { describeDays, describeTime } from '../utils/settings';

interface DepartmentsShowcasePageProps {
  sessions: ScheduledSession[];
  topics: Topic[];
  onNavigateTab: (tab: ActiveTab) => void;
}

export const DepartmentsShowcasePage: React.FC<DepartmentsShowcasePageProps> = ({ sessions, topics, onNavigateTab }) => {
  const settings = useSettings();
  const [active, setActive] = useState<string>(ALL_TRACK_DEPARTMENTS[0]);
  const cfg = getDepartmentConfig(active);
  const today = new Date().toISOString().slice(0, 10);

  const view = useMemo(() => {
    const dTopics = topics.filter(t => t.department === active);
    const dSessions = sessions.filter(s => s.department === active).sort((a, b) => a.date.localeCompare(b.date));
    const speakers = [...new Set(dTopics.map(t => t.speaker).filter(Boolean))];
    const subs = cfg.subDepartments.map(name => ({
      name,
      topics: dTopics.filter(t => t.subDepartment === name).length,
      sessions: dSessions.filter(s => s.subDepartment === name).length
    }));
    const known = new Set(cfg.subDepartments);
    const other = dTopics.filter(t => !known.has(t.subDepartment)).length;
    return {
      topics: dTopics.length,
      sessions: dSessions.length,
      done: dSessions.filter(s => s.status === 'Completed').length,
      next: dSessions.find(s => s.date >= today && s.status === 'Scheduled'),
      last: [...dSessions].reverse().find(s => s.date < today),
      speakers,
      subs,
      other
    };
  }, [active, topics, sessions, cfg, today]);

  return (
    <div className="space-y-6 animate-fadeIn text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Departments</h1>
          <p className="text-xs text-slate-400 mt-1">Training load per shipboard department, from the current schedule.</p>
        </div>
        <button
          onClick={() => onNavigateTab('ADMIN')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shrink-0"
        >
          <Sliders className="w-4 h-4" /> Open Training Matrix
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_TRACK_DEPARTMENTS.map(name => (
          <button
            key={name}
            onClick={() => setActive(name)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              active === name ? 'text-white border-transparent' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            style={active === name ? { background: getDepartmentConfig(name).color } : undefined}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="p-6 bg-slate-900/90 border rounded-2xl space-y-5" style={{ borderColor: `${cfg.color}66` }}>
        <div>
          <h2 className="text-2xl font-black text-white" style={{ color: cfg.color }}>{cfg.name}</h2>
          <p className="text-sm text-slate-300 mt-1 max-w-3xl">{cfg.description}</p>
          <p className="text-[11px] font-mono text-slate-500 mt-1">
            {describeDays(settings)} · {describeTime(settings)}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Topics', view.topics],
            ['Sessions scheduled', view.sessions],
            ['Completed', view.done],
            ['Remaining', view.sessions - view.done]
          ].map(([k, v]) => (
            <div key={k as string} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400">{k}</div>
              <div className="text-xl font-black font-mono text-white">{v}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <div className="font-bold text-white">Sections</div>
            {view.subs.map(s => (
              <div key={s.name} className="flex justify-between text-slate-300">
                <span>{s.name}</span>
                <span className="font-mono text-slate-400">{s.topics} topics · {s.sessions} sessions</span>
              </div>
            ))}
            {view.other > 0 && <div className="text-amber-400">{view.other} topic(s) use a section not listed above.</div>}
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <div className="font-bold text-white">Schedule</div>
            <div className="text-slate-300">
              Next: {view.next ? `${view.next.date} · ${view.next.title}` : <span className="text-slate-500">none scheduled</span>}
            </div>
            <div className="text-slate-300">
              Last held: {view.last ? `${view.last.date} · ${view.last.title}` : <span className="text-slate-500">none yet</span>}
            </div>
            <div className="text-slate-300">
              Speakers: {view.speakers.length ? view.speakers.join(', ') : <span className="text-slate-500">none recorded</span>}
            </div>
            <button onClick={() => onNavigateTab('PUBLIC')} className="mt-2 flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-semibold">
              <Calendar className="w-3.5 h-3.5" /> Open calendar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
