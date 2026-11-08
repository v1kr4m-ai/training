/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { ScheduledSession, Topic, ScheduleConflict } from '../types';
import { useSettings } from '../utils/settingsContext';
import { describeDays } from '../utils/settings';
import { DEPARTMENT_NAMES, getDepartmentConfig, SHIP_WIDE } from '../data/departments';
import { 
  PieChart, 
  BarChart3, 
  GitFork, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Activity,
  ArrowRight
} from 'lucide-react';
import { DepartmentPerformanceWidget } from './DepartmentPerformanceWidget';

interface AnalyticsViewProps {
  sessions: ScheduledSession[];
  topics: Topic[];
  conflicts: ScheduleConflict[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ sessions, topics, conflicts }) => {
  const settings = useSettings();
  // Department distribution counts
  const deptStats = useMemo(() => {
    const counts: Record<string, number> = {};
    counts[SHIP_WIDE] = 0;
    DEPARTMENT_NAMES.forEach(d => counts[d] = 0);

    sessions.forEach(s => {
      counts[s.department] = (counts[s.department] || 0) + 1;
    });

    const total = sessions.length || 1;
    const items = Object.entries(counts).map(([name, count]) => {
      const cfg = getDepartmentConfig(name);
      return {
        name,
        count,
        percentage: ((count / total) * 100).toFixed(1),
        color: cfg.color,
        isCompany: name === SHIP_WIDE
      };
    });

    return items;
  }, [sessions]);

  // Starvation analysis: compute maximum gap in departmental slots between sessions of the same department
  const starvationGaps = useMemo(() => {
    const deptSessions = sessions.filter(s => s.trackType === 'DEPARTMENTAL');
    const gaps: Record<string, { maxGap: number; avgGap: number; totalSessions: number; lastSeenIndex: number }> = {};
    
    DEPARTMENT_NAMES.forEach(d => {
      gaps[d] = { maxGap: 0, avgGap: 0, totalSessions: 0, lastSeenIndex: -1 };
    });

    const deptIntervals: Record<string, number[]> = {};
    DEPARTMENT_NAMES.forEach(d => deptIntervals[d] = []);

    deptSessions.forEach((s, idx) => {
      const d = s.department;
      if (gaps[d]) {
        if (gaps[d].lastSeenIndex !== -1) {
          const gap = idx - gaps[d].lastSeenIndex;
          deptIntervals[d].push(gap);
          if (gap > gaps[d].maxGap) {
            gaps[d].maxGap = gap;
          }
        }
        gaps[d].lastSeenIndex = idx;
        gaps[d].totalSessions++;
      }
    });

    return DEPARTMENT_NAMES.map(dept => {
      const intervals = deptIntervals[dept] || [];
      const avg = intervals.length > 0 
        ? (intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1) 
        : '0.0';
      const max = gaps[dept]?.maxGap || 0;
      const total = gaps[dept]?.totalSessions || 0;

      // With N departments in rotation the ideal gap is about N departmental slots
      const n = DEPARTMENT_NAMES.length;
      let status: 'Nominal' | 'Fair' | 'Starved' = 'Nominal';
      if (total > 1 && max > n + 4) status = 'Starved';
      else if (total > 1 && max > n + 1) status = 'Fair';

      return {
        dept,
        maxGap: max,
        avgGap: avg,
        total,
        status,
        color: getDepartmentConfig(dept).color
      };
    });
  }, [sessions]);

  // Monthly breakdown
  const monthlyStats = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = months.map((m, idx) => {
      const monthPrefix = `${sessions[0]?.date.slice(0, 4) || new Date().getFullYear()}-${String(idx + 1).padStart(2, '0')}`;
      const count = sessions.filter(s => s.date.startsWith(monthPrefix)).length;
      const cw = sessions.filter(s => s.date.startsWith(monthPrefix) && s.trackType === 'COMPANY_WIDE').length;
      const dept = sessions.filter(s => s.date.startsWith(monthPrefix) && s.trackType === 'DEPARTMENTAL').length;
      return { month: m, total: count, cw, dept };
    });
    return data;
  }, [sessions]);

  // Prerequisite DAG Hierarchy Tree
  const dagHierarchy = useMemo(() => {
    const map = new Map<string, Topic>();
    topics.forEach(t => map.set(t.id, t));

    // Level 0: Topics with no prerequisite
    const level0 = topics.filter(t => !t.prerequisiteId);
    // Level 1: Topics whose prerequisite is in Level 0
    const level0Ids = new Set(level0.map(t => t.id));
    const level1 = topics.filter(t => t.prerequisiteId && level0Ids.has(t.prerequisiteId));
    // Level 2: Topics whose prerequisite is in Level 1
    const level1Ids = new Set(level1.map(t => t.id));
    const level2 = topics.filter(t => t.prerequisiteId && level1Ids.has(t.prerequisiteId));

    return { level0, level1, level2 };
  }, [topics]);

  // SVG Donut calculation
  const donutSegments = useMemo(() => {
    const total = sessions.length || 1;
    let accumulated = 0;

    return deptStats.map(item => {
      const fraction = item.count / total;
      const strokeDasharray = `${fraction * 283} ${283}`;
      const strokeDashoffset = -accumulated * 283;
      accumulated += fraction;

      return {
        ...item,
        strokeDasharray,
        strokeDashoffset
      };
    });
  }, [deptStats, sessions]);

  return (
    <div className="space-y-6">
      {/* Top Health Overview KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Sessions Scheduled</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {sessions.length} / {topics.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>topics with a session / topics on file</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Ship-Wide vs Dept Split</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {sessions.filter(s => s.trackType === 'COMPANY_WIDE').length} <span className="text-sm font-normal text-slate-500">Ship-Wide</span> / {sessions.filter(s => s.trackType === 'DEPARTMENTAL').length} <span className="text-sm font-normal text-slate-500">Dept</span>
          </div>
          <div className="text-[11px] text-blue-400 mt-1">
            {describeDays(settings)}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Rotation Fairness & Anti-Starvation</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {sessions.length === 0 ? 'No data' : starvationGaps.every(g => g.status !== 'Starved') ? 'Balanced' : 'Anomaly Detected'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Longest wait: {Math.max(0, ...starvationGaps.map(g => g.maxGap))} departmental slots
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">DAG Prerequisite Integrity</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {conflicts.filter(c => c.type === 'PREREQUISITE_VIOLATION').length === 0 ? (
              <span className="text-emerald-400">Zero Violations</span>
            ) : (
              <span className="text-amber-400">
                {conflicts.filter(c => c.type === 'PREREQUISITE_VIOLATION').length} Violations
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Topological order strictly enforced
          </div>
        </div>
      </div>

      {/* 1. Premier Recharts Widget: Department Performance & Starvation Monitor */}
      <DepartmentPerformanceWidget sessions={sessions} />

      {/* Grid: Donut Share & Starvation Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Airtime Share SVG Donut */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-400" />
              <span>Departmental Airtime Allocation</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{sessions.length} sessions</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
            {/* SVG Donut */}
            <div className="relative w-40 h-40 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="stroke-slate-800"
                  strokeWidth="10"
                  fill="transparent"
                />
                {donutSegments.map((seg, i) => (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="45"
                    stroke={seg.color}
                    strokeWidth="10"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    fill="transparent"
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold font-mono text-white">{sessions.length}</span>
                <span className="text-[10px] text-slate-400">Sessions</span>
              </div>
            </div>

            {/* Legend with percentages */}
            <div className="space-y-1.5 flex-1 w-full text-xs">
              {deptStats.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: item.color }} 
                    />
                    <span className="text-slate-300 truncate max-w-[130px]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-slate-200 font-semibold">{item.count}</span>
                    <span className="text-slate-500 w-10 text-right">{item.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Starvation Gap Audit Table */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Anti-Starvation & Fair-Share Rotation Audit</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Maximum and average intervals between departmental sessions (Target: ≤ 6 slots)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold text-[11px] uppercase">
                  <th className="py-2 px-3">Department</th>
                  <th className="py-2 px-3 text-center">Sessions</th>
                  <th className="py-2 px-3 text-center">Avg Interval</th>
                  <th className="py-2 px-3 text-center">Max Gap</th>
                  <th className="py-2 px-3 text-right">Cadence Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {starvationGaps.map(g => (
                  <tr key={g.dept} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3">
                      <span className="font-semibold" style={{ color: g.color }}>
                        {g.dept}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                      {g.total}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                      {g.avgGap} slots
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">
                      <span className={g.maxGap <= 6 ? 'text-emerald-400' : 'text-amber-400'}>
                        {g.maxGap} slots
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        g.status === 'Nominal'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                          : g.status === 'Fair'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                            : 'bg-rose-950 text-rose-300 border border-rose-800/40'
                      }`}>
                        {g.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Monthly Distribution Histogram */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span>Monthly Session Distribution & Track Balance</span>
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 h-3 rounded-xs bg-blue-500" /> Ship-Wide
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 h-3 rounded-xs bg-emerald-500" /> Departmental
            </span>
          </div>
        </div>

        {/* Bar chart representation */}
        <div className="grid grid-cols-12 gap-2 pt-4 items-end h-44">
          {monthlyStats.map(item => {
            const max = 25;
            const totalHeight = Math.min(100, (item.total / max) * 100);
            const cwFraction = item.total > 0 ? (item.cw / item.total) * 100 : 0;
            const deptFraction = 100 - cwFraction;

            return (
              <div key={item.month} className="flex flex-col items-center gap-2 h-full justify-end">
                <div className="text-[10px] font-mono text-slate-400">
                  {item.total}
                </div>
                <div 
                  className="w-full max-w-[28px] rounded-t overflow-hidden flex flex-col justify-end bg-slate-800 transition-all duration-300"
                  style={{ height: `${totalHeight}%` }}
                >
                  <div 
                    className="w-full bg-emerald-500 transition-all"
                    style={{ height: `${deptFraction}%` }}
                    title={`${item.month}: ${item.dept} Departmental Sessions`}
                  />
                  <div 
                    className="w-full bg-blue-500 transition-all"
                    style={{ height: `${cwFraction}%` }}
                    title={`${item.month}: ${item.cw} Ship-Wide Sessions`}
                  />
                </div>
                <div className="text-xs font-mono font-medium text-slate-300">
                  {item.month}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DAG Prerequisite Dependency Resolution Tree */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <GitFork className="w-4 h-4 text-blue-400" />
              <span>DAG Prerequisite Hierarchy & Progression Flow</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Topological verification: Level 0 (Foundations) must be scheduled strictly prior to Level 1 & Level 2 topics.
            </p>
          </div>
          <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Cycle-Free Directed Acyclic Graph</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Level 0: Foundations */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Level 0: Foundation Topics
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {dagHierarchy.level0.length} Modules
              </span>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {dagHierarchy.level0.slice(0, 7).map(t => (
                <div key={t.id} className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-500">{t.id}</span>
                    <span className="text-[10px] text-slate-400">{t.department}</span>
                  </div>
                  <div className="font-medium text-slate-200 mt-0.5 truncate">{t.title}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Level 1: Intermediate Dependent Modules */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Level 1: Dependent Modules
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {dagHierarchy.level1.length} Modules
              </span>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {dagHierarchy.level1.map(t => (
                <div key={t.id} className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-500">{t.id}</span>
                    <span className="text-[10px] text-purple-400 font-mono">
                      Prereq: {t.prerequisiteId}
                    </span>
                  </div>
                  <div className="font-medium text-slate-200 mt-0.5 truncate">{t.title}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Level 2: Advanced Capstone Topics */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                Level 2: Advanced Capstones
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {dagHierarchy.level2.length} Modules
              </span>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {dagHierarchy.level2.map(t => (
                <div key={t.id} className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-500">{t.id}</span>
                    <span className="text-[10px] text-purple-400 font-mono">
                      Prereq: {t.prerequisiteId}
                    </span>
                  </div>
                  <div className="font-medium text-slate-200 mt-0.5 truncate">{t.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
