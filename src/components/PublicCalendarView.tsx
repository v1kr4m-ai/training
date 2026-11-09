/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ScheduledSession, Topic } from '../types';
import { getDepartmentConfig, DEPARTMENTS, DEPARTMENT_NAMES } from '../data/departments';
import { generateIcsContent, downloadBlob, copyScheduleToClipboard } from '../utils/exporters';
import { formatDate } from '../utils/scheduler';
import { useSettings } from '../utils/settingsContext';
import { usePortal } from '../portal/store';
import { DAY_NAMES, describeDays, describeTime } from '../utils/settings';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Share2, 
  Search, 
  Clock, 
  MapPin, 
  User, 
  Layers, 
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Filter,
  ListFilter,
  Grid3X3,
  Printer,
  FileText,
  AlertTriangle,
  RotateCcw,
  XCircle,
  Check
} from 'lucide-react';
import { MonthlyBulletinModal } from './MonthlyBulletinModal';
import { HolidayEntry } from '../types';

interface PublicCalendarViewProps {
  sessions: ScheduledSession[];
  topics: Topic[];
  blackoutDates?: HolidayEntry[];
  isAdmin?: boolean;
  onUpdateSession?: (session: ScheduledSession) => void;
  onReschedule?: (session: ScheduledSession) => void;
}

export const PublicCalendarView: React.FC<PublicCalendarViewProps> = ({ 
  sessions, 
  topics, 
  blackoutDates = [],
  isAdmin = false,
  onUpdateSession,
  onReschedule
}) => {
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedSubDept, setSelectedSubDept] = useState<string>('ALL');
  const [selectedTrack, setSelectedTrack] = useState<'ALL' | 'COMPANY_WIDE' | 'DEPARTMENTAL'>('ALL');
  const settings = useSettings();
  const { ship } = usePortal();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'GRID' | 'AGENDA'>('GRID');
  
  // Calendar opens on the current month when it falls inside the schedule's year, else on the earliest session
  const todayStr = formatDate(new Date());
  const initialDate = useMemo(() => {
    const now = new Date();
    const earliest = sessions.reduce((m, s) => (s.date < m ? s.date : m), sessions[0]?.date || todayStr);
    const [y, m] = earliest.split('-').map(Number);
    return y === now.getFullYear() ? new Date(y, now.getMonth(), 1) : new Date(y, m - 1, 1);
  }, [sessions, todayStr]);

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(initialDate);
  const [activeSessionDetail, setActiveSessionDetail] = useState<ScheduledSession | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isBulletinModalOpen, setIsBulletinModalOpen] = useState(false);

  // Section list dynamically computed based on selected Department
  const availableSections = useMemo(() => {
    if (selectedDept === 'ALL') {
      // Gather all unique sections across all sessions
      const set = new Set<string>();
      sessions.forEach(s => {
        if (s.subDepartment) set.add(s.subDepartment);
      });
      return Array.from(set).sort();
    }
    const deptConfig = DEPARTMENTS[selectedDept];
    return deptConfig ? deptConfig.subDepartments : [];
  }, [selectedDept, sessions]);

  // Reset section if parent department changes
  const handleDepartmentChange = (dept: string) => {
    setSelectedDept(dept);
    setSelectedSubDept('ALL');
  };

  // Filtered session list
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Track filter
      if (selectedTrack !== 'ALL' && session.trackType !== selectedTrack) {
        return false;
      }

      // Department filter
      if (selectedDept !== 'ALL' && session.department !== selectedDept) {
        return false;
      }

      // Section filter (Crucial requirement!)
      if (selectedSubDept !== 'ALL' && session.subDepartment !== selectedSubDept) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = session.title.toLowerCase().includes(q);
        const matchSpeaker = session.speaker.toLowerCase().includes(q);
        const matchDesc = session.description?.toLowerCase().includes(q);
        const matchSub = session.subDepartment?.toLowerCase().includes(q);
        if (!matchTitle && !matchSpeaker && !matchDesc && !matchSub) {
          return false;
        }
      }

      return true;
    });
  }, [sessions, selectedTrack, selectedDept, selectedSubDept, searchQuery]);

  // Calendar Grid Calculations
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    // First day of current month
    const firstDayOfMonth = new Date(year, month, 1);
    // Last day of current month
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Days in current month
    const numDays = lastDayOfMonth.getDate();
    // Day of week for first day (0=Sun, 1=Mon, ..., 6=Sat)
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday

    // Filter sessions belonging to this month
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const sessionsByDate = new Map<string, ScheduledSession[]>();
    
    filteredSessions.forEach(s => {
      if (s.date.startsWith(monthPrefix)) {
        const list = sessionsByDate.get(s.date) || [];
        list.push(s);
        sessionsByDate.set(s.date, list);
      }
    });

    // Generate grid items
    const days: Array<{
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      sessions: ScheduledSession[];
    }> = [];

    // Leading padding days (if month does not start on Sunday)
    for (let i = 0; i < startDayOfWeek; i++) {
      const prevDate = new Date(year, month, -(startDayOfWeek - 1 - i));
      const pStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
      days.push({
        dayNum: prevDate.getDate(),
        dateStr: pStr,
        isCurrentMonth: false,
        isWeekend: prevDate.getDay() === 0 || prevDate.getDay() === 6,
        sessions: []
      });
    }

    // Days of current month
    for (let d = 1; d <= numDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(year, month, d);
      const isWeekendDay = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        isWeekend: isWeekendDay,
        sessions: sessionsByDate.get(dateStr) || []
      });
    }

    // Trailing padding days to fill 35 or 42 grid slots
    const totalCells = Math.ceil(days.length / 7) * 7;
    let nextMonthDay = 1;
    while (days.length < totalCells) {
      const nDate = new Date(year, month + 1, nextMonthDay);
      const nStr = `${nDate.getFullYear()}-${String(nDate.getMonth() + 1).padStart(2, '0')}-${String(nDate.getDate()).padStart(2, '0')}`;
      days.push({
        dayNum: nextMonthDay,
        dateStr: nStr,
        isCurrentMonth: false,
        isWeekend: nDate.getDay() === 0 || nDate.getDay() === 6,
        sessions: []
      });
      nextMonthDay++;
    }

    return days;
  }, [currentMonthDate, filteredSessions]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  const handleExportFilteredIcs = () => {
    const icsString = generateIcsContent(filteredSessions, {
      department: selectedDept,
      subDepartment: selectedSubDept
    }, ship.name);
    const subDeptSuffix = selectedSubDept !== 'ALL' ? `_${selectedSubDept.replace(/\s+/g, '_')}` : '';
    const deptSuffix = selectedDept !== 'ALL' ? `_${selectedDept.replace(/\s+/g, '_')}` : '';
    downloadBlob(icsString, `Training_Matrix${deptSuffix}${subDeptSuffix}_${initialDate.getFullYear()}.ics`, 'text/calendar;charset=utf-8');
  };

  const handleCopyTeamsSchedule = async () => {
    const title = selectedSubDept !== 'ALL'
      ? `${ship.name} Training - ${selectedDept} (${selectedSubDept})`
      : selectedDept !== 'ALL'
        ? `${ship.name} Training - ${selectedDept}`
        : `${ship.name} Annual Training Schedule`;

    const ok = await copyScheduleToClipboard(filteredSessions, title);
    if (ok) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  // Find linked topic metadata for detail modal
  const selectedTopicDetail = useMemo(() => {
    if (!activeSessionDetail) return null;
    return topics.find(t => t.id === activeSessionDetail.topicId) || null;
  }, [activeSessionDetail, topics]);

  return (
    <div className="space-y-4">
      {/* Search, Filter & Calendar Action Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Filters cluster */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Box */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search sessions or speakers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
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

            {/* Track Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Track:</span>
              <select
                value={selectedTrack}
                onChange={(e) => setSelectedTrack(e.target.value as any)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Tracks</option>
                <option value="COMPANY_WIDE">Ship-Wide</option>
                <option value="DEPARTMENTAL">Departmental</option>
              </select>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Dept:</span>
              <select
                value={selectedDept}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Departments</option>
                <option value="Ship-Wide">Ship-Wide</option>
                {DEPARTMENT_NAMES.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Section Filter (Crucial Feature!) */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Sub-Track:</span>
              <select
                value={selectedSubDept}
                onChange={(e) => setSelectedSubDept(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 max-w-[200px]"
              >
                <option value="ALL">All Sub-Tracks</option>
                {availableSections.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>

          {/* View mode toggle & Export Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Segmented Switch */}
            <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                onClick={() => setViewMode('GRID')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'GRID' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                <span>Month</span>
              </button>
              <button
                onClick={() => setViewMode('AGENDA')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'AGENDA' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Agenda</span>
              </button>
            </div>

            {/* Tailored .ICS Export */}
            <button
              onClick={handleExportFilteredIcs}
              title={`Download RFC 5545 .ICS for ${selectedSubDept !== 'ALL' ? selectedSubDept : selectedDept !== 'ALL' ? selectedDept : 'All Filtered Sessions'}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                Export .ICS {selectedSubDept !== 'ALL' ? `(${selectedSubDept.substring(0, 10)}...)` : ''}
              </span>
            </button>

            {/* Monthly Bulletin Board PDF */}
            <button
              onClick={() => setIsBulletinModalOpen(true)}
              title="Generate professional-looking PDF specifically formatted for ship bulletin boards"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Bulletin PDF</span>
            </button>

            {/* Rich Text Clipboard Copy for Teams / Outlook */}
            <button
              onClick={handleCopyTeamsSchedule}
              title="Copy formatted rich-text schedule table to clipboard for Microsoft Teams or Outlook"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-400" />
              <span>{copySuccess ? 'Copied HTML!' : 'Copy for Teams'}</span>
            </button>
          </div>
        </div>

        {/* Filter Breadcrumb Summary */}
        {(selectedDept !== 'ALL' || selectedSubDept !== 'ALL' || selectedTrack !== 'ALL') && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-slate-500">Active Scope:</span>
              {selectedTrack !== 'ALL' && (
                <span className="px-2 py-0.5 bg-blue-950/80 text-blue-300 rounded border border-blue-800/40 font-mono text-[11px]">
                  {selectedTrack}
                </span>
              )}
              {selectedDept !== 'ALL' && (
                <span className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700 font-mono text-[11px]">
                  {selectedDept}
                </span>
              )}
              {selectedSubDept !== 'ALL' && (
                <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-300 rounded border border-emerald-800/40 font-mono text-[11px]">
                  {selectedSubDept}
                </span>
              )}
              <span className="text-slate-500">· {filteredSessions.length} sessions matching</span>
            </div>
            <button
              onClick={() => {
                setSelectedDept('ALL');
                setSelectedSubDept('ALL');
                setSelectedTrack('ALL');
                setSearchQuery('');
              }}
              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* View Mode 1: Month Calendar Grid */}
      {viewMode === 'GRID' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {/* Calendar Month Header & Navigation */}
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarIcon className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                {monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
              </h2>
              <span className="text-xs text-slate-400">
                ({filteredSessions.filter(s => s.date.startsWith(`${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`)).length} sessions this month)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsBulletinModalOpen(true)}
                title="Generate professional-looking PDF of this month for ship bulletin board"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm active:scale-95 mr-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Bulletin Board PDF</span>
              </button>

              <button
                onClick={handlePrevMonth}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentMonthDate(initialDate)}
                className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-slate-950/60 border-b border-slate-800 text-center text-[11px] font-semibold text-slate-400 py-2">
            {DAY_NAMES.map((name, d) => {
              const use = settings.days[d];
              const tag = use === 'COMPANY_WIDE' ? ' (Ship-Wide)' : use === 'DEPARTMENTAL' ? ' (Dept)' : use === 'ANY' ? ' (Any)' : '';
              const color = use === 'COMPANY_WIDE' ? 'text-blue-400' : use === 'DEPARTMENTAL' ? 'text-emerald-400' : use === 'ANY' ? 'text-amber-400' : '';
              return <div key={d} className={color}>{name}{tag}</div>;
            })}
          </div>

          {/* Day Grid Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-800 bg-slate-950/30">
            {calendarDays.map((cell, idx) => {
              const isToday = cell.dateStr === todayStr;

              return (
                <div
                  key={idx}
                  className={`min-h-[110px] p-1.5 transition-colors flex flex-col justify-between ${
                    cell.isWeekend
                      ? 'bg-slate-950/70 text-slate-600'
                      : !cell.isCurrentMonth
                        ? 'bg-slate-950/40 text-slate-600'
                        : 'bg-slate-900/60 text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {/* Day number header */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-mono font-medium px-1 rounded ${
                        isToday
                          ? 'bg-blue-600 text-white font-bold'
                          : cell.isCurrentMonth
                            ? 'text-slate-300'
                            : 'text-slate-600'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {cell.sessions.length > 0 && (
                      <div className="flex items-center gap-1">
                        {cell.sessions.length > 1 && cell.sessions.some((s1, i) =>
                          cell.sessions.some((s2, j) => i !== j && s1.department !== s2.department && (s1.startTime === s2.startTime || (s1.endTime && s2.endTime && s1.startTime < s2.endTime && s2.startTime < s1.endTime)))
                        ) && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40" title="Concurrent department conflict: Multiple departments scheduled simultaneously">
                            ⚠️ Slot Clash
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          {cell.sessions[0].startTime}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Sessions in day */}
                  <div className="space-y-1 flex-1 overflow-y-auto max-h-[85px]">
                    {cell.sessions.map((session) => {
                      const dept = getDepartmentConfig(session.department);
                      const isCompany = session.trackType === 'COMPANY_WIDE';
                      const isConcurrent = cell.sessions.some(other =>
                        other.id !== session.id &&
                        other.department !== session.department &&
                        (other.startTime === session.startTime || (other.endTime && session.endTime && other.startTime < session.endTime && session.startTime < other.endTime))
                      );

                      return (
                        <div
                          key={session.id}
                          onClick={() => setActiveSessionDetail(session)}
                          style={{ borderLeftColor: dept.color }}
                          className={`p-1.5 rounded text-[11px] cursor-pointer transition-all border-l-2 shadow-xs group ${
                            isConcurrent
                              ? 'bg-amber-950/40 border-amber-500/80 ring-1 ring-amber-500/30'
                              : isCompany 
                                ? 'bg-blue-950/70 hover:bg-blue-900/80 border-blue-500' 
                                : 'bg-slate-800 hover:bg-slate-700/90 border-emerald-500'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span 
                              className="font-bold text-[10px] uppercase truncate"
                              style={{ color: dept.color }}
                            >
                              {session.department}
                            </span>
                            <div className="flex items-center gap-1">
                              {isConcurrent && (
                                <span className="text-[8px] font-bold text-amber-300 bg-amber-950 px-1 rounded border border-amber-700/50" title="Concurrent department conflict">
                                  ⚠️ Clash
                                </span>
                              )}
                              <span className="text-[9px] text-slate-400 font-mono">
                                #{session.sequenceNumber}
                              </span>
                            </div>
                          </div>
                          <div className="font-medium text-slate-100 group-hover:text-blue-300 line-clamp-2 leading-tight mt-0.5">
                            {session.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View Mode 2: Chronological Agenda List */}
      {viewMode === 'AGENDA' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-emerald-400" />
              <span>Full Curriculum Agenda ({filteredSessions.length} Sessions)</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">{describeDays(settings)} · {describeTime(settings)}</span>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-[640px] overflow-y-auto">
            {filteredSessions.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <p className="text-sm">No scheduled sessions found for the current filters.</p>
              </div>
            ) : (
              filteredSessions.map((session) => {
                const dept = getDepartmentConfig(session.department);
                const isCompany = session.trackType === 'COMPANY_WIDE';

                return (
                  <div
                    key={session.id}
                    onClick={() => setActiveSessionDetail(session)}
                    className="p-4 hover:bg-slate-800/40 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    {/* Left: Date and Sequence block */}
                    <div className="flex items-start gap-3 min-w-[200px]">
                      <div className="text-center bg-slate-950 border border-slate-800 rounded-lg p-2 min-w-[54px]">
                        <span className="block text-[10px] font-mono uppercase text-slate-400">
                          Wk {session.weekNumber}
                        </span>
                        <span className="block text-sm font-bold text-white font-mono">
                          #{session.sequenceNumber}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-mono font-medium text-slate-300">
                          {session.date}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{session.endTime ? `${session.startTime} – ${session.endTime}` : session.startTime}</span>
                        </div>
                        <div className="mt-1">
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            isCompany ? 'bg-blue-950 text-blue-300' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {isCompany ? 'Ship-Wide' : 'Departmental'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Title, Sub-track & Description */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-xs font-semibold"
                          style={{ color: dept.color }}
                        >
                          {session.department}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-xs text-slate-400">
                          {session.subDepartment}
                        </span>
                        {session.prerequisiteId && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-1 rounded">
                              Prereq: {session.prerequisiteId}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                        {session.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {session.description}
                      </p>
                    </div>

                    {/* Right: Speaker & Location */}
                    <div className="flex flex-col md:items-end gap-1 text-xs text-slate-300 min-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-medium">{session.speaker}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>{session.location}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      {activeSessionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setActiveSessionDetail(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              ✕
            </button>

            {/* Department & Track Tag */}
            <div className="flex flex-wrap items-center gap-2">
              <span 
                className="px-2.5 py-0.5 rounded text-xs font-bold"
                style={{ 
                  backgroundColor: `${getDepartmentConfig(activeSessionDetail.department).color}25`,
                  color: getDepartmentConfig(activeSessionDetail.department).color 
                }}
              >
                {activeSessionDetail.department}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {activeSessionDetail.subDepartment}
              </span>
              <span className="text-xs font-mono text-slate-500">
                · Session #{activeSessionDetail.sequenceNumber}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                activeSessionDetail.status === 'Completed'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : activeSessionDetail.status === 'Skipped'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : activeSessionDetail.status === 'Rescheduled'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {activeSessionDetail.status || 'Scheduled'}
              </span>
              {activeSessionDetail.adminOverride && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Concurrent Override</span>
                </span>
              )}
            </div>

            {/* Admin Override Alert if concurrent session */}
            {activeSessionDetail.adminOverride && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-lg text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Caution: Concurrent Lecture Conflict</strong> — Admin override active. This lecture is scheduled concurrently with another session on {activeSessionDetail.date} at {activeSessionDetail.startTime}.
                </span>
              </div>
            )}

            {/* Admin Status & Reschedule Controls */}
            {isAdmin && onUpdateSession && (
              <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Admin Action: Update Session Status & Reschedule
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      const updated: ScheduledSession = { ...activeSessionDetail, status: 'Completed' };
                      onUpdateSession(updated);
                      setActiveSessionDetail(updated);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors ${
                      activeSessionDetail.status === 'Completed'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Completed</span>
                  </button>

                  <button
                    onClick={() => {
                      const updated: ScheduledSession = { ...activeSessionDetail, status: 'Skipped' };
                      onUpdateSession(updated);
                      setActiveSessionDetail(updated);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors ${
                      activeSessionDetail.status === 'Skipped'
                        ? 'bg-rose-700 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Skipped</span>
                  </button>

                  <button
                    onClick={() => {
                      const updated: ScheduledSession = { ...activeSessionDetail, status: 'Scheduled' };
                      onUpdateSession(updated);
                      setActiveSessionDetail(updated);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors ${
                      activeSessionDetail.status === 'Scheduled' || !activeSessionDetail.status
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>Scheduled</span>
                  </button>

                  {onReschedule && (
                    <button
                      onClick={() => {
                        const target = activeSessionDetail;
                        setActiveSessionDetail(null);
                        onReschedule(target);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 bg-amber-600/80 hover:bg-amber-600 text-white transition-colors ml-auto"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reschedule Date…</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Title */}
            <h2 className="text-lg font-bold text-white leading-snug">
              {activeSessionDetail.title}
            </h2>

            {/* Time & Location Bar */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl text-xs border border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-4 h-4 text-blue-400" />
                <div>
                  <span className="font-mono">{activeSessionDetail.date}</span>
                  <span className="block text-[10px] text-slate-500">{activeSessionDetail.endTime ? `${activeSessionDetail.startTime} – ${activeSessionDetail.endTime}` : activeSessionDetail.startTime}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="font-medium">{activeSessionDetail.location || 'Venue not set'}</span>
                </div>
              </div>
            </div>

            {/* Speaker Information */}
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
                  {(activeSessionDetail.speaker || '?').charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    {activeSessionDetail.speaker || 'Speaker not assigned'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Faculty Lead / Subject Matter Specialist
                  </div>
                </div>
              </div>
            </div>

            {/* Curriculum Description */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Executive Curriculum Overview
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeSessionDetail.description || 'Comprehensive training and domain practice session.'}
              </p>
            </div>

            {/* Learning Outcomes if available in linked topic */}
            {selectedTopicDetail?.learningOutcomes && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Key Competencies & Learning Outcomes
                </h4>
                <ul className="space-y-1">
                  {selectedTopicDetail.learningOutcomes.map((outcome, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* DAG Prerequisite */}
            {activeSessionDetail.prerequisiteId && (
              <div className="p-2.5 bg-purple-950/40 border border-purple-800/50 rounded-lg text-xs text-purple-200 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  <strong>DAG Prerequisite Required:</strong> Topic ID{' '}
                  <code className="font-mono font-bold">{activeSessionDetail.prerequisiteId}</code> must be completed prior to this session.
                </span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
              <button
                onClick={() => {
                  const ics = generateIcsContent([activeSessionDetail], undefined, ship.name);
                  downloadBlob(ics, `${activeSessionDetail.id}.ics`, 'text/calendar;charset=utf-8');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Add to Outlook/Calendar (.ics)</span>
              </button>
              <button
                onClick={() => setActiveSessionDetail(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Notice Board Bulletin PDF Modal */}
      {isBulletinModalOpen && (
        <MonthlyBulletinModal
          isOpen={isBulletinModalOpen}
          onClose={() => setIsBulletinModalOpen(false)}
          sessions={sessions}
          holidays={blackoutDates}
          shipName={ship.name}
          shipPennant={ship.pennant}
          initialMonthDate={currentMonthDate}
          settings={settings}
        />
      )}
    </div>
  );
};
