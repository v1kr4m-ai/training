/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  ScheduledSession, 
  ScheduleConflict, 
  HolidayEntry, 
  Topic, 
  TrackType,
  SessionStatus 
} from '../types';
import { getDepartmentConfig, DEPARTMENT_NAMES } from '../data/departments';
import { weekOfYear } from '../utils/scheduler';
import { addMinutes, validDuration } from '../utils/time';
import { useSettings } from '../utils/settingsContext';
import { describeDays, describeTime } from '../utils/settings';
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  Lock, 
  Unlock, 
  FastForward, 
  ArrowRight, 
  Trash2, 
  Plus, 
  Filter, 
  Search,
  Sparkles,
  RefreshCw,
  Clock,
  MapPin,
  User,
  Info
} from 'lucide-react';

interface AdminMatrixTableProps {
  sessions: ScheduledSession[];
  conflicts: ScheduleConflict[];
  blackoutDates: HolidayEntry[];
  topics: Topic[];
  onUpdateSession: (updated: ScheduledSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onAutoSchedule: () => void;
  unscheduledCount: number;
  onCascadeReschedule: (fromSequence?: number) => void;
  onShiftSessionOneDay: (sessionId: string) => void;
  onOpenConflictModal: (conflict: ScheduleConflict) => void;
  onOpenBlackoutManager: () => void;
  onOpenIngestionModal: () => void;
  /** Today (YYYY-MM-DD): a session date can only be set to today or later. */
  today: string;
  isAdmin: boolean;
  /** Date / time / length changes go here so conflicts can be checked and, for the administrator, overridden. */
  onMoveSession: (updated: ScheduledSession) => void;
  onReschedule: (session: ScheduledSession) => void;
  onOpenCreateSession?: () => void;
}

const STATUS_TEXT: Record<string, string> = {
  Completed: 'text-emerald-400',
  Skipped: 'text-slate-400',
  Rescheduled: 'text-amber-300',
  Scheduled: 'text-blue-300'
};

export const AdminMatrixTable: React.FC<AdminMatrixTableProps> = ({
  sessions,
  conflicts,
  blackoutDates,
  topics,
  onUpdateSession,
  onDeleteSession,
  onAutoSchedule,
  unscheduledCount,
  onCascadeReschedule,
  onShiftSessionOneDay,
  onOpenConflictModal,
  onOpenBlackoutManager,
  onOpenIngestionModal,
  today,
  isAdmin,
  onMoveSession,
  onReschedule,
  onOpenCreateSession
}) => {
  const settings = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedWeek, setSelectedWeek] = useState('ALL');
  const [filterConflictsOnly, setFilterConflictsOnly] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof ScheduledSession } | null>(null);

  // Map conflicts by sessionId for quick lookup
  const conflictMap = useMemo(() => {
    const map = new Map<string, ScheduleConflict[]>();
    conflicts.forEach(c => {
      const list = map.get(c.sessionId) || [];
      list.push(c);
      map.set(c.sessionId, list);
    });
    return map;
  }, [conflicts]);

  // Filtered session list
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Conflicts only toggle
      if (filterConflictsOnly && !conflictMap.has(session.id)) {
        return false;
      }

      // Department filter
      if (selectedDept !== 'ALL' && session.department !== selectedDept) {
        return false;
      }

      // Week filter
      if (selectedWeek !== 'ALL' && String(session.weekNumber) !== selectedWeek) {
        return false;
      }

      // Search query (title, topicId, speaker, date, subDepartment)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = session.title.toLowerCase().includes(q);
        const matchSpeaker = session.speaker.toLowerCase().includes(q);
        const matchTopicId = session.topicId.toLowerCase().includes(q);
        const matchDate = session.date.includes(q);
        const matchSubDept = session.subDepartment.toLowerCase().includes(q);
        const matchPrereq = session.prerequisiteId?.toLowerCase().includes(q);
        if (!matchTitle && !matchSpeaker && !matchTopicId && !matchDate && !matchSubDept && !matchPrereq) {
          return false;
        }
      }

      return true;
    });
  }, [sessions, filterConflictsOnly, conflictMap, selectedDept, selectedWeek, searchQuery]);

  // Available weeks (1 to 53)
  const weekOptions = useMemo(() => {
    const maxWeek = Math.max(...sessions.map(s => s.weekNumber), 53);
    return Array.from({ length: maxWeek }, (_, i) => i + 1);
  }, [sessions]);

  const handleCellBlur = (session: ScheduledSession, field: keyof ScheduledSession, value: string) => {
    setEditingCell(null);
    if (session[field] === value) return;
    onUpdateSession({
      ...session,
      [field]: value
    });
  };

  // Manual change of date, time or length: pin the session so re-scheduling leaves it alone
  const moveSession = (session: ScheduledSession, patch: Partial<ScheduledSession>) => {
    if (patch.date && patch.date < today) return; // nothing can be set in the past
    const next = { ...session, ...patch, isCustomLocked: true };
    if (patch.date) {
      next.dayOfWeek = new Date(`${patch.date}T12:00:00`).getDay();
      next.weekNumber = weekOfYear(patch.date);
    }
    onMoveSession(next);
  };

  // The end follows the start when the session has a duration; without one there is only a start time
  const changeStart = (session: ScheduledSession, start: string) => {
    if (!session.durationMinutes) return moveSession(session, { startTime: start, endTime: '' });
    const end = addMinutes(start, session.durationMinutes);
    if (end === null) return;
    moveSession(session, { startTime: start, endTime: end });
  };

  const changeDuration = (session: ScheduledSession, raw: string) => {
    if (raw.trim() === '') {
      if (session.durationMinutes) moveSession(session, { durationMinutes: null, endTime: '' });
      return;
    }
    const n = Number(raw);
    const end = validDuration(n) ? addMinutes(session.startTime, n) : null;
    if (end === null || n === session.durationMinutes) return;
    moveSession(session, { durationMinutes: n, endTime: end });
  };

  const getDayName = (dayOfWeek: number) => {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek] || 'Day';
  };

  return (
    <div className="space-y-4">
      {/* Top Admin Controls & Filter Ribbon */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search topics, speakers, IDs, dates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Department Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Dept:</span>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Departments ({sessions.length})</option>
                <option value="Ship-Wide">Ship-Wide</option>
                {DEPARTMENT_NAMES.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Week Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Week:</span>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="ALL">All Weeks (1-53)</option>
                {weekOptions.map(w => (
                  <option key={w} value={String(w)}>Week {w}</option>
                ))}
              </select>
            </div>

            {/* Conflicts Only Toggle */}
            <button
              onClick={() => setFilterConflictsOnly(!filterConflictsOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterConflictsOnly 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' 
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700/60'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${filterConflictsOnly ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>Conflicts Only</span>
              {conflicts.length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-300 rounded text-[10px] font-mono font-bold">
                  {conflicts.length}
                </span>
              )}
            </button>
          </div>

          {/* Global Cascade & Admin Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {onOpenCreateSession && (
              <button
                onClick={onOpenCreateSession}
                title="Schedule a new session with daily, weekly, or bi-weekly repeat"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Session</span>
              </button>
            )}

            <button
              onClick={() => onCascadeReschedule(1)}
              title="Recalculates dates for all sessions skipping holidays, blackouts, and weekends, and restores prerequisite orders."
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm active:scale-95"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Cascade Reschedule All</span>
            </button>

            <button
              onClick={onOpenIngestionModal}
              title="Paste a topic table from Excel or CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Import Topics</span>
            </button>

            <button
              onClick={onOpenBlackoutManager}
              title="Configure holidays and blackout windows"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Blackouts ({blackoutDates.length})</span>
            </button>

            <button
              onClick={onAutoSchedule}
              disabled={unscheduledCount === 0}
              title="Place topics that have no session yet into free working days. Locked and completed sessions stay put."
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Schedule {unscheduledCount} unscheduled</span>
            </button>
          </div>
        </div>

        {/* Conflict Summary Banner if any conflicts exist */}
        {conflicts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>{conflicts.length} Constraint Conflict{conflicts.length > 1 ? 's' : ''} Detected:</strong>{' '}
                {conflicts.slice(0, 2).map(c => c.message).join(' · ')}
                {conflicts.length > 2 && ` (+${conflicts.length - 2} more)`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Use &quot;Cascade Reschedule&quot; or &quot;Shift 1 Day&quot; to auto-resolve</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[640px] matrix-print-container">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-800">
              <tr className="text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 font-semibold text-center w-12">#</th>
                <th className="py-2.5 px-3 font-semibold w-24">Date</th>
                <th className="py-2.5 px-2 font-semibold w-14">Day</th>
                <th className="py-2.5 px-3 font-semibold w-44">Start · duration</th>
                <th className="py-2.5 px-3 font-semibold w-28">Track</th>
                <th className="py-2.5 px-3 font-semibold w-36">Department</th>
                <th className="py-2.5 px-4 font-semibold min-w-[280px]">Session Topic & Prerequisite</th>
                <th className="py-2.5 px-3 font-semibold w-48">Speaker</th>
                <th className="py-2.5 px-3 font-semibold w-40">Location</th>
                <th className="py-2.5 px-3 font-semibold w-36">Status</th>
                <th className="py-2.5 px-2 font-semibold text-center w-12">Lock</th>
                <th className="py-2.5 px-3 font-semibold text-right w-44 no-print">Quick Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    {sessions.length === 0 ? (
                      <>
                        <p className="text-sm font-medium">No sessions yet</p>
                        <p className="text-xs text-slate-600 mt-1">Use &quot;Import Topics&quot; to load your training topics; sessions are then placed on the calendar automatically.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">No sessions match current criteria</p>
                        <p className="text-xs text-slate-600 mt-1">Try resetting filters or clear your search term</p>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const sessionConflicts = conflictMap.get(session.id) || [];
                  const hasError = sessionConflicts.some(c => c.severity === 'error');
                  const hasWarning = sessionConflicts.some(c => c.severity === 'warning');
                  const deptConfig = getDepartmentConfig(session.department);
                  const isLocked = session.isCustomLocked;

                  return (
                    <tr 
                      key={session.id}
                      className={`transition-colors hover:bg-slate-800/50 ${
                        hasError 
                          ? 'bg-rose-950/20 hover:bg-rose-950/30' 
                          : hasWarning 
                            ? 'bg-amber-950/15 hover:bg-amber-950/25' 
                            : ''
                      }`}
                    >
                      {/* Sequence Number */}
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-medium">
                        {session.sequenceNumber}
                      </td>

                      {/* Date with Conflict indicator */}
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            aria-label="Session date"
                            value={session.date}
                            min={today}
                            onChange={e => e.target.value && moveSession(session, { date: e.target.value })}
                            className={`bg-transparent border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-1 py-0.5 font-mono text-xs ${hasError ? 'text-rose-400 font-semibold' : 'text-slate-200'}`}
                          />
                          {sessionConflicts.length > 0 && (
                            <button
                              onClick={() => onOpenConflictModal(sessionConflicts[0])}
                              title={sessionConflicts.map(c => c.message).join('\n')}
                              className="text-amber-400 hover:text-amber-300 transition-transform hover:scale-110"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Day of Week */}
                      <td className="py-2.5 px-2 text-slate-400 font-medium">
                        {getDayName(session.dayOfWeek)}
                      </td>

                      {/* Start time and optional duration; the end is worked out when a duration is given */}
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        <input type="time" aria-label="Start time" value={session.startTime}
                          onChange={e => e.target.value && changeStart(session, e.target.value)}
                          className="bg-transparent border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-0.5 w-[4.6rem]" />
                        <input type="number" min={1} max={1439} placeholder="min" aria-label="Duration in minutes (optional)"
                          key={`${session.id}-${session.durationMinutes ?? ''}`} defaultValue={session.durationMinutes ?? ''}
                          onBlur={e => changeDuration(session, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          className="bg-transparent border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-0.5 w-12 ml-1" />
                        {session.endTime && <span className="ml-1 text-slate-500">→ {session.endTime}</span>}
                      </td>

                      {/* Track Type */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span 
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide ${
                            session.trackType === 'COMPANY_WIDE'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                              : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                          }`}
                        >
                          {session.trackType === 'COMPANY_WIDE' ? 'Ship-Wide' : 'Departmental'}
                        </span>
                      </td>

                      {/* Department & Section */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span 
                            className="font-medium truncate max-w-[140px]" 
                            style={{ color: deptConfig.color }}
                          >
                            {session.department}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                            {session.subDepartment}
                          </span>
                        </div>
                      </td>

                      {/* Topic Title & Prerequisite */}
                      <td className="py-2.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          {editingCell?.id === session.id && editingCell?.field === 'title' ? (
                            <input
                              type="text"
                              autoFocus
                              defaultValue={session.title}
                              onBlur={(e) => handleCellBlur(session, 'title', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellBlur(session, 'title', (e.target as HTMLInputElement).value);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              className="bg-slate-950 border border-blue-500 rounded px-2 py-1 text-xs text-white w-full"
                            />
                          ) : (
                            <div 
                              onClick={() => setEditingCell({ id: session.id, field: 'title' })}
                              className="font-semibold text-slate-100 hover:text-blue-400 cursor-pointer transition-colors"
                              title="Click to inline-edit title"
                            >
                              {session.title}
                            </div>
                          )}

                          {/* Prerequisite Indicator if any */}
                          {session.prerequisiteId && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                              <span className="text-slate-500">Prereq:</span>
                              <span className="font-mono text-purple-300 bg-purple-950/60 px-1 rounded border border-purple-800/40">
                                {session.prerequisiteId}
                              </span>
                            </div>
                          )}

                          {/* Specific conflict message badge if any */}
                          {sessionConflicts.map((c, i) => (
                            <span 
                              key={i}
                              onClick={() => onOpenConflictModal(c)}
                              className={`text-[10px] font-semibold hover:underline cursor-pointer flex items-center gap-1 px-1.5 py-0.5 rounded mt-0.5 ${
                                c.type === 'TIME_SLOT_DEPARTMENT_CONFLICT'
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60 shadow-xs'
                                  : 'text-amber-400'
                              }`}
                            >
                              {c.type === 'TIME_SLOT_DEPARTMENT_CONFLICT' ? '⚠️ MULTI-DEPT CONFLICT: ' : '⚠️ '} {c.message}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Speaker */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 text-slate-300 truncate max-w-[180px]">
                          <User className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{session.speaker || '—'}</span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-[150px]">
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{session.location || '—'}</span>
                        </div>
                      </td>

                      {/* Status: the administrator flags a session Completed, Skipped or (through Reschedule) Rescheduled */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isAdmin ? (
                          <select
                            aria-label="Session status"
                            value={session.status}
                            onChange={e => {
                              const val = e.target.value as SessionStatus;
                              if (val === 'Rescheduled') {
                                onReschedule(session);
                              } else {
                                onUpdateSession({ ...session, status: val });
                              }
                            }}
                            className={`bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] font-semibold cursor-pointer ${STATUS_TEXT[session.status] || 'text-slate-200'}`}
                          >
                            <option value="Scheduled">Scheduled</option>
                            <option value="Completed">Completed</option>
                            <option value="Skipped">Skipped</option>
                            <option value="Rescheduled">Rescheduled</option>
                            <option value="Postponed">Postponed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        ) : (
                          <span className={`text-[11px] font-semibold ${STATUS_TEXT[session.status] || 'text-slate-300'}`}>{session.status}</span>
                        )}
                        {session.status === 'Rescheduled' && session.rescheduledFrom?.length ? (
                          <div className="text-[10px] text-slate-500">from {session.rescheduledFrom[session.rescheduledFrom.length - 1].from}</div>
                        ) : null}
                        {session.adminOverride && sessionConflicts.length > 0 && <div className="text-[10px] text-amber-400">Admin override</div>}
                      </td>

                      {/* Lock Toggle */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => onUpdateSession({
                            ...session,
                            isCustomLocked: !session.isCustomLocked
                          })}
                          title={isLocked ? 'Pinned: protected from auto-rescheduling' : 'Click to pin and protect from auto-reschedule'}
                          className={`p-1 rounded transition-colors ${
                            isLocked 
                              ? 'text-amber-400 hover:text-amber-300 bg-amber-950/50 border border-amber-800/50' 
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      </td>

                      {/* Quick Resolution Actions */}
                      <td className="py-2.5 px-3 text-right no-print whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Shift 1 Day button */}
                          <button
                            onClick={() => onShiftSessionOneDay(session.id)}
                            title="Shift this session by 1 working day (skips weekend & holidays)"
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium transition-colors border border-slate-700 flex items-center gap-1"
                          >
                            <ArrowRight className="w-3 h-3 text-blue-400" />
                            <span>Shift 1D</span>
                          </button>

                          {isAdmin && session.status !== 'Completed' && (
                            <button
                              onClick={() => onReschedule(session)}
                              title="Move this session to a later date and record why"
                              className="px-2 py-1 bg-amber-950/50 hover:bg-amber-900/70 text-amber-300 rounded text-[11px] font-medium transition-colors border border-amber-800/60"
                            >
                              Reschedule
                            </button>
                          )}

                          {/* Cascade from here */}
                          <button
                            onClick={() => onCascadeReschedule(session.sequenceNumber)}
                            title="Cascade recalculate schedule downstream starting from this slot"
                            className="px-2 py-1 bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 rounded text-[11px] font-medium transition-colors border border-blue-800/60 flex items-center gap-1"
                          >
                            <FastForward className="w-3 h-3 text-blue-400" />
                            <span>Cascade</span>
                          </button>

                          {/* Delete Session */}
                          <button
                            onClick={() => onDeleteSession(session.id)}
                            title="Delete session"
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer with stats */}
        <div className="bg-slate-950 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <strong className="text-slate-200">{filteredSessions.length}</strong> of{' '}
            <strong className="text-slate-200">{sessions.length}</strong> sessions
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Ship-Wide: {sessions.filter(x => x.trackType === 'COMPANY_WIDE').length}</span>
            <span>·</span>
            <span>Departmental: {sessions.filter(x => x.trackType === 'DEPARTMENTAL').length}</span>
            <span>·</span>
            <span className="font-mono text-slate-300">{describeDays(settings)} · {describeTime(settings)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
