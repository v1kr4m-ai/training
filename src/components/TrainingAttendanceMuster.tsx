/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ScheduledSession } from '../types';
import { usePortal } from '../portal/store';
import { onLeave, todayIso } from '../portal/leaveLogic';
import { addMinutes } from '../utils/time';
import { weekOfYear } from '../utils/scheduler';
import {
  UserCheck,
  CalendarPlus,
  CheckCircle2,
  Search,
  Download,
  Check
} from 'lucide-react';

interface TrainingAttendanceMusterProps {
  sessions: ScheduledSession[];
  canEdit: boolean;
  onUpdateSession: (updated: ScheduledSession) => void;
  onAddMakeUpSession: (newSession: ScheduledSession) => void;
}

type AbsentReason = 'ON_LEAVE' | 'WATCHKEEPING' | 'SPECIAL_PARTY' | 'SICK_BAY' | 'TY_DUTY' | 'UNEXCUSED';

interface PersonMusterRow {
  personId: string;
  status: 'PRESENT' | 'ABSENT';
  absentReason?: AbsentReason;
  makeUpRequired?: boolean;
  remarks?: string;
}

const ABSENT_REASON_LABELS: Record<AbsentReason, string> = {
  ON_LEAVE: 'On Approved Leave',
  WATCHKEEPING: 'Watchkeeping / Duty Roster',
  SPECIAL_PARTY: 'Excused (Special Party)',
  SICK_BAY: 'Sick Bay / Att C',
  TY_DUTY: 'Temporary Duty (TY)',
  UNEXCUSED: 'Unexcused / Defaulter'
};

export const TrainingAttendanceMuster: React.FC<TrainingAttendanceMusterProps> = ({
  sessions,
  canEdit,
  onUpdateSession,
  onAddMakeUpSession
}) => {
  const { db, ship, user } = usePortal();
  const today = todayIso();

  // Sort sessions chronologically
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [sessions]
  );

  const defaultSessionId = useMemo(() => {
    const todayOrNext = sortedSessions.find(s => s.date >= today) || sortedSessions[sortedSessions.length - 1];
    return todayOrNext?.id || '';
  }, [sortedSessions, today]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>(defaultSessionId);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'MAKEUP'>('ALL');
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [makeUpDate, setMakeUpDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [makeUpTime, setMakeUpTime] = useState('14:30');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sortedSessions.find(s => s.id === selectedSessionId) || sortedSessions[0] || null,
    [sortedSessions, selectedSessionId]
  );

  // Personnel expected to attend this session
  const targetPersonnel = useMemo(() => {
    const activeCrew = db.personnel.filter(p => p.active);
    if (!activeSession) return activeCrew;
    const dept = activeSession.department;
    if (!dept || dept === 'All / Ship-Wide') return activeCrew;
    return activeCrew.filter(p => p.department.toLowerCase() === dept.toLowerCase());
  }, [db.personnel, activeSession]);

  // Personnel on approved leave on the active session date
  const leavePersonIdsOnDate = useMemo(() => {
    if (!activeSession) return new Set<string>();
    return new Set(onLeave(db, activeSession.date).map(r => r.personId));
  }, [db, activeSession]);

  // Personnel in special parties that excuse from routine/watchbill
  const specialPartyMap = useMemo(() => {
    const map = new Map<string, string>();
    (db.specialParties || []).forEach(sp => {
      if (sp.excuseFromWatchbill) {
        sp.memberPersonIds.forEach(pid => {
          map.set(pid, sp.code || sp.name);
        });
      }
    });
    return map;
  }, [db.specialParties]);

  // Personnel on daily duty roster on the session date
  const dutyRosterPersonIdsOnDate = useMemo(() => {
    if (!activeSession) return new Set<string>();
    const rosterEntry = (db.dutyRosters || {})[activeSession.date];
    const ids = new Set<string>();
    if (rosterEntry) {
      [
        rosterEntry.officerOfTheDayId,
        rosterEntry.dutyEngineerOfficerId,
        rosterEntry.dutyElectricalOfficerId,
        rosterEntry.quartermasterId,
        rosterEntry.pettyOfficerOfTheDayId,
        rosterEntry.gangwaySentryId,
        rosterEntry.dutyGunneryInstructorId,
        rosterEntry.harbourFirePartyLeaderId
      ].forEach(id => {
        if (id) ids.add(id);
      });
    }
    return ids;
  }, [db.dutyRosters, activeSession]);

  // Build effective attendance records for the active session
  const attendanceMap = useMemo(() => {
    const map = new Map<string, PersonMusterRow>();
    if (!activeSession) return map;

    const savedMuster = activeSession.attendanceMuster;
    if (savedMuster) {
      (savedMuster.presentPersonIds || []).forEach(pid => {
        map.set(pid, {
          personId: pid,
          status: 'PRESENT',
          makeUpRequired: false,
          remarks: remarksMap[pid] || ''
        });
      });
      (savedMuster.absentRecords || []).forEach(rec => {
        map.set(rec.personId, {
          personId: rec.personId,
          status: 'ABSENT',
          absentReason: rec.reason,
          makeUpRequired: rec.makeUpRequired,
          remarks: remarksMap[rec.personId] || ''
        });
      });
    }

    // Auto-populate defaults for expected personnel not yet in savedMuster
    targetPersonnel.forEach(p => {
      if (!map.has(p.id)) {
        const isLeave = leavePersonIdsOnDate.has(p.id);
        const isOnDuty = dutyRosterPersonIdsOnDate.has(p.id);
        const spCode = specialPartyMap.get(p.id);

        if (isLeave) {
          map.set(p.id, {
            personId: p.id,
            status: 'ABSENT',
            absentReason: 'ON_LEAVE',
            makeUpRequired: true,
            remarks: remarksMap[p.id] || 'Auto-flagged: On Approved Leave'
          });
        } else if (isOnDuty) {
          map.set(p.id, {
            personId: p.id,
            status: 'ABSENT',
            absentReason: 'WATCHKEEPING',
            makeUpRequired: true,
            remarks: remarksMap[p.id] || 'Auto-flagged: On Ship Duty Roster'
          });
        } else if (spCode) {
          map.set(p.id, {
            personId: p.id,
            status: 'PRESENT',
            remarks: remarksMap[p.id] || `Special Party (${spCode})`
          });
        } else {
          map.set(p.id, {
            personId: p.id,
            status: 'PRESENT',
            makeUpRequired: false,
            remarks: remarksMap[p.id] || ''
          });
        }
      }
    });

    return map;
  }, [activeSession, targetPersonnel, leavePersonIdsOnDate, dutyRosterPersonIdsOnDate, specialPartyMap, remarksMap]);

  const buildMusterPayload = (rows: PersonMusterRow[]): NonNullable<ScheduledSession['attendanceMuster']> => {
    const presentPersonIds = rows.filter(r => r.status === 'PRESENT').map(r => r.personId);
    const absentRecords = rows
      .filter(r => r.status === 'ABSENT')
      .map(r => ({
        personId: r.personId,
        reason: r.absentReason || ('WATCHKEEPING' as AbsentReason),
        makeUpRequired: !!r.makeUpRequired
      }));

    return {
      recordedAt: new Date().toISOString(),
      recordedBy: user?.displayName || 'Officer of the Day / Instructor',
      presentPersonIds,
      absentRecords
    };
  };

  const updatePersonAttendance = (personId: string, patch: Partial<PersonMusterRow>) => {
    if (!activeSession || !canEdit) return;
    if (patch.remarks !== undefined) {
      setRemarksMap(prev => ({ ...prev, [personId]: patch.remarks || '' }));
    }

    const nextRows: PersonMusterRow[] = targetPersonnel.map(p => {
      const current = attendanceMap.get(p.id) || { personId: p.id, status: 'PRESENT' as const };
      if (p.id !== personId) return current;
      const updated: PersonMusterRow = { ...current, ...patch };
      if (updated.status === 'PRESENT') {
        updated.absentReason = undefined;
        updated.makeUpRequired = false;
      } else if (updated.status === 'ABSENT' && !updated.absentReason) {
        updated.absentReason = 'WATCHKEEPING';
        updated.makeUpRequired = true;
      }
      return updated;
    });

    onUpdateSession({
      ...activeSession,
      attendanceMuster: buildMusterPayload(nextRows)
    });
  };

  const handleCommitMusterAndComplete = () => {
    if (!activeSession || !canEdit) return;
    const nextRows: PersonMusterRow[] = targetPersonnel.map(p => {
      return attendanceMap.get(p.id) || { personId: p.id, status: 'PRESENT' };
    });

    onUpdateSession({
      ...activeSession,
      status: 'Completed',
      attendanceMuster: buildMusterPayload(nextRows)
    });

    setStatusBanner(
      `Muster roll committed & session marked Completed (${nextRows.filter(x => x.status === 'PRESENT').length} Present, ${nextRows.filter(x => x.status === 'ABSENT').length} Absent).`
    );
    setTimeout(() => setStatusBanner(null), 4500);
  };

  const handleScheduleMakeUpLecture = () => {
    if (!activeSession || !canEdit) return;
    const absenteesForMakeUp = Array.from(attendanceMap.values()).filter(
      a => a.status === 'ABSENT' && a.makeUpRequired
    );
    if (absenteesForMakeUp.length === 0) {
      setStatusBanner('No absentees flagged for mandatory make-up training in this session.');
      setTimeout(() => setStatusBanner(null), 3500);
      return;
    }

    const endTime = addMinutes(makeUpTime, activeSession.durationMinutes || 60) || '15:30';
    const mopUpSession: ScheduledSession = {
      ...activeSession,
      id: `MAKEUP-${Date.now().toString(36)}`,
      title: `[MAKE-UP] ${activeSession.title}`,
      date: makeUpDate,
      dayOfWeek: new Date(`${makeUpDate}T12:00:00`).getDay(),
      weekNumber: weekOfYear(makeUpDate),
      startTime: makeUpTime,
      endTime,
      status: 'Scheduled',
      isCustomLocked: true,
      isMakeUpSession: true,
      parentSessionId: activeSession.id,
      attendanceMuster: {
        recordedAt: new Date().toISOString(),
        recordedBy: user?.displayName || 'Gunnery / Training Office',
        presentPersonIds: absenteesForMakeUp.map(a => a.personId),
        absentRecords: []
      }
    };

    onAddMakeUpSession(mopUpSession);
    setStatusBanner(`Make-Up Lecture scheduled on ${makeUpDate} at ${makeUpTime} for ${absenteesForMakeUp.length} absentee(s).`);
    setTimeout(() => setStatusBanner(null), 4500);
  };

  const handleExportMusterExcel = () => {
    if (!activeSession) return;
    const rows = targetPersonnel.map((p, idx) => {
      const entry = attendanceMap.get(p.id);
      return {
        'Sr No': idx + 1,
        'Personal No': p.serviceNo,
        Rank: p.rank,
        Name: p.name,
        Department: p.department,
        Section: p.subDepartment || 'General',
        'Muster Status': entry?.status || 'PRESENT',
        'Absentee Reason': entry?.absentReason ? ABSENT_REASON_LABELS[entry.absentReason] : '—',
        'Make-Up Required': entry?.makeUpRequired ? 'YES' : 'NO',
        Remarks: entry?.remarks || ''
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Muster');
    XLSX.writeFile(wb, `${ship.name.replace(/\s+/g, '_')}_Muster_${activeSession.date}_${activeSession.topicId}.xlsx`);
  };

  // Filtered list for display
  const filteredPersonnel = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return targetPersonnel.filter(p => {
      const entry = attendanceMap.get(p.id);
      if (filterMode === 'PRESENT' && entry?.status !== 'PRESENT') return false;
      if (filterMode === 'ABSENT' && entry?.status !== 'ABSENT') return false;
      if (filterMode === 'MAKEUP' && !entry?.makeUpRequired) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.rank.toLowerCase().includes(q) ||
        p.serviceNo.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q)
      );
    });
  }, [targetPersonnel, attendanceMap, filterMode, searchTerm]);

  // Summary counts for active session
  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let makeUp = 0;
    targetPersonnel.forEach(p => {
      const e = attendanceMap.get(p.id);
      if (e?.status === 'ABSENT') {
        absent++;
        if (e.makeUpRequired) makeUp++;
      } else {
        present++;
      }
    });
    return { total: targetPersonnel.length, present, absent, makeUp };
  }, [targetPersonnel, attendanceMap]);

  // Ship-wide pending make-up summary across all sessions
  const shipWideMakeUpBacklog = useMemo(() => {
    const items: Array<{ session: ScheduledSession; personId: string; reason?: string }> = [];
    sessions.forEach(s => {
      if (s.isMakeUpSession) return;
      (s.attendanceMuster?.absentRecords || []).forEach(rec => {
        if (rec.makeUpRequired) {
          items.push({ session: s, personId: rec.personId, reason: rec.reason });
        }
      });
    });
    return items;
  }, [sessions]);

  if (sortedSessions.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
        No training sessions are scheduled yet. Schedule or import topics first to record attendance musters.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Session Picker */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Training Attendance Muster, Absentees & Make-Up Lectures</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Auto-syncs with Nominal Roll, Approved Leave, Daily Duty Roster, and Special Parties. Flag absentees for mandatory Mop-Up classes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportMusterExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Muster (.xlsx)</span>
            </button>

            {canEdit && (
              <button
                onClick={handleCommitMusterAndComplete}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white whitespace-nowrap shrink-0 transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Commit Muster & Mark Completed</span>
              </button>
            )}
          </div>
        </div>

        {statusBanner && (
          <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-700/70 text-emerald-200 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusBanner}</span>
          </div>
        )}

        {/* Session selector & KPI strip */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-2 border-t border-slate-800/80">
          <div className="lg:col-span-6">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Training Lecture / Evolution
            </label>
            <select
              value={activeSession?.id || ''}
              onChange={e => setSelectedSessionId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-medium"
            >
              {sortedSessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.date} ({s.startTime}) · [{s.department}] {s.title} — {s.status}
                  {s.isMakeUpSession ? ' ★ MAKE-UP' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-6 grid grid-cols-4 gap-2 text-center">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Expected</div>
              <div className="text-lg font-extrabold font-mono tabular-nums text-white mt-0.5">{counts.total}</div>
            </div>
            <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">Present</div>
              <div className="text-lg font-extrabold font-mono tabular-nums text-emerald-400 mt-0.5">{counts.present}</div>
            </div>
            <div className="bg-rose-950/30 border border-rose-800/50 rounded-xl p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-rose-300 font-semibold">Absent</div>
              <div className="text-lg font-extrabold font-mono tabular-nums text-rose-400 mt-0.5">{counts.absent}</div>
            </div>
            <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">Make-Up Due</div>
              <div className="text-lg font-extrabold font-mono tabular-nums text-amber-400 mt-0.5">{counts.makeUp}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Make-Up Lecture Scheduler Bar */}
      {canEdit && counts.makeUp > 0 && (
        <div className="bg-amber-950/25 border border-amber-800/60 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-amber-200 flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {counts.makeUp} Personnel Require a Make-Up Lecture for "{activeSession?.title}"
              </span>
            </div>
            <p className="text-[11px] text-amber-300/80">
              Schedule a dedicated mop-up training slot so watchkeepers and personnel returning from leave complete this syllabus topic.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              type="date"
              value={makeUpDate}
              onChange={e => setMakeUpDate(e.target.value)}
              className="bg-slate-950 border border-amber-700/60 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
              aria-label="Make-up date"
            />
            <input
              type="time"
              value={makeUpTime}
              onChange={e => setMakeUpTime(e.target.value)}
              className="bg-slate-950 border border-amber-700/60 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
              aria-label="Make-up time"
            />
            <button
              onClick={handleScheduleMakeUpLecture}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 whitespace-nowrap shrink-0 transition-colors shadow-sm"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>Schedule Make-Up Lecture</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Controls + Muster Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filter muster by name, rank, personal number, or branch…"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {(['ALL', 'PRESENT', 'ABSENT', 'MAKEUP'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  filterMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'ALL'
                  ? `All (${counts.total})`
                  : mode === 'PRESENT'
                    ? `Present (${counts.present})`
                    : mode === 'ABSENT'
                      ? `Absent (${counts.absent})`
                      : `Make-Up (${counts.makeUp})`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/90 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Personal No · Rank & Name</th>
                <th className="px-3">Department / Section</th>
                <th className="px-3">Auto-Clash Check</th>
                <th className="px-3">Attendance Status</th>
                <th className="px-3">Absentee Reason</th>
                <th className="px-3 text-center">Make-Up Req</th>
                <th className="px-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredPersonnel.map(p => {
                const entry = attendanceMap.get(p.id) || { personId: p.id, status: 'PRESENT' as const };
                const isLeave = leavePersonIdsOnDate.has(p.id);
                const isDuty = dutyRosterPersonIdsOnDate.has(p.id);
                const spCode = specialPartyMap.get(p.id);

                return (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-white">
                        {p.rank} {p.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {p.serviceNo} · {p.category}
                      </div>
                    </td>
                    <td className="px-3 text-slate-300">
                      <div>{p.department}</div>
                      <div className="text-[10px] text-slate-500">{p.subDepartment || 'General'}</div>
                    </td>
                    <td className="px-3 text-[11px]">
                      {isLeave ? (
                        <span className="text-amber-300 font-medium">On Leave ({activeSession?.date})</span>
                      ) : isDuty ? (
                        <span className="text-blue-300 font-medium">Duty Roster Watchkeeper</span>
                      ) : spCode ? (
                        <span className="text-purple-300 font-medium">Special Party ({spCode})</span>
                      ) : (
                        <span className="text-slate-500">Available on board</span>
                      )}
                    </td>
                    <td className="px-3">
                      <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => updatePersonAttendance(p.id, { status: 'PRESENT' })}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            entry.status === 'PRESENT'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => updatePersonAttendance(p.id, { status: 'ABSENT', makeUpRequired: true })}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            entry.status === 'ABSENT'
                              ? 'bg-rose-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Absent
                        </button>
                      </div>
                    </td>
                    <td className="px-3">
                      {entry.status === 'ABSENT' ? (
                        <select
                          disabled={!canEdit}
                          value={entry.absentReason || 'WATCHKEEPING'}
                          onChange={e =>
                            updatePersonAttendance(p.id, {
                              absentReason: e.target.value as AbsentReason
                            })
                          }
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                        >
                          {Object.entries(ABSENT_REASON_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-3 text-center">
                      {entry.status === 'ABSENT' ? (
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={!!entry.makeUpRequired}
                          onChange={e => updatePersonAttendance(p.id, { makeUpRequired: e.target.checked })}
                          className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          aria-label="Make-up lecture required"
                        />
                      ) : (
                        <span className="text-slate-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={entry.remarks || ''}
                        placeholder="Optional note…"
                        onChange={e => updatePersonAttendance(p.id, { remarks: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ship-wide Pending Make-Up Training Register */}
      {shipWideMakeUpBacklog.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Ship-Wide Pending Make-Up Training Register ({shipWideMakeUpBacklog.length} entries)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {shipWideMakeUpBacklog.slice(0, 12).map((item, idx) => {
              const p = db.personnel.find(x => x.id === item.personId);
              return (
                <div
                  key={`${item.session.id}-${item.personId}-${idx}`}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {p ? `${p.rank} ${p.name}` : item.personId}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {item.session.date} · {item.session.title}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSessionId(item.session.id)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-semibold whitespace-nowrap shrink-0"
                  >
                    Open Session
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
