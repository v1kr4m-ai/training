/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Topic, ScheduledSession, HolidayEntry } from '../types';
import { ALL_TRACK_DEPARTMENTS, DEPARTMENT_NAMES } from '../data/departments';
import { addMinutes } from '../utils/time';
import { weekOfYear, formatDate } from '../utils/scheduler';
import { 
  X, 
  Calendar, 
  Clock, 
  Repeat, 
  Layers, 
  Plus, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  MapPin,
  UserCheck
} from 'lucide-react';

export type RecurrencePattern = 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  topics: Topic[];
  blackoutDates: HolidayEntry[];
  existingSessions: ScheduledSession[];
  onAddSessions: (newSessions: ScheduledSession[]) => void;
  initialDate?: string;
  defaultStartTime?: string;
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  topics,
  blackoutDates,
  existingSessions,
  onAddSessions,
  initialDate,
  defaultStartTime = '09:00'
}) => {
  const todayStr = useMemo(() => formatDate(new Date()), []);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topics[0]?.id || 'CUSTOM');
  const [customTitle, setCustomTitle] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['Executive']);
  const [subDepartment, setSubDepartment] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [venue, setVenue] = useState('Briefing Room');
  const [startDate, setStartDate] = useState(initialDate || todayStr);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [trackType, setTrackType] = useState<'DEPARTMENTAL' | 'COMPANY_WIDE'>('DEPARTMENTAL');

  // Recurrence controls
  const [recurrence, setRecurrence] = useState<RecurrencePattern>('NONE');
  const [repeatCount, setRepeatCount] = useState<number>(4);
  const [skipBlackouts, setSkipBlackouts] = useState<boolean>(true);
  const [adminOverride, setAdminOverride] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync fields when selected topic changes
  const handleTopicChange = (topicId: string) => {
    setSelectedTopicId(topicId);
    if (topicId === 'CUSTOM') {
      setCustomTitle('');
      return;
    }
    const topic = topics.find(t => t.id === topicId);
    if (topic) {
      setCustomTitle(topic.title);
      setSelectedDepts([topic.department || 'Executive']);
      setSubDepartment(topic.subDepartment || '');
      setSpeaker(topic.speaker || '');
      setVenue(topic.venue || 'Briefing Room');
      setDurationMinutes(topic.durationMinutes || 60);
      setTrackType(topic.trackType || 'DEPARTMENTAL');
    }
  };

  // Toggle department multi-selection
  const toggleDept = (deptName: string) => {
    setSelectedDepts(prev => {
      if (prev.includes(deptName)) {
        if (prev.length === 1) return prev; // Keep at least one department
        return prev.filter(d => d !== deptName);
      } else {
        return [...prev, deptName];
      }
    });
  };

  const selectAllDepts = () => {
    setSelectedDepts([...DEPARTMENT_NAMES]);
  };

  // Blackout date set for quick lookup
  const blackoutSet = useMemo(() => {
    return new Set(blackoutDates.map(b => b.date));
  }, [blackoutDates]);

  // Compute calculated end time
  const computedEndTime = useMemo(() => {
    return addMinutes(startTime, durationMinutes) || '';
  }, [startTime, durationMinutes]);

  // Preview generated session dates based on recurrence pattern
  const previewDates = useMemo(() => {
    if (!startDate) return [];
    const occurrences: string[] = [];
    let current = new Date(`${startDate}T12:00:00`);

    const maxOccurrences = recurrence === 'NONE' ? 1 : Math.max(1, Math.min(26, repeatCount));
    let attempts = 0;

    while (occurrences.length < maxOccurrences && attempts < 120) {
      attempts++;
      const dateStr = formatDate(current);
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isBlackout = blackoutSet.has(dateStr);

      if (skipBlackouts && (isWeekend || isBlackout)) {
        // Step forward by 1 day if daily, otherwise step to next pattern slot
        if (recurrence === 'DAILY') {
          current.setDate(current.getDate() + 1);
          continue;
        }
      }

      occurrences.push(dateStr);

      // Increment date based on pattern
      if (recurrence === 'DAILY') {
        current.setDate(current.getDate() + 1);
      } else if (recurrence === 'WEEKLY') {
        current.setDate(current.getDate() + 7);
      } else if (recurrence === 'BIWEEKLY') {
        current.setDate(current.getDate() + 14);
      } else {
        break;
      }
    }

    return occurrences;
  }, [startDate, recurrence, repeatCount, skipBlackouts, blackoutSet]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = selectedTopicId === 'CUSTOM' ? customTitle.trim() : (customTitle.trim() || topics.find(t => t.id === selectedTopicId)?.title || 'Untitled Topic');

    if (!finalTitle) {
      setErrorMsg('Please specify a session title or choose a topic.');
      return;
    }

    if (!startDate) {
      setErrorMsg('Please choose a starting date.');
      return;
    }

    if (selectedDepts.length === 0) {
      setErrorMsg('Please select at least one department.');
      return;
    }

    const currentMaxSeq = existingSessions.reduce((max, s) => Math.max(max, s.sequenceNumber || 0), 0);
    const newSessionsList: ScheduledSession[] = [];
    let seqCounter = currentMaxSeq + 1;

    // For each preview date and for each targeted department (or single session if track is company wide)
    previewDates.forEach(dateStr => {
      const dayOfWeek = new Date(`${dateStr}T12:00:00`).getDay();
      const weekNumber = weekOfYear(dateStr);

      if (trackType === 'COMPANY_WIDE') {
        newSessionsList.push({
          id: `ses-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sequenceNumber: seqCounter++,
          weekNumber,
          dayOfWeek,
          date: dateStr,
          startTime,
          durationMinutes,
          endTime: computedEndTime,
          topicId: selectedTopicId === 'CUSTOM' ? `TOP-${Date.now()}` : selectedTopicId,
          title: finalTitle,
          department: selectedDepts[0] || 'Ship-Wide',
          subDepartment: subDepartment.trim() || 'Whole Ship',
          trackType: 'COMPANY_WIDE',
          speaker: speaker.trim() || 'Designated Trainer',
          description: `Scheduled repeating session for ${finalTitle}`,
          location: venue.trim() || 'Ship-Wide',
          status: 'Scheduled',
          isCustomLocked: true,
          adminOverride: adminOverride
        });
      } else {
        // Create an entry per selected department
        selectedDepts.forEach(dept => {
          newSessionsList.push({
            id: `ses-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sequenceNumber: seqCounter++,
            weekNumber,
            dayOfWeek,
            date: dateStr,
            startTime,
            durationMinutes,
            endTime: computedEndTime,
            topicId: selectedTopicId === 'CUSTOM' ? `TOP-${Date.now()}` : selectedTopicId,
            title: finalTitle,
            department: dept,
            subDepartment: subDepartment.trim(),
            trackType: 'DEPARTMENTAL',
            speaker: speaker.trim() || 'Department Instructor',
            description: `Scheduled ${recurrence !== 'NONE' ? `${recurrence.toLowerCase()} repeat ` : ''}session for ${dept}`,
            location: venue.trim() || 'Department Flat',
            status: 'Scheduled',
            isCustomLocked: true,
            adminOverride: adminOverride
          });
        });
      }
    });

    onAddSessions(newSessionsList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Schedule Training Session
              </h2>
              <p className="text-xs text-slate-400">
                Plan new training sessions with recurring daily, weekly, or bi-weekly cadence.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Topic Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Topic or Curriculum Subject
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <select
                  value={selectedTopicId}
                  onChange={(e) => handleTopicChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="CUSTOM">-- Custom Title (Manual Entry) --</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>
                      [{t.department}] {t.title} {t.durationMinutes ? `(${t.durationMinutes}m)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={trackType}
                  onChange={(e) => setTrackType(e.target.value as 'DEPARTMENTAL' | 'COMPANY_WIDE')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="DEPARTMENTAL">Departmental</option>
                  <option value="COMPANY_WIDE">Ship-Wide</option>
                </select>
              </div>
            </div>

            <input
              type="text"
              placeholder="Session Title or Subject Details..."
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Department Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Target Department(s)</span>
              </label>
              <button
                type="button"
                onClick={selectAllDepts}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
              >
                Select All
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/80 border border-slate-800 rounded-xl">
              {DEPARTMENT_NAMES.map(dept => {
                const selected = selectedDepts.includes(dept);
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDept(dept)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      selected
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Logistics: Speaker, Venue, Sub-Department */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Instructor / Speaker
              </label>
              <div className="relative">
                <UserCheck className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. Lt Cdr Roy"
                  value={speaker}
                  onChange={(e) => setSpeaker(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Venue / Compartment
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. MCR / Bridge"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Section / Division
              </label>
              <input
                type="text"
                placeholder="e.g. Propulsion / Navigation"
                value={subDepartment}
                onChange={(e) => setSubDepartment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Time & Scheduling */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>Start Date</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Start Time</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Duration (min) → End
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-400 font-mono">
                  {computedEndTime ? `→ ${computedEndTime}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              REPEAT / RECURRENCE SECTION (Key Requirement)
             ========================================================================= */}
          <div className="p-3.5 bg-blue-950/20 border border-blue-900/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-blue-200 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-blue-400" />
                <span>Repeat & Recurrence Cadence</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Auto-generate series for specific departments
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'NONE', label: 'Once (No repeat)', desc: 'Single session' },
                { id: 'DAILY', label: 'Daily', desc: 'Consecutive days' },
                { id: 'WEEKLY', label: 'Weekly', desc: 'Same day each week' },
                { id: 'BIWEEKLY', label: 'Bi-Weekly', desc: 'Every 2 weeks' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRecurrence(opt.id as RecurrencePattern)}
                  className={`p-2 rounded-xl text-left border transition-all ${
                    recurrence === opt.id
                      ? 'bg-blue-600/30 border-blue-500 text-white shadow-xs'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-semibold">{opt.label}</div>
                  <div className="text-[10px] text-slate-500">{opt.desc}</div>
                </button>
              ))}
            </div>

            {recurrence !== 'NONE' && (
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-medium">Number of occurrences:</span>
                  <input
                    type="number"
                    min={2}
                    max={26}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Math.max(2, Math.min(26, Number(e.target.value))))}
                    className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-slate-500">sessions</span>
                </div>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipBlackouts}
                    onChange={(e) => setSkipBlackouts(e.target.checked)}
                    className="rounded text-blue-500"
                  />
                  <span>Skip weekends & ship blackouts</span>
                </label>
              </div>
            )}

            {/* Recurrence Schedule Preview */}
            <div className="text-[11px] bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 text-slate-300 space-y-1 font-mono">
              <div className="flex items-center justify-between text-slate-400 font-sans">
                <span>Summary preview:</span>
                <span className="text-emerald-400 font-semibold">
                  {previewDates.length * (trackType === 'COMPANY_WIDE' ? 1 : selectedDepts.length)} total session(s)
                </span>
              </div>
              <div className="text-slate-300 text-[11px] truncate">
                Dates: {previewDates.slice(0, 6).join(', ')}{previewDates.length > 6 ? ` (+${previewDates.length - 6} more)` : ''}
              </div>
              <div className="text-slate-400 text-[10px] font-sans">
                Departments: {trackType === 'COMPANY_WIDE' ? 'Ship-Wide' : selectedDepts.join(', ')} · Time: {startTime} - {computedEndTime}
              </div>
            </div>
          </div>

          {/* Admin Override for Concurrent / Same-Time Lectures */}
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 text-xs">
            <label className="flex items-start gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={adminOverride}
                onChange={e => setAdminOverride(e.target.checked)}
                className="mt-0.5 rounded text-amber-500"
              />
              <div>
                <span className="font-semibold text-white">Admin Override: Allow concurrent lectures on same day & time slot</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Allows multiple departmental lectures or tracks to be scheduled concurrently at the same time. The caution warning badge will continue to be displayed on the matrix board for audit awareness.
                </p>
              </div>
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Schedule {previewDates.length * (trackType === 'COMPANY_WIDE' ? 1 : selectedDepts.length)} Session{previewDates.length * (trackType === 'COMPANY_WIDE' ? 1 : selectedDepts.length) > 1 ? 's' : ''}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
