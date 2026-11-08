/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ScheduledSession, 
  Topic, 
  HolidayEntry, 
  ScheduleConflict, 
  ScheduleSettings,
  ActiveTab,
  MatrixMetrics 
} from '../types';
import { DEFAULT_HOLIDAYS_2026, defaultHolidays } from '../data/holidays';
import { 
  generateFullSchedule, 
  auditScheduleConflicts, 
  cascadeReschedule, 
  shiftSessionByOneWorkingDay,
  calculateMatrixMetrics,
  generateAnnualWorkingSlots,
  findUnscheduledTopics,
  formatDate,
  weekOfYear
} from '../utils/scheduler';
import { 
  generateCsvContent, 
  generateIcsContent, 
  downloadBlob 
} from '../utils/exporters';
import { ScheduleSettingsModal } from '../components/ScheduleSettingsModal';
import { OverrideModal } from '../components/OverrideModal';
import { RescheduleModal } from '../components/RescheduleModal';
import { ExportCalendarModal } from '../components/ExportCalendarModal';
import { addMinutes } from '../utils/time';
import { SettingsContext } from '../utils/settingsContext';
import { DEFAULT_SETTINGS, normalizeSettings, describeDays, describeTime } from '../utils/settings';
import { MainDashboard } from '../components/MainDashboard';
import { usePortal } from '../portal/store';
import { DepartmentsShowcasePage } from '../components/DepartmentsShowcasePage';
import { AdminMatrixTable } from '../components/AdminMatrixTable';
import { PublicCalendarView } from '../components/PublicCalendarView';
import { AnalyticsView } from '../components/AnalyticsView';
import { TopicIngestionModal } from '../components/TopicIngestionModal';
import { BlackoutManagerModal } from '../components/BlackoutManagerModal';
import { ConflictResolutionModal } from '../components/ConflictResolutionModal';
import { 
  Calendar, 
  Sliders, 
  BarChart2, 
  Download, 
  Printer, 
  Database, 
  Upload, 
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  LayoutDashboard
} from 'lucide-react';

const READ_ONLY_TABS: ActiveTab[] = ['PUBLIC', 'DEPARTMENTS'];

/** Training scheduler. With canEdit false only the calendar, ship dossier and department views are available. */
export function TrainingModule({ canEdit, isAdmin = false, storageKey }: { canEdit: boolean; isAdmin?: boolean; storageKey: string }) {
  const STORAGE_KEY = storageKey;
  const { ship, customHeaders } = usePortal();
  const [activeTab, setActiveTabRaw] = useState<ActiveTab>(canEdit ? 'DASHBOARD' : 'PUBLIC');
  const setActiveTab = (t: ActiveTab) => setActiveTabRaw(canEdit || READ_ONLY_TABS.includes(t) ? t : 'PUBLIC');

  // Core Persistent State (starts empty: topics come from the Import dialog or a JSON restore)
  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<{
        year: number; topics: Topic[]; blackoutDates: HolidayEntry[]; sessions: ScheduledSession[]; settings: ScheduleSettings;
      }> | null;
    } catch (e) {
      console.warn('Could not read saved matrix state:', e);
      return null;
    }
  }, []);

  const [year, setYear] = useState<number>(() => (typeof saved?.year === 'number' ? saved.year : 2026));
  const [settings, setSettings] = useState<ScheduleSettings>(() => normalizeSettings(saved?.settings));
  const [topics, setTopics] = useState<Topic[]>(() =>
    Array.isArray(saved?.topics) ? saved!.topics! : []);
  const [blackoutDates, setBlackoutDates] = useState<HolidayEntry[]>(() =>
    Array.isArray(saved?.blackoutDates) ? saved!.blackoutDates! : DEFAULT_HOLIDAYS_2026);
  const [sessions, setSessions] = useState<ScheduledSession[]>(() =>
    Array.isArray(saved?.sessions) ? saved!.sessions! : []);

  // Modal Dialog States
  const [isIngestionOpen, setIsIngestionOpen] = useState(false);
  const [isBlackoutOpen, setIsBlackoutOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeConflict, setActiveConflict] = useState<ScheduleConflict | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState<ScheduledSession | null>(null);
  const [pendingChange, setPendingChange] = useState<{ session: ScheduledSession; conflicts: ScheduleConflict[] } | null>(null);
  const today = formatDate(new Date());

  // File upload input ref for JSON restore
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Run Conflict Audit on sessions
  const conflicts = useMemo(() => {
    return auditScheduleConflicts(sessions, blackoutDates, topics, settings);
  }, [sessions, blackoutDates, topics, settings]);

  // Executive Metrics
  const metrics = useMemo(() => {
    return calculateMatrixMetrics(sessions, conflicts);
  }, [sessions, conflicts]);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      const payload = {
        year,
        topics,
        blackoutDates,
        sessions,
        settings,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error('Failed to persist matrix state to localStorage:', err);
    }
  }, [year, topics, blackoutDates, sessions, settings]);

  // Handlers for Session Modifications
  const handleUpdateSession = (updatedSession: ScheduledSession) => {
    setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
  };

  // A date / time change that creates a new warning is held back: the administrator may override and save it, others may not.
  const requestChange = (next: ScheduledSession) => {
    const existing = new Set(conflicts.filter(c => c.sessionId === next.id).map(c => `${c.type}|${c.message}`));
    const added = auditScheduleConflicts(sessions.map(s => (s.id === next.id ? next : s)), blackoutDates, topics, settings)
      .filter(c => c.sessionId === next.id && c.severity !== 'info' && !existing.has(`${c.type}|${c.message}`));
    if (added.length === 0) handleUpdateSession(next);
    else setPendingChange({ session: next, conflicts: added });
  };

  // Move a session to a later date; the old date is kept in its history and the status becomes Rescheduled
  const handleReschedule = (session: ScheduledSession, date: string, startTime: string, reason: string) => {
    const end = session.durationMinutes ? addMinutes(startTime, session.durationMinutes) ?? '' : '';
    setRescheduling(null);
    requestChange({
      ...session,
      date,
      dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
      weekNumber: weekOfYear(date),
      startTime,
      endTime: end,
      status: 'Rescheduled',
      isCustomLocked: true,
      rescheduledFrom: [...(session.rescheduledFrom || []), { at: new Date().toISOString(), from: session.date, to: date, reason }]
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId).map((s, i) => ({ ...s, sequenceNumber: i + 1 })));
  };

  // Fill free slots with topics that have no session yet. Locked and completed sessions stay where they are.
  const handleAutoSchedule = () => {
    setSessions(generateFullSchedule(year, topics, blackoutDates, sessions, settings));
  };

  const workingSlots = useMemo(() => generateAnnualWorkingSlots(year, blackoutDates, settings).length, [year, blackoutDates, settings]);
  const unscheduledTopics = useMemo(() => findUnscheduledTopics(topics, sessions), [topics, sessions]);

  // Conflict Resolution Action: Cascade Reschedule
  const handleCascadeReschedule = (fromSequence: number = 1) => {
    const recalculated = cascadeReschedule(sessions, blackoutDates, topics, fromSequence, settings);
    setSessions(recalculated);
  };

  // Conflict Resolution Action: Shift 1 Working Day
  const handleShiftOneDay = (sessionId: string) => {
    const shifted = shiftSessionByOneWorkingDay(sessionId, sessions, blackoutDates, settings);
    setSessions(shifted);
  };

  // Clear prerequisite for standalone
  const handleClearPrerequisite = (sessionId: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, prerequisiteId: null };
      }
      return s;
    }));
  };

  // Toggle lock
  const handleToggleLock = (session: ScheduledSession) => {
    setSessions(prev => prev.map(s => {
      if (s.id === session.id) {
        return { ...s, isCustomLocked: !s.isCustomLocked };
      }
      return s;
    }));
  };

  // Blackout date management
  const handleAddBlackout = (entry: HolidayEntry) => {
    setBlackoutDates(prev => {
      const exists = prev.some(h => h.date === entry.date);
      if (exists) return prev;
      return [...prev, entry].sort((a, b) => a.date.localeCompare(b.date));
    });
  };

  const handleRemoveBlackout = (dateStr: string) => {
    setBlackoutDates(prev => prev.filter(h => h.date !== dateStr));
  };

  // Topic Ingestion
  const handleImportTopics = (newTopics: Topic[], mode: 'REPLACE' | 'APPEND') => {
    let mergedTopics: Topic[];
    if (mode === 'REPLACE') {
      mergedTopics = newTopics;
    } else {
      const existingIds = new Set(topics.map(t => t.id));
      const fresh = newTopics.filter(t => !existingIds.has(t.id));
      mergedTopics = [...topics, ...fresh];
    }
    setTopics(mergedTopics);
    const freshSessions = generateFullSchedule(year, mergedTopics, blackoutDates, sessions, settings);
    setSessions(freshSessions);
  };

  // Switch the schedule year: add that year's default holidays, rebuild the schedule from the topics.
  // Locked/Completed sessions of the old year are not carried over.
  const handleChangeYear = (next: number) => {
    if (next === year || !Number.isInteger(next)) return;
    if (sessions.length > 0 && !window.confirm(`Rebuild the schedule for ${next}? The ${sessions.length} sessions for ${year} will be replaced (download a backup first if you need them).`)) return;
    const have = new Set(blackoutDates.map(h => h.date));
    const holidays = [...blackoutDates, ...defaultHolidays(next).filter(h => !have.has(h.date))].sort((a, b) => a.date.localeCompare(b.date));
    setYear(next);
    setBlackoutDates(holidays);
    setSessions(generateFullSchedule(next, topics, holidays, undefined, settings));
  };

  // New training days / time of day: rebuild around locked and completed sessions
  const handleApplySettings = (next: ScheduleSettings) => {
    setSettings(next);
    setSessions(generateFullSchedule(year, topics, blackoutDates, sessions, next));
  };

  // Clear everything
  const handleResetToDefaults = () => {
    if (window.confirm('Delete all topics and sessions and restore the default holiday list?')) {
      setTopics([]);
      setBlackoutDates(defaultHolidays(year));
      setSessions([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const csv = generateCsvContent(sessions);
    downloadBlob(csv, `annual_training_matrix_${year}.csv`, 'text/csv;charset=utf-8');
  };

  // Export iCalendar .ics for all sessions
  const handleExportAllIcs = () => {
    const ics = generateIcsContent(sessions, undefined, ship.name);
    downloadBlob(ics, `annual_training_matrix_full_${year}.ics`, 'text/calendar;charset=utf-8');
  };

  // Backup JSON State
  const handleBackupJson = () => {
    const backupData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      year,
      topics,
      blackoutDates,
      sessions,
      settings
    };
    downloadBlob(
      JSON.stringify(backupData, null, 2),
      `annual_training_matrix_backup_${year}_${new Date().toISOString().split('T')[0]}.json`,
      'application/json;charset=utf-8'
    );
  };

  // Restore JSON State from file
  const handleRestoreJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        if (Array.isArray(data.sessions) && data.sessions.every((x: ScheduledSession) => x && x.date && x.topicId)) {
          setSessions(data.sessions);
          if (data.topics && Array.isArray(data.topics)) setTopics(data.topics);
          if (data.blackoutDates && Array.isArray(data.blackoutDates)) setBlackoutDates(data.blackoutDates);
          if (typeof data.year === 'number') setYear(data.year);
          if (data.settings) setSettings(normalizeSettings(data.settings));
        } else {
          alert('Invalid JSON backup file. Missing sessions collection.');
        }
      } catch (err) {
        alert('Could not parse JSON backup file.');
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <SettingsContext.Provider value={settings}>
    <div className="text-slate-100 space-y-4">
      {/* Hidden File Input for JSON Restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleRestoreJson}
        accept=".json"
        className="hidden"
      />

      {/* =========================================================================
          TOP BAR CONTRACT (Mandatory 3-zone architecture per frontend constitution):
          Zone 1: Wordmark brand
          Zone 2: Clean single-line nav links
          Zone 3: 1 primary action
         ========================================================================= */}
      <header className="border-b border-slate-800/80 no-print">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-2">
          <h1 className="text-lg font-extrabold tracking-tight text-white">
            {customHeaders['training'] || 'Training'}
          </h1>

          {/* Zone 2: Navigation Links (Segmented Workspace Switcher) */}
          <nav className="flex items-center gap-1 sm:gap-2 text-xs font-medium">
            {canEdit && (
            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'DASHBOARD'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            )}

            <button
              onClick={() => setActiveTab('DEPARTMENTS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'DEPARTMENTS'
                  ? 'bg-amber-600 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>Dept Training</span>
            </button>

            {canEdit && (
            <button
              onClick={() => setActiveTab('ADMIN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'ADMIN'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Training Matrix</span>
            </button>
            )}

            <button
              onClick={() => setActiveTab('PUBLIC')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'PUBLIC'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>

            {canEdit && (
            <button
              onClick={() => setActiveTab('ANALYTICS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'ANALYTICS'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Fairness & Audit</span>
            </button>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
            <label className="flex items-center gap-1 text-xs text-slate-400">
              <span className="hidden lg:inline">Year</span>
              <input
                type="number"
                aria-label="Schedule year"
                min={2000}
                max={2100}
                defaultValue={year}
                key={year}
                onBlur={(e) => handleChangeYear(Number(e.target.value))}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200"
              />
            </label>
            )}
            {canEdit && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Choose the training days and time of day"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm active:scale-95"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Schedule</span>
            </button>
            )}

            <button
              onClick={() => window.print()}
              title="Generate executive-ready PDF or paper schedule with clean print formatting"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={() => setIsExportOpen(true)}
              title="Export the calendar for a date range, month or quarter as Excel, PDF or an image"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export…</span>
            </button>

            <button
              onClick={handleExportCsv}
              title="Download RFC 4180 CSV with UTF-8 BOM for Microsoft Excel"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* Print-Only Executive Header */}
      <div className="hidden print-only mb-6 pb-4 border-b-2 border-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {ship.name} Annual Training Matrix — {year}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {describeTime(settings)} · {describeDays(settings)} · {sessions.length} sessions on {workingSlots} training days
            </p>
          </div>
          <div className="text-right text-xs text-slate-600 font-mono">
            <div>Export Date: {new Date().toISOString().split('T')[0]}</div>
            <div>Open conflicts: {metrics.conflictCount}</div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1 w-full space-y-6">
        {/* Main Landing Dashboard Front Page */}
        {activeTab === 'DASHBOARD' && (
          <MainDashboard
            sessions={sessions}
            topics={topics}
            blackoutDates={blackoutDates}
            conflicts={conflicts}
            year={year}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenIngestion={() => setIsIngestionOpen(true)}
            onOpenBlackouts={() => setIsBlackoutOpen(true)}
            onExportCsv={handleExportCsv}
            onPrint={() => window.print()}
          />
        )}

        {/* Operational Ribbon shown on Core Matrix Planning Modules */}
        {(activeTab === 'ADMIN' || activeTab === 'PUBLIC' || activeTab === 'ANALYTICS') && (
          <>
            <div className="flex items-center justify-between no-print">
              <button
                onClick={() => setActiveTab('DASHBOARD')}
                className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <span>← Training dashboard</span>
              </button>
              <div className="text-xs text-slate-400 font-medium">
                Active Module:{' '}
                <strong className="text-blue-400">
                  {activeTab === 'ADMIN'
                    ? 'Training Matrix Planner Studio'
                    : activeTab === 'PUBLIC'
                      ? 'Public Calendar & Sub-Track Portal'
                      : 'Fairness, Rotation & D3 Analytics'}
                </strong>
              </div>
            </div>

            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm no-print">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Metric Items with typographic separators */}
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Sessions:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {metrics.totalSessions} / {workingSlots}
                    </span>
                    <span className="text-slate-500 text-[11px]">training days{unscheduledTopics.length > 0 ? ` · ${unscheduledTopics.length} topics unscheduled` : ''}</span>
                  </div>

                  <span className="text-slate-700 hidden sm:inline" aria-hidden="true">·</span>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Time:</span>
                    <span className="font-mono font-semibold text-blue-300">
                      {describeTime(settings)}
                    </span>
                    <span className="text-slate-500 text-[11px]">{describeDays(settings)}</span>
                  </div>

                  <span className="text-slate-700 hidden sm:inline" aria-hidden="true">·</span>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Track Ratio:</span>
                    <span className="font-mono text-slate-200">
                      {metrics.companyWideCount} Ship-Wide · {metrics.departmentalCount} Dept
                    </span>
                  </div>

                  <span className="text-slate-700 hidden sm:inline" aria-hidden="true">·</span>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Constraint Status:</span>
                    {sessions.length === 0 ? (
                      <span className="text-slate-500 text-xs">No sessions yet</span>
                    ) : metrics.conflictCount === 0 ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Zero Collisions</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setActiveTab('ADMIN')}
                        className="text-amber-400 font-semibold flex items-center gap-1 text-xs hover:underline cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{metrics.conflictCount} Warning{metrics.conflictCount > 1 ? 's' : ''}</span>
                      </button>
                    )}
                  </div>
                </div>

                {canEdit && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={handleBackupJson}
                    title="Download full JSON backup of matrix, topics, and blackout dates"
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                  >
                    <Database className="w-3 h-3 text-purple-400" />
                    <span>Backup JSON</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Restore matrix state from a previously saved JSON file"
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                  >
                    <Upload className="w-3 h-3 text-emerald-400" />
                    <span>Restore</span>
                  </button>

                  <button
                    onClick={handleExportAllIcs}
                    title="Export all sessions as RFC 5545 iCalendar (.ics)"
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                  >
                    <Calendar className="w-3 h-3 text-blue-400" />
                    <span>Full .ICS</span>
                  </button>

                  <button
                    onClick={handleResetToDefaults}
                    title="Delete all topics and sessions"
                    className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* Tab: Departments Showcase Page (Image 3 Reference) */}
        {activeTab === 'DEPARTMENTS' && (
          <DepartmentsShowcasePage
            sessions={sessions}
            topics={topics}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {/* Tab 1: Admin Matrix Table */}
        {activeTab === 'ADMIN' && (
          <AdminMatrixTable
            sessions={sessions}
            conflicts={conflicts}
            blackoutDates={blackoutDates}
            topics={topics}
            onUpdateSession={handleUpdateSession}
            onDeleteSession={handleDeleteSession}
            onAutoSchedule={handleAutoSchedule}
            unscheduledCount={unscheduledTopics.length}
            onCascadeReschedule={handleCascadeReschedule}
            onShiftSessionOneDay={handleShiftOneDay}
            onOpenConflictModal={(conflict) => setActiveConflict(conflict)}
            onOpenBlackoutManager={() => setIsBlackoutOpen(true)}
            onOpenIngestionModal={() => setIsIngestionOpen(true)}
            today={today}
            isAdmin={isAdmin}
            onMoveSession={requestChange}
            onReschedule={setRescheduling}
          />
        )}

        {/* Tab 2: Public Calendar & Agenda View */}
        {activeTab === 'PUBLIC' && (
          <PublicCalendarView
            sessions={sessions}
            topics={topics}
          />
        )}

        {/* Tab 3: Fairness & Analytics Audit */}
        {activeTab === 'ANALYTICS' && (
          <AnalyticsView
            sessions={sessions}
            topics={topics}
            conflicts={conflicts}
          />
        )}
      </main>

      {/* Modal Dialogs */}
      <TopicIngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onImportTopics={handleImportTopics}
        currentTopics={topics}
      />

      <BlackoutManagerModal
        isOpen={isBlackoutOpen}
        onClose={() => setIsBlackoutOpen(false)}
        blackoutDates={blackoutDates}
        onAddBlackout={handleAddBlackout}
        onRemoveBlackout={handleRemoveBlackout}
        onCascadeReschedule={() => handleCascadeReschedule(1)}
      />

      <ConflictResolutionModal
        conflict={activeConflict}
        session={sessions.find(s => s.id === activeConflict?.sessionId)}
        onClose={() => setActiveConflict(null)}
        onShiftOneDay={handleShiftOneDay}
        onCascadeReschedule={handleCascadeReschedule}
        onClearPrerequisite={handleClearPrerequisite}
        onToggleLock={handleToggleLock}
      />

      {isExportOpen && <ExportCalendarModal sessions={sessions} year={year} shipName={ship.name} today={today} onClose={() => setIsExportOpen(false)} />}

      {rescheduling && (
        <RescheduleModal session={rescheduling} today={today} onCancel={() => setRescheduling(null)}
          onApply={(date, start, reason) => handleReschedule(rescheduling, date, start, reason)} />
      )}

      {pendingChange && (
        <OverrideModal
          session={pendingChange.session}
          conflicts={pendingChange.conflicts}
          isAdmin={isAdmin}
          onCancel={() => setPendingChange(null)}
          onOverride={() => { handleUpdateSession({ ...pendingChange.session, adminOverride: true }); setPendingChange(null); }}
        />
      )}

      <ScheduleSettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        sessionCount={sessions.length}
        onClose={() => setIsSettingsOpen(false)}
        onApply={handleApplySettings}
      />
    </div>
    </SettingsContext.Provider>
  );
}
