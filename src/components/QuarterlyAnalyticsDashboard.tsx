/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ScheduledSession, Topic } from '../types';
import { ALL_TRACK_DEPARTMENTS, DEPARTMENTS } from '../data/departments';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';
import {
  Calendar,
  Clock,
  TrendingUp,
  Award,
  CheckCircle2,
  PieChart,
  Layers,
  ChevronRight,
  Filter
} from 'lucide-react';

interface QuarterlyAnalyticsDashboardProps {
  sessions: ScheduledSession[];
  topics: Topic[];
  year: number;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const QUARTERS = [
  { id: 1, label: 'Q1 (Jan - Mar)', months: [0, 1, 2], startWeek: 1, endWeek: 13 },
  { id: 2, label: 'Q2 (Apr - Jun)', months: [3, 4, 5], startWeek: 14, endWeek: 26 },
  { id: 3, label: 'Q3 (Jul - Sep)', months: [6, 7, 8], startWeek: 27, endWeek: 39 },
  { id: 4, label: 'Q4 (Oct - Dec)', months: [9, 10, 11], startWeek: 40, endWeek: 52 },
  { id: 0, label: 'Full Year Overview', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], startWeek: 1, endWeek: 52 }
];

const DEPT_COLORS: Record<string, string> = {
  'Executive': '#06b6d4',
  'Engineering': '#10b981',
  'Electrical': '#f59e0b',
  'Logistics': '#ec4899',
  'Medical': '#ef4444',
  'NBCD': '#8b5cf6',
  'Aviation': '#6366f1',
  'Ship-Wide': '#3b82f6'
};

export const QuarterlyAnalyticsDashboard: React.FC<QuarterlyAnalyticsDashboardProps> = ({
  sessions,
  topics,
  year
}) => {
  // Determine current quarter based on system date
  const currentMonth = new Date().getMonth();
  const initialQuarterId = Math.floor(currentMonth / 3) + 1;
  const [selectedQuarterId, setSelectedQuarterId] = useState<number>(initialQuarterId);
  const [activeDeptFilter, setActiveDeptFilter] = useState<string>('ALL');

  const selectedQuarter = useMemo(() => {
    return QUARTERS.find(q => q.id === selectedQuarterId) || QUARTERS[0];
  }, [selectedQuarterId]);

  // Filter sessions in the selected quarter/year
  const quarterSessions = useMemo(() => {
    return sessions.filter(s => {
      if (!s.date) return false;
      const d = new Date(`${s.date}T12:00:00`);
      const m = d.getMonth();
      const inYear = d.getFullYear() === year || s.date.startsWith(String(year));
      return inYear && selectedQuarter.months.includes(m);
    });
  }, [sessions, year, selectedQuarter]);

  // 1. Monthly Training Hours per Department Data for Recharts BarChart
  const monthlyHoursData = useMemo(() => {
    return selectedQuarter.months.map(monthIdx => {
      const monthSessions = quarterSessions.filter(s => {
        const d = new Date(`${s.date}T12:00:00`);
        return d.getMonth() === monthIdx;
      });

      const entry: Record<string, string | number> = {
        month: MONTH_NAMES[monthIdx],
        totalHours: 0
      };

      ALL_TRACK_DEPARTMENTS.forEach(dept => {
        const deptSessions = monthSessions.filter(s => s.department === dept);
        const hours = deptSessions.reduce((acc, s) => {
          const mins = s.durationMinutes || 60;
          return acc + mins / 60;
        }, 0);
        const rounded = Math.round(hours * 10) / 10;
        entry[dept] = rounded;
        (entry.totalHours as number) += rounded;
      });

      entry.totalHours = Math.round((entry.totalHours as number) * 10) / 10;
      return entry;
    });
  }, [quarterSessions, selectedQuarter]);

  // 2. Trend Line for Completion Rates over the Current Quarter (Weekly Progression)
  const weeklyCompletionTrendData = useMemo(() => {
    const weeks: Array<{
      weekLabel: string;
      weekNumber: number;
      scheduled: number;
      completed: number;
      weeklyRate: number;
      cumulativeRate: number;
      cumulativeHours: number;
      targetBenchmark: number;
    }> = [];

    const start = selectedQuarter.startWeek;
    const end = selectedQuarter.endWeek;

    let cumulativeScheduled = 0;
    let cumulativeCompleted = 0;
    let cumulativeHoursTotal = 0;

    for (let w = start; w <= end; w++) {
      const weekSessions = sessions.filter(s => {
        const matchYear = s.date?.startsWith(String(year));
        const matchDept = activeDeptFilter === 'ALL' || s.department === activeDeptFilter;
        return matchYear && matchDept && s.weekNumber === w;
      });

      const scheduled = weekSessions.length;
      const completed = weekSessions.filter(s => s.status === 'Completed').length;
      const weekHours = weekSessions
        .filter(s => s.status === 'Completed')
        .reduce((sum, s) => sum + (s.durationMinutes || 60) / 60, 0);

      cumulativeScheduled += scheduled;
      cumulativeCompleted += completed;
      cumulativeHoursTotal += weekHours;

      const weeklyRate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
      const cumulativeRate = cumulativeScheduled > 0
        ? Math.round((cumulativeCompleted / cumulativeScheduled) * 100)
        : 0;

      // Only plot weeks that have scheduled sessions or earlier weeks in quarter
      weeks.push({
        weekLabel: `Wk ${w}`,
        weekNumber: w,
        scheduled,
        completed,
        weeklyRate,
        cumulativeRate: cumulativeRate || (weeks.length > 0 ? weeks[weeks.length - 1].cumulativeRate : 0),
        cumulativeHours: Math.round(cumulativeHoursTotal * 10) / 10,
        targetBenchmark: 85 // Standard naval benchmark
      });
    }

    return weeks;
  }, [sessions, year, selectedQuarter, activeDeptFilter]);

  // Executive KPI summary calculations
  const totalPlannedHours = useMemo(() => {
    const totalMins = quarterSessions.reduce((acc, s) => acc + (s.durationMinutes || 60), 0);
    return Math.round((totalMins / 60) * 10) / 10;
  }, [quarterSessions]);

  const totalDeliveredHours = useMemo(() => {
    const deliveredMins = quarterSessions
      .filter(s => s.status === 'Completed')
      .reduce((acc, s) => acc + (s.durationMinutes || 60), 0);
    return Math.round((deliveredMins / 60) * 10) / 10;
  }, [quarterSessions]);

  const completionRate = useMemo(() => {
    if (quarterSessions.length === 0) return 0;
    const completed = quarterSessions.filter(s => s.status === 'Completed').length;
    return Math.round((completed / quarterSessions.length) * 100);
  }, [quarterSessions]);

  // Department Table Stats
  const departmentStats = useMemo(() => {
    return ALL_TRACK_DEPARTMENTS.map(dept => {
      const deptSessions = quarterSessions.filter(s => s.department === dept);
      const completed = deptSessions.filter(s => s.status === 'Completed').length;
      const hours = deptSessions.reduce((sum, s) => sum + (s.durationMinutes || 60) / 60, 0);
      const deliveredHours = deptSessions
        .filter(s => s.status === 'Completed')
        .reduce((sum, s) => sum + (s.durationMinutes || 60) / 60, 0);
      const rate = deptSessions.length > 0 ? Math.round((completed / deptSessions.length) * 100) : 0;

      return {
        department: dept,
        color: DEPT_COLORS[dept] || '#3b82f6',
        totalSessions: deptSessions.length,
        completedSessions: completed,
        totalHours: Math.round(hours * 10) / 10,
        deliveredHours: Math.round(deliveredHours * 10) / 10,
        completionRate: rate
      };
    }).sort((a, b) => b.totalHours - a.totalHours);
  }, [quarterSessions]);

  const topDepartment = departmentStats[0];

  return (
    <div className="space-y-6">
      {/* Top Header & Quarter Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Quarterly Training Analytics & Hours Dashboard
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Departmental training load visualization and completion rate trend tracking for {year}.
          </p>
        </div>

        {/* Quarter Selector Segmented Control */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
          {QUARTERS.map(q => (
            <button
              key={q.id}
              onClick={() => setSelectedQuarterId(q.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedQuarterId === q.id
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {q.id === 0 ? 'Full Year' : `Q${q.id}`}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Planned Hours ({selectedQuarter.label})</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white tracking-tight">
            {totalPlannedHours} <span className="text-xs font-normal text-slate-400">hrs</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Across {quarterSessions.length} total scheduled sessions
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Delivered Hours</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            {totalDeliveredHours} <span className="text-xs font-normal text-slate-400">hrs</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {quarterSessions.filter(s => s.status === 'Completed').length} completed sessions
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Quarterly Completion Rate</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-300 tracking-tight flex items-baseline gap-2">
            <span>{completionRate}%</span>
            <span className="text-xs font-normal text-slate-500">target: 85%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completionRate >= 85 ? 'bg-emerald-500' : completionRate >= 60 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, completionRate)}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Top Training Department</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white truncate">
            {topDepartment?.department || '—'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {topDepartment ? `${topDepartment.totalHours} hrs (${topDepartment.totalSessions} sessions)` : 'No sessions recorded'}
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Monthly Training Hours per Department (BarChart) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Monthly Training Hours per Department</span>
              </h3>
              <p className="text-xs text-slate-400">
                Total hours planned per department across {selectedQuarter.label}.
              </p>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyHoursData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  unit="h"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                  }}
                  itemStyle={{ padding: '1px 0' }}
                  formatter={(value: any, name: any) => [`${value} hrs`, name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  iconSize={8}
                />
                {ALL_TRACK_DEPARTMENTS.map(dept => (
                  <Bar
                    key={dept}
                    dataKey={dept}
                    name={dept}
                    fill={DEPT_COLORS[dept] || '#3b82f6'}
                    stackId="a"
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: Trend Line for Completion Rates over the Current Quarter (LineChart) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Completion Rate Trend ({selectedQuarter.label})</span>
              </h3>
              <p className="text-xs text-slate-400">
                Weekly cumulative completion % vs 85% naval readiness quota.
              </p>
            </div>

            {/* Department Filter for Trendline */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={activeDeptFilter}
                onChange={(e) => setActiveDeptFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Departments</option>
                {ALL_TRACK_DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={weeklyCompletionTrendData}
                margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="completionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="weekLabel"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  domain={[0, 100]}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                  }}
                  formatter={(val: any, name: any) => {
                    if (name === 'Cumulative Completion') return [`${val}%`, name];
                    if (name === 'Target Benchmark') return [`${val}%`, name];
                    return [val, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconSize={8} />
                <ReferenceLine
                  y={85}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: 'Target 85%', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeRate"
                  name="Cumulative Completion"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#completionGrad)"
                  dot={{ r: 3, fill: '#10b981' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="weeklyRate"
                  name="Weekly Batch Rate"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Departmental Training Load & Completion Breakdown</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {selectedQuarter.label}
          </span>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-[11px] text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Department</th>
                <th className="py-2.5 px-4 font-semibold">Scheduled Sessions</th>
                <th className="py-2.5 px-4 font-semibold">Completed Sessions</th>
                <th className="py-2.5 px-4 font-semibold">Planned Hours</th>
                <th className="py-2.5 px-4 font-semibold">Delivered Hours</th>
                <th className="py-2.5 px-4 font-semibold">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {departmentStats.map((item) => (
                <tr key={item.department} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-4 font-sans font-medium text-slate-200 flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.department}</span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-300">{item.totalSessions}</td>
                  <td className="py-2.5 px-4 text-slate-300">{item.completedSessions}</td>
                  <td className="py-2.5 px-4 text-slate-200 font-bold">{item.totalHours} hrs</td>
                  <td className="py-2.5 px-4 text-emerald-400 font-bold">{item.deliveredHours} hrs</td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${item.completionRate}%`,
                            backgroundColor: item.color
                          }}
                        />
                      </div>
                      <span className="font-semibold text-slate-300">
                        {item.completionRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
