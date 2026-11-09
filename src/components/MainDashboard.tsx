/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ScheduledSession, Topic, HolidayEntry, ScheduleConflict, ActiveTab } from '../types';
import { getDepartmentConfig, ALL_TRACK_DEPARTMENTS } from '../data/departments';
import { findUnscheduledTopics, formatDate, generateAnnualWorkingSlots } from '../utils/scheduler';
import { usePortal } from '../portal/store';
import { heroOf } from '../portal/shipImages';
import { shipTitle } from '../portal/ship';
import { useSettings } from '../utils/settingsContext';
import { describeDays, describeTime } from '../utils/settings';
import { ReadinessRing } from './ReadinessRing';
import { DepartmentAnalyticsChart } from './DepartmentAnalyticsChart';
import { MonthlyBulletinModal } from './MonthlyBulletinModal';
import { ChevronLeft, ChevronRight, Download, Printer, Upload, Calendar as CalendarIcon, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

interface MainDashboardProps {
  sessions: ScheduledSession[];
  topics: Topic[];
  blackoutDates: HolidayEntry[];
  conflicts: ScheduleConflict[];
  year: number;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenIngestion: () => void;
  onOpenBlackouts: () => void;
  onExportCsv: () => void;
  onPrint: () => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MainDashboard: React.FC<MainDashboardProps> = ({
  sessions, topics, blackoutDates, conflicts, year,
  onNavigateTab, onOpenIngestion, onOpenBlackouts, onExportCsv, onPrint
}) => {
  const settings = useSettings();
  const { ship, shipId } = usePortal();
  const hero = heroOf(shipId, ship);
  const today = formatDate(new Date());
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return now.getFullYear() === year ? now.getMonth() : 0;
  });
  const [isBulletinModalOpen, setIsBulletinModalOpen] = useState(false);

  const stats = useMemo(() => {
    const completed = sessions.filter(s => s.status === 'Completed').length;
    const workingDays = generateAnnualWorkingSlots(year, blackoutDates, settings).length;
    const unscheduled = findUnscheduledTopics(topics, sessions);
    return { completed, workingDays, unscheduled };
  }, [sessions, topics, blackoutDates, year, settings]);

  const byDate = useMemo(() => {
    const m = new Map<string, ScheduledSession>();
    sessions.forEach(s => m.set(s.date, s));
    return m;
  }, [sessions]);
  const holidayByDate = useMemo(() => new Map(blackoutDates.map(h => [h.date, h])), [blackoutDates]);

  const upcoming = useMemo(
    () => sessions.filter(s => s.date >= today && s.status === 'Scheduled').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6),
    [sessions, today]
  );

  const deptRows = useMemo(() => ALL_TRACK_DEPARTMENTS.map(name => ({
    name,
    topics: topics.filter(t => t.department === name).length,
    sessions: sessions.filter(s => s.department === name).length,
    done: sessions.filter(s => s.department === name && s.status === 'Completed').length
  })), [sessions, topics]);

  // Month grid, Monday first
  const grid = useMemo(() => {
    const first = new Date(year, month, 1, 12);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => formatDate(new Date(year, month, i + 1, 12)))] as Array<string | null>;
  }, [year, month]);

  const progress = sessions.length ? Math.round((stats.completed / sessions.length) * 100) : 0;
  const errors = conflicts.filter(c => c.severity === 'error').length;
  const empty = topics.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn text-slate-700 bg-[#fcfdfe] p-4 rounded-3xl">
      {/* Left Col: Status & Quick Stats */}
      <div className="lg:col-span-4 space-y-6">
        <div className="flex flex-col gap-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="flex items-center gap-4">
            {hero && <img src={hero} alt={`${ship.name} at sea`} className="w-16 h-12 rounded-lg object-cover border border-slate-200" />}
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-slate-800 tracking-tight truncate">
                {shipTitle(ship)}
              </h1>
              <p className="text-[11px] text-slate-500 truncate">{describeTime(settings)} · {describeDays(settings)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button onClick={onOpenIngestion} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm">
              <Upload className="w-3.5 h-3.5" /> Import
            </button>
            <button onClick={onOpenBlackouts} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg border border-slate-200 text-xs font-semibold transition-colors">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" /> Holidays
            </button>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-4 shadow-sm">
           <ReadinessRing progress={progress} label="Completed" scheduledCount={stats.completed} annualGoal={sessions.length} size={160} strokeWidth={12} />
           <div className="text-center">
             <div className="text-2xl font-black text-slate-800">{progress}%</div>
             <div className="text-[11px] text-slate-500 uppercase tracking-wider">Annual Progress</div>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { k: 'Topics', v: topics.length, sub: `${stats.unscheduled.length} pending` },
            { k: 'Sessions', v: sessions.length, sub: `${stats.workingDays} slots` },
            { k: 'Completed', v: stats.completed, sub: `of ${sessions.length}` },
            { k: 'Conflicts', v: conflicts.length, sub: `${errors} critical` }
          ].map(c => (
            <div key={c.k} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="text-[10px] font-mono uppercase text-slate-400">{c.k}</div>
              <div className="text-xl font-black font-mono text-slate-800 mt-1">{c.v}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Col: Main Activity */}
      <div className="lg:col-span-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Calendar Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800 font-mono">{MONTHS[month]} {year}</h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsBulletinModalOpen(true)}
                  title={`Export ${MONTHS[month]} ${year} Notice Board PDF`}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-colors active:scale-95"
                >
                  <Printer className="w-3 h-3 text-blue-600" />
                  <span>Bulletin PDF</span>
                </button>
                <button aria-label="Prev" disabled={month === 0} onClick={() => setMonth(m => m - 1)} className="p-1 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <button aria-label="Next" disabled={month === 11} onClick={() => setMonth(m => m + 1)} className="p-1 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono">
              {DAYS.map(d => <div key={d} className="text-slate-400 font-bold py-1">{d}</div>)}
              {grid.map((date, i) => {
                if (!date) return <div key={`pad-${i}`} />;
                const s = byDate.get(date);
                const h = holidayByDate.get(date);
                return (
                  <button
                    key={date}
                    onClick={() => onNavigateTab('PUBLIC')}
                    title={s ? `${s.department}: ${s.title}` : h ? h.name : undefined}
                    className={`h-10 rounded-lg border flex flex-col items-center justify-center transition-colors ${date === today ? 'border-slate-400 bg-slate-100' : 'border-slate-100'} ${h ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className={h ? 'text-slate-400' : 'text-slate-600'}>{Number(date.slice(8))}</span>
                    {s && <span className="w-1 h-1 rounded-full mt-1" style={{ background: getDepartmentConfig(s.department).color }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Next Sessions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Upcoming</h3>
            <div className="space-y-2">
              {upcoming.length === 0 && <p className="text-xs text-slate-500">No upcoming sessions.</p>}
              {upcoming.map(s => (
                <div key={s.id} onClick={() => onNavigateTab('PUBLIC')} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 cursor-pointer transition-colors">
                  <div className="w-1 self-stretch rounded-full" style={{ background: getDepartmentConfig(s.department).color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800 truncate">{s.title}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{s.date} · {s.department}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Visualization Component: Departmental Training Completion Rates & Attendance Trends (Recharts) */}
        <DepartmentAnalyticsChart
          sessions={sessions}
          topics={topics}
          year={year}
          onNavigateTab={onNavigateTab}
        />

        {/* Coverage / Dept Cards */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800">Departmental Quota & Readiness</h3>
            <button
              onClick={() => onNavigateTab('QUARTERLY')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>Quarterly Trends & Hours →</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {deptRows.map(r => (
              <div key={r.name} onClick={() => onNavigateTab('DEPARTMENTS')} className="p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-slate-300 transition-colors group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 group-hover:text-slate-600 transition-colors">
                    <span className="w-2 h-2 rounded-full" style={{ background: getDepartmentConfig(r.name).color }} /> {r.name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">{r.done}/{r.sessions} done</div>
                </div>
                <div className="mt-2 h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 transition-all" style={{ width: `${r.sessions ? (r.done/r.sessions)*100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Notice Board Bulletin PDF Modal */}
      {isBulletinModalOpen && (
        <MonthlyBulletinModal
          isOpen={isBulletinModalOpen}
          onClose={() => setIsBulletinModalOpen(false)}
          sessions={sessions}
          holidays={blackoutDates}
          shipName={ship.name}
          shipPennant={ship.pennant}
          initialMonthDate={new Date(year, month, 1)}
          settings={settings}
        />
      )}
    </div>
  );
};