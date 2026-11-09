/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { ScheduledSession } from '../types';
import { ALL_TRACK_DEPARTMENTS, DEPARTMENT_NAMES } from '../data/departments';
import { formatDate } from '../utils/scheduler';
import { 
  Search, 
  Filter, 
  Calendar, 
  X, 
  Layers, 
  Building2, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  SlidersHorizontal,
  MapPin,
  UserCheck,
  CheckCircle2
} from 'lucide-react';

interface TrainingGlobalFilterBarProps {
  sessions: ScheduledSession[];
  onFilteredSessionsChange: (filtered: ScheduledSession[] | null) => void;
  year: number;
}

export const TrainingGlobalFilterBar: React.FC<TrainingGlobalFilterBarProps> = ({
  sessions,
  onFilteredSessionsChange,
  year
}) => {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);

  // Quick Date Range Helpers
  const setQuickRange = (type: 'TODAY' | 'TOMORROW' | 'WEEK' | 'MONTH' | 'QUARTER' | 'ALL' | 'CLEAR') => {
    const now = new Date();
    if (type === 'CLEAR') {
      setQuery('');
      setDepartment('ALL');
      setFromDate('');
      setToDate('');
      return;
    }
    if (type === 'TODAY') {
      const todayStr = formatDate(now);
      setFromDate(todayStr);
      setToDate(todayStr);
      return;
    }
    if (type === 'TOMORROW') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const tomStr = formatDate(d);
      setFromDate(tomStr);
      setToDate(tomStr);
      return;
    }
    if (type === 'WEEK') {
      const day = now.getDay();
      const diffToMon = now.getDate() - (day === 0 ? 6 : day - 1);
      const mon = new Date(now.setDate(diffToMon));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setFromDate(formatDate(mon));
      setToDate(formatDate(sun));
      return;
    }
    if (type === 'MONTH') {
      const first = new Date(year, now.getMonth(), 1);
      const last = new Date(year, now.getMonth() + 1, 0);
      setFromDate(formatDate(first));
      setToDate(formatDate(last));
      return;
    }
    if (type === 'QUARTER') {
      const q = Math.floor(now.getMonth() / 3);
      const first = new Date(year, q * 3, 1);
      const last = new Date(year, (q + 1) * 3, 0);
      setFromDate(formatDate(first));
      setToDate(formatDate(last));
      return;
    }
    if (type === 'ALL') {
      setFromDate(`${year}-01-01`);
      setToDate(`${year}-12-31`);
      return;
    }
  };

  // Check if any filter is active
  const isFiltering = useMemo(() => {
    return query.trim() !== '' || department !== 'ALL' || fromDate !== '' || toDate !== '';
  }, [query, department, fromDate, toDate]);

  // Execute filtering logic across all dimensions
  const filteredSessions = useMemo(() => {
    if (!isFiltering) return null;

    const q = query.trim().toLowerCase();
    return sessions.filter(s => {
      // 1. Department Filter
      if (department !== 'ALL' && s.department !== department) {
        return false;
      }

      // 2. Date Range Filter
      if (fromDate && s.date < fromDate) {
        return false;
      }
      if (toDate && s.date > toDate) {
        return false;
      }

      // 3. Topic / Keyword search (Title, topicId, speaker, location, description)
      if (q) {
        const titleMatch = s.title?.toLowerCase().includes(q);
        const topicIdMatch = s.topicId?.toLowerCase().includes(q);
        const speakerMatch = s.speaker?.toLowerCase().includes(q);
        const locationMatch = s.location?.toLowerCase().includes(q);
        const descMatch = s.description?.toLowerCase().includes(q);
        const subDeptMatch = s.subDepartment?.toLowerCase().includes(q);
        if (!titleMatch && !topicIdMatch && !speakerMatch && !locationMatch && !descMatch && !subDeptMatch) {
          return false;
        }
      }

      return true;
    });
  }, [sessions, isFiltering, query, department, fromDate, toDate]);

  // Propagate filtered sessions up to TrainingModule
  useEffect(() => {
    onFilteredSessionsChange(filteredSessions);
  }, [filteredSessions, onFilteredSessionsChange]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md space-y-3 no-print">
      {/* Search Bar Inputs Grid */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Topic / Keyword Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search topic title, syllabus, instructor, venue, ID..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-9 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Department Filter Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Building2 className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          <select
            aria-label="Filter by department"
            value={department}
            onChange={e => setDepartment(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="ALL">All Departments</option>
            <option value="Ship-Wide">Ship-Wide</option>
            {DEPARTMENT_NAMES.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Date Range Inputs */}
        <div className="flex items-center gap-2 shrink-0 text-xs text-slate-400">
          <Calendar className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          <input
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            aria-label="To date"
            min={fromDate}
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Clear Filters Button */}
        {isFiltering && (
          <button
            onClick={() => setQuickRange('CLEAR')}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Quick Filter Date Pills & Isolated Count Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 font-mono mr-1">Quick Range:</span>
          {[
            { id: 'TODAY', label: 'Today' },
            { id: 'TOMORROW', label: 'Tomorrow (Daily Orders)' },
            { id: 'WEEK', label: 'This Week' },
            { id: 'MONTH', label: 'This Month' },
            { id: 'QUARTER', label: 'This Quarter' },
            { id: 'ALL', label: `All ${year}` }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setQuickRange(btn.id as any)}
              className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Filtered Count Indicator */}
        {isFiltering && filteredSessions && (
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-semibold font-mono">
              {filteredSessions.length} of {sessions.length} sessions isolated
            </span>
            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px] font-medium"
            >
              <span>{showDrawer ? 'Hide Isolated List' : 'Inspect Isolated List'}</span>
              {showDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Expandable Isolated Sessions Drawer */}
      {showDrawer && isFiltering && filteredSessions && (
        <div className="pt-2 border-t border-slate-800 max-h-60 overflow-y-auto rounded-xl">
          <div className="space-y-1.5">
            {filteredSessions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                No training sessions match the current topic, department, or date range filters.
              </div>
            ) : (
              filteredSessions.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-cyan-400 font-bold w-20">
                      {s.date}
                    </span>
                    <span className="font-mono text-slate-400 text-[11px] w-24">
                      {s.startTime || '09:00'} - {s.endTime || '10:00'}
                    </span>
                    <span className="font-semibold text-slate-200">
                      {s.title}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
                      {s.department}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                    <span className="truncate max-w-[120px]">{s.speaker || '—'}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.status === 'Completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-blue-950 text-blue-300 border border-blue-800/60'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
