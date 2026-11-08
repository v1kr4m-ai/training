/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Cell
} from 'recharts';
import { ScheduledSession } from '../types';
import { DEPARTMENT_NAMES, getDepartmentConfig } from '../data/departments';
import {
  BarChart3,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  ShieldAlert,
  Info,
  Calendar,
  Flame,
  AlertCircle
} from 'lucide-react';

interface DepartmentPerformanceWidgetProps {
  sessions: ScheduledSession[];
}

export interface DeptPerformanceItem {
  name: string;
  shortName: string;
  code: string;
  count: number;
  targetCount: number;
  fulfillmentPct: number;
  color: string;
  maxGap: number;
  currentGap: number; // Slots since last scheduled session (identifies departments not scheduled recently)
  avgGap: number;
  lastScheduledDate: string;
  lastScheduledSlot: number;
  starvationStatus: 'Optimal' | 'Caution' | 'Starved';
  starvationMessage: string;
}

export const DepartmentPerformanceWidget: React.FC<DepartmentPerformanceWidgetProps> = ({ sessions }) => {
  const [viewMode, setViewMode] = useState<'COMBINED' | 'DISTRIBUTION' | 'STARVATION'>('COMBINED');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  // Compute departmental session distribution & starvation intervals
  const chartData: DeptPerformanceItem[] = useMemo(() => {
    const deptSessions = sessions.filter(s => s.trackType === 'DEPARTMENTAL');
    const totalDeptSlots = deptSessions.length;

    // Track intervals between appearances of each department
    const lastSeenIndex: Record<string, number> = {};
    const lastSeenDates: Record<string, string> = {};
    const maxGaps: Record<string, number> = {};
    const gapLists: Record<string, number[]> = {};
    const counts: Record<string, number> = {};

    DEPARTMENT_NAMES.forEach(d => {
      lastSeenIndex[d] = -1;
      lastSeenDates[d] = 'Not scheduled';
      maxGaps[d] = 0;
      gapLists[d] = [];
      counts[d] = 0;
    });

    deptSessions.forEach((s, idx) => {
      const d = s.department;
      if (counts[d] !== undefined) {
        counts[d]++;
        if (lastSeenIndex[d] !== -1) {
          const gap = idx - lastSeenIndex[d];
          gapLists[d].push(gap);
          if (gap > maxGaps[d]) {
            maxGaps[d] = gap;
          }
        }
        lastSeenIndex[d] = idx;
        lastSeenDates[d] = s.date;
      }
    });

    // Compute items
    return DEPARTMENT_NAMES.map(dept => {
      const cfg = getDepartmentConfig(dept);
      const count = counts[dept] || 0;
      const target = Math.round(totalDeptSlots / DEPARTMENT_NAMES.length); // fair share of departmental slots
      const gaps = gapLists[dept] || [];
      const avgGap = gaps.length > 0 
        ? parseFloat((gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1))
        : 0;
      const maxGap = maxGaps[dept] || 0;
      
      // Current gap: how many departmental sessions have taken place since this department was last scheduled
      const lastIndex = lastSeenIndex[dept];
      const currentGap = lastIndex !== -1 ? (totalDeptSlots - 1 - lastIndex) : totalDeptSlots;

      let starvationStatus: 'Optimal' | 'Caution' | 'Starved' = 'Optimal';
      let starvationMessage = 'Scheduled on regular rotation cadence';

      const n = DEPARTMENT_NAMES.length; // ideal rotation gap is about one slot per department
      if (count === 0) {
        starvationStatus = totalDeptSlots > 0 ? 'Starved' : 'Optimal';
        starvationMessage = totalDeptSlots > 0 ? 'No session scheduled' : 'No sessions scheduled yet';
      } else if (currentGap > n + 2 || maxGap > n + 2) {
        starvationStatus = 'Starved';
        starvationMessage = `High starvation gap (${currentGap} slots since last session)`;
      } else if (currentGap > n || maxGap > n) {
        starvationStatus = 'Caution';
        starvationMessage = `Approaching rotation threshold (${currentGap} slots elapsed)`;
      } else {
        starvationMessage = `Recently scheduled (${currentGap} slots ago)`;
      }

      const shortName = cfg.code;

      return {
        name: dept,
        shortName,
        code: cfg.code,
        count,
        targetCount: target,
        fulfillmentPct: target > 0 ? parseFloat(((count / target) * 100).toFixed(1)) : 0,
        color: cfg.color,
        maxGap,
        currentGap,
        avgGap,
        lastScheduledDate: lastSeenDates[dept] || 'None',
        lastScheduledSlot: lastIndex !== -1 ? lastIndex + 1 : 0,
        starvationStatus,
        starvationMessage
      };
    });
  }, [sessions]);

  // Overall starvation alert summary
  const starvedDepartments = useMemo(() => {
    return chartData.filter(d => d.starvationStatus === 'Starved');
  }, [chartData]);

  const cautionDepartments = useMemo(() => {
    return chartData.filter(d => d.starvationStatus === 'Caution');
  }, [chartData]);

  // Custom Soothing Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data: DeptPerformanceItem = payload[0].payload;

    return (
      <div className="bg-slate-950/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-xs space-y-2 backdrop-blur-md max-w-xs animate-fadeIn text-slate-100">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
            <span className="font-bold text-white text-sm">{data.name}</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
            {data.code}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
          <div>
            <span className="text-slate-400 block">Scheduled Sessions:</span>
            <span className="font-mono font-bold text-white text-sm">
              {data.count} <span className="text-slate-500 font-normal">/ {data.targetCount}</span>
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Target Fulfillment:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {data.fulfillmentPct}%
            </span>
          </div>

          <div>
            <span className="text-slate-400 block">Current Wait Gap:</span>
            <span className={`font-mono font-bold text-sm ${
              data.currentGap > DEPARTMENT_NAMES.length ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {data.currentGap} slots ago
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Max Cadence Gap:</span>
            <span className="font-mono font-bold text-slate-200 text-sm">
              {data.maxGap} slots max
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Last Session Date:</span>
            <span className="font-mono font-semibold text-slate-200">{data.lastScheduledDate}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${
              data.starvationStatus === 'Optimal' 
                ? 'bg-emerald-400' 
                : data.starvationStatus === 'Caution' 
                  ? 'bg-amber-400' 
                  : 'bg-rose-500'
            }`} />
            <span className={`font-medium ${
              data.starvationStatus === 'Optimal' 
                ? 'text-emerald-300' 
                : data.starvationStatus === 'Caution' 
                  ? 'text-amber-300' 
                  : 'text-rose-400'
            }`}>
              {data.starvationMessage}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 text-slate-100">
      {/* Widget Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Department Performance & Starvation Monitor
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Recharts Analytics
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Monitors session allocation vs. quota and flags departments with starvation gaps in the departmental rotation.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium shrink-0">
          <button
            onClick={() => setViewMode('COMBINED')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'COMBINED'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Dual Metric View
          </button>
          <button
            onClick={() => setViewMode('DISTRIBUTION')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'DISTRIBUTION'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Session Allocation
          </button>
          <button
            onClick={() => setViewMode('STARVATION')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'STARVATION'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Starvation Gaps
          </button>
        </div>
      </div>

      {/* Secondary Starvation Alert Strip (identifying departments that haven't been scheduled recently) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Starvation Status Card */}
        <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Fair share: {(chartData[0]?.targetCount ?? 0)} sessions each</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Ideal interval between sessions is about {DEPARTMENT_NAMES.length} slots across {DEPARTMENT_NAMES.length} rotating departments.
            </div>
          </div>
        </div>

        {/* Inactivity / Starvation Gaps Tracker */}
        <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
            starvedDepartments.length > 0 
              ? 'bg-rose-500/20 text-rose-400' 
              : cautionDepartments.length > 0
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-blue-500/20 text-blue-400'
          }`}>
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Recency Inactivity Tracker:</span>
              {starvedDepartments.length === 0 && cautionDepartments.length === 0 ? (
                <span className="text-emerald-400 text-[10px] font-bold font-mono">All departments active</span>
              ) : (
                <span className="text-amber-400 text-[10px] font-bold font-mono">
                  {cautionDepartments.length + starvedDepartments.length} Warning(s)
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {starvedDepartments.length > 0 ? (
                <span className="text-rose-400">
                  Starvation detected in: {starvedDepartments.map(d => d.shortName).join(', ')}
                </span>
              ) : cautionDepartments.length > 0 ? (
                <span className="text-amber-300">
                  Attention due for: {cautionDepartments.map(d => d.shortName).join(', ')}
                </span>
              ) : (
                <span className="text-slate-400">All {DEPARTMENT_NAMES.length} departments scheduled within healthy rotation limits.</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Filter or Recommendation */}
        <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 shrink-0 mt-0.5">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Next Priority Department</div>
            <div className="text-[11px] text-purple-300 font-semibold mt-0.5">
              {[...chartData].sort((a, b) => b.currentGap - a.currentGap)[0]?.name}
            </div>
            <div className="text-[10px] text-slate-500">
              Longest wait since last session ({[...chartData].sort((a, b) => b.currentGap - a.currentGap)[0]?.currentGap} slots ago)
            </div>
          </div>
        </div>
      </div>

      {/* Recharts Bar & Composed Chart Canvas */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'COMBINED' ? (
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
              <XAxis 
                dataKey="shortName" 
                stroke="#64748b" 
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} 
                dy={6}
              />
              <YAxis 
                yAxisId="left" 
                stroke="#64748b" 
                tick={{ fill: '#94a3b8', fontSize: 11 }} 
                domain={[0, 32]} 
                label={{ value: `Sessions (fair share: ${(chartData[0]?.targetCount ?? 0)})`, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, dy: 50 }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#f59e0b" 
                tick={{ fill: '#f59e0b', fontSize: 11 }} 
                domain={[0, 16]} 
                label={{ value: 'Starvation Gap (Slots)', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 10, dy: -50 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                height={36} 
                wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }} 
              />
              <ReferenceLine yAxisId="left" y={(chartData[0]?.targetCount ?? 0)} stroke="#10b981" strokeDasharray="4 4" label={{ value: `Fair share (${(chartData[0]?.targetCount ?? 0)})`, fill: '#10b981', fontSize: 10, position: 'top' }} />
              <ReferenceLine yAxisId="right" y={6} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Threshold (≤6)', fill: '#f59e0b', fontSize: 10, position: 'top' }} />

              <Bar 
                yAxisId="left" 
                dataKey="count" 
                name="Scheduled Sessions" 
                radius={[6, 6, 0, 0]} 
                maxBarSize={48}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Bar>

              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="currentGap" 
                name="Current Inactivity Gap" 
                stroke="#f59e0b" 
                strokeWidth={2.5} 
                dot={{ r: 5, fill: '#f59e0b', stroke: '#0f172a', strokeWidth: 2 }} 
                activeDot={{ r: 7 }}
              />
            </ComposedChart>
          ) : viewMode === 'DISTRIBUTION' ? (
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
              <XAxis dataKey="shortName" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} dy={6} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 32]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={(chartData[0]?.targetCount ?? 0)} stroke="#10b981" strokeDasharray="4 4" label={{ value: `Fair share (${(chartData[0]?.targetCount ?? 0)} sessions)`, fill: '#10b981', fontSize: 11, position: 'top' }} />
              <Bar dataKey="count" name="Scheduled Sessions" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.88} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
              <XAxis dataKey="shortName" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} dy={6} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 14]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={DEPARTMENT_NAMES.length} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `Ideal (≤${DEPARTMENT_NAMES.length} slots)`, fill: '#f59e0b', fontSize: 11, position: 'top' }} />
              <ReferenceLine y={8} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Starvation Limit (>8 Slots)', fill: '#f43f5e', fontSize: 11, position: 'top' }} />
              <Bar dataKey="currentGap" name="Slots Since Last Scheduled Session" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.currentGap > DEPARTMENT_NAMES.length + 2 ? '#f43f5e' : entry.currentGap > DEPARTMENT_NAMES.length ? '#f59e0b' : '#10b981'} 
                    fillOpacity={0.85} 
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Department Cards Strip: Secondary Starvation Indicators & Recency Details */}
      <div className="pt-2 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase font-mono tracking-wider">
            Department Inactivity & Recency Audit
          </span>
          <span className="font-mono text-[11px]">
            Target: 1 session every ~{DEPARTMENT_NAMES.length} departmental slots
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {chartData.map(item => {
            const isSelected = selectedDept === item.name;
            return (
              <div
                key={item.name}
                onClick={() => setSelectedDept(isSelected ? null : item.name)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-slate-800/90 border-blue-500 shadow-md' 
                    : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${item.color}25`, color: item.color }}>
                      {item.code}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${
                      item.starvationStatus === 'Optimal' 
                        ? 'bg-emerald-400' 
                        : item.starvationStatus === 'Caution'
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                    }`} />
                  </div>

                  <div className="text-xs font-bold text-white mt-1.5 truncate">
                    {item.shortName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {item.count} / {item.targetCount} ({item.fulfillmentPct}%)
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Wait Gap:</span>
                    <span className={`font-mono font-bold ${
                      item.currentGap > DEPARTMENT_NAMES.length ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {item.currentGap} slots
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500 truncate mt-0.5" title={item.lastScheduledDate}>
                    Last: {item.lastScheduledDate}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
