/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { usePortal } from '../store';
import { trainingKey } from '../registry';
import { ScheduledSession } from '../../types';
import { formatDate } from '../../utils/scheduler';
import { btnDanger, btnGhost, btnPrimary, Card, Empty, Field, inputCls, PageHeader } from '../ui';
import type { PublishedDailyOrder } from '../types';
import { WatchAndStationBillManager } from './WatchAndStationBillManager';
import {
  FileText,
  Printer,
  Copy,
  Check,
  Send,
  Shield,
  Radio,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Award,
  Anchor,
  RefreshCw
} from 'lucide-react';
import { newId } from '../db';

const ROUTINE_PRESETS = [
  { time: '05:30', evolution: 'Hands Call & Airing of Bedding', remarks: 'Duty PO & QM' },
  { time: '06:00', evolution: 'Physical Training / Morning Parade', remarks: 'Quarterdeck / All Hands' },
  { time: '07:00', evolution: 'Both Watches Fall In for Clean Ship', remarks: 'All Departments' },
  { time: '08:00', evolution: 'Colours & Ceremonial Muster', remarks: 'Ensign Hoisted' },
  { time: '09:00', evolution: 'Instructional Period 1 (Classroom & On-Job)', remarks: 'As per Training Schedule' },
  { time: '10:30', evolution: 'Stand Easy / Refreshments', remarks: 'Galley & Mess Decks' },
  { time: '11:00', evolution: 'Instructional Period 2 & Practical Evolutions', remarks: 'Specialist Stations' },
  { time: '12:30', evolution: 'Dinner & Pipe Down for Non-Duty Watch', remarks: 'Mess Decks' },
  { time: '14:00', evolution: 'Specialist Maintenance & Drills', remarks: 'Technical Branches' },
  { time: '16:30', evolution: 'Evening Quarters / Mustering of Watches', remarks: 'Quarterdeck' },
  { time: '18:15', evolution: 'Sunset Ceremony', remarks: 'Duty Section' },
  { time: '21:00', evolution: 'Executive Officer Rounds', remarks: 'OOD & POOD in Attendance' },
  { time: '22:30', evolution: 'Pipe Down & Silence on Mess Decks', remarks: 'Quiet Hours' }
];

export const DailyOrdersPage: React.FC = () => {
  const { db, ship, shipId, user, update } = usePortal();

  // Tomorrow calculation (default for Daily Orders)
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  }, []);

  const todayStr = useMemo(() => formatDate(new Date()), []);

  const [activeTab, setActiveTab] = useState<'GENERATOR' | 'WATCHBILL' | 'NOTICE_BOARD'>('GENERATOR');
  const [targetDate, setTargetDate] = useState<string>(tomorrowStr);
  const [routineState, setRoutineState] = useState<string>('Harbour Routine - Berth No. 4, Naval Dockyard');
  const [serialNo, setSerialNo] = useState<string>(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return `DO/GUNNERY/${new Date().getFullYear()}/${String(dayOfYear + 1).padStart(3, '0')}`;
  });

  // Load training sessions for the ship
  const allTrainingSessions = useMemo<ScheduledSession[]>(() => {
    try {
      const raw = localStorage.getItem(trainingKey(shipId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    } catch {
      return [];
    }
  }, [shipId]);

  // Filter sessions matching target date
  const sessionsOnTargetDate = useMemo(() => {
    return allTrainingSessions
      .filter(s => s.date === targetDate && s.status !== 'Cancelled')
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [allTrainingSessions, targetDate]);

  // Checkbox selection for training sessions to include
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

  // Auto-select all sessions when target date changes
  useEffect(() => {
    setSelectedSessionIds(new Set(sessionsOnTargetDate.map(s => s.id)));
  }, [sessionsOnTargetDate]);

  // Routine timeline state
  const [routines, setRoutines] = useState(ROUTINE_PRESETS);
  const [customEvolutionTime, setCustomEvolutionTime] = useState('09:30');
  const [customEvolutionText, setCustomEvolutionText] = useState('');
  const [customEvolutionRemarks, setCustomEvolutionRemarks] = useState('Gunnery / Routine Office');

  // Custom Additional Fields for Daily Order fixed template
  const [customFields, setCustomFields] = useState<Array<{ id: string; label: string; value: string }>>([
    { id: 'cf-1', label: 'Liberty & Shore Leave Timings', value: 'Starboard Watch: 1700h to 2230h (Cinderella Liberty for Junior Sailors)' },
    { id: 'cf-2', label: 'Galley & Ration Issue Timings', value: 'Dry Provisions Issue at 1030h · Fresh Rations Muster at 0715h' },
    { id: 'cf-3', label: 'Ammunition & Magazine Temperature Log', value: 'Gunnery Yeoman to log magazine temperatures at 0800h & 1600h' }
  ]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  // Duty Roster state
  const officers = useMemo(() => db.personnel.filter(p => p.active && p.category === 'Officer'), [db.personnel]);
  const sailors = useMemo(() => db.personnel.filter(p => p.active && p.category === 'Sailor'), [db.personnel]);

  const [duties, setDuties] = useState({
    officerOfTheDay: officers[0] ? `${officers[0].rank} ${officers[0].name}` : 'Lt Cdr Vikram Singh',
    dutyEngineerOfficer: officers[1] ? `${officers[1].rank} ${officers[1].name}` : 'Lt Rahul Verma',
    dutyMedicalOfficer: 'Surgeon Lt K Sharma',
    quartermaster: sailors[0] ? `${sailors[0].rank} ${sailors[0].name}` : 'PO(RP) Anil Kumar',
    pettyOfficerOfTheDay: sailors[1] ? `${sailors[1].rank} ${sailors[1].name}` : 'PO(UW) Sunil Yadav',
    dutyGunneryInstructor: 'Chief Gunnery Instructor (GI)'
  });

  // Pull duties from Watch & Station Bill / Duty Roster for targetDate
  const handlePullDutiesFromRoster = () => {
    const roster = db.dutyRosters?.[targetDate];
    if (!roster) return;
    const findName = (id: string, fallback: string) => {
      const p = db.personnel.find(x => x.id === id);
      return p ? `${p.rank} ${p.name}` : fallback;
    };
    setDuties(prev => ({
      ...prev,
      officerOfTheDay: findName(roster.officerOfTheDayId, prev.officerOfTheDay),
      dutyEngineerOfficer: findName(roster.dutyEngineerOfficerId, prev.dutyEngineerOfficer),
      quartermaster: findName(roster.quartermasterId, prev.quartermaster),
      pettyOfficerOfTheDay: findName(roster.pettyOfficerOfTheDayId, prev.pettyOfficerOfTheDay),
      dutyGunneryInstructor: findName(roster.dutyGunneryInstructorId, prev.dutyGunneryInstructor)
    }));
  };

  const [dressOfTheDay, setDressOfTheDay] = useState('No. 10s (Working Dress) / Overalls for Technical & Firing Evolutions / Peak Caps for OOD & Gangway Staff');
  const [specialDirectives, setSpecialDirectives] = useState(
    '1. All personnel detailed for weapons drills are to muster at 0845h on the Quarterdeck.\n' +
    '2. Zero tolerance for uninsulated cables in living compartments; electrical inspection at 1130h.\n' +
    '3. Shore leave for Starboard Watch commences at 1700h. Clear gangway by 2200h.'
  );

  const [publishSuccess, setPublishSuccess] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Toggle session selection
  const toggleSession = (id: string) => {
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllSessions = () => setSelectedSessionIds(new Set(sessionsOnTargetDate.map(s => s.id)));
  const deselectAllSessions = () => setSelectedSessionIds(new Set());

  // Add custom routine evolution
  const handleAddEvolution = () => {
    if (!customEvolutionText.trim()) return;
    setRoutines(prev => [
      ...prev,
      { time: customEvolutionTime, evolution: customEvolutionText.trim(), remarks: customEvolutionRemarks.trim() || 'Routine Office' }
    ].sort((a, b) => a.time.localeCompare(b.time)));
    setCustomEvolutionText('');
  };

  const handleDeleteEvolution = (idx: number) => {
    setRoutines(prev => prev.filter((_, i) => i !== idx));
  };

  // Add custom template field
  const handleAddCustomField = () => {
    if (!newFieldLabel.trim() || !newFieldValue.trim()) return;
    setCustomFields(prev => [
      ...prev,
      { id: newId(), label: newFieldLabel.trim(), value: newFieldValue.trim() }
    ]);
    setNewFieldLabel('');
    setNewFieldValue('');
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const handleUpdateCustomField = (id: string, value: string) => {
    setCustomFields(prev => prev.map(f => (f.id === id ? { ...f, value } : f)));
  };

  // Selected training sessions array
  const includedSessions = useMemo(() => {
    return sessionsOnTargetDate.filter(s => selectedSessionIds.has(s.id));
  }, [sessionsOnTargetDate, selectedSessionIds]);

  // Publish to Digital Notice Board
  const handlePublishOrder = () => {
    const publishedOrder: PublishedDailyOrder = {
      id: newId(),
      serialNo,
      orderDate: targetDate,
      publishedAt: new Date().toISOString(),
      publishedBy: user ? `${user.displayName} (Gunnery / Routine Office)` : 'Gunnery Officer',
      shipName: ship.name,
      pennant: ship.pennant,
      routineState,
      routines,
      selectedSessionIds: Array.from(selectedSessionIds),
      trainingSessions: includedSessions.map(s => ({
        id: s.id,
        sequenceNumber: s.sequenceNumber,
        title: s.title,
        speaker: s.speaker,
        startTime: s.startTime,
        endTime: s.endTime,
        department: s.department,
        location: s.location,
        trackType: s.trackType
      })),
      duties,
      customFields,
      dressOfTheDay,
      specialDirectives,
      noticeBoardStatus: 'ACTIVE'
    };

    const notif = {
      id: `notif-${Date.now()}`,
      createdAt: new Date().toISOString(),
      title: `Daily Orders Published: Part I (${targetDate})`,
      message: `Daily Orders Part I for ${targetDate} published by Gunnery / Routine Office. Routine, Duty Officers, and Training Matrix active on digital notice board.`,
      link: 'daily-orders',
      read: false,
      type: 'DAILY_ORDER_PUBLISHED' as const,
      fromName: 'Gunnery / Routine Office'
    };

    update(d => {
      const prevOrders = (d.dailyOrders || []).map(o => o.orderDate === targetDate ? { ...o, noticeBoardStatus: 'ARCHIVED' as const } : o);
      return {
        ...d,
        dailyOrders: [publishedOrder, ...prevOrders],
        notifications: [...(d.notifications || []), notif]
      };
    });

    setPublishSuccess(true);
    setTimeout(() => {
      setPublishSuccess(false);
      setActiveTab('NOTICE_BOARD');
    }, 1500);
  };

  // Copy structured naval text block
  const handleCopyFormattedText = () => {
    const text = [
      `================================================================================`,
      `INDIAN NAVAL SHIP ${ship.name.toUpperCase()} (${ship.pennant})`,
      `EXECUTIVE DEPARTMENT · GUNNERY & ROUTINE OFFICE`,
      `DAILY ORDERS PART I · SERIAL NO: ${serialNo}`,
      `DATE: ${targetDate} | STATE: ${routineState}`,
      `================================================================================`,
      ``,
      `SECTION 1: ROUTINES & PIPES`,
      `--------------------------------------------------------------------------------`,
      ...routines.map(r => `${r.time}h : ${r.evolution.padEnd(45)} [${r.remarks || 'General'}]`),
      ``,
      `SECTION 2: GUNNERY & SHIPBOARD TRAINING PROGRAMME`,
      `--------------------------------------------------------------------------------`,
      `TIME          | DEPT          | VENUE            | INSTRUCTOR      | SUBJECT`,
      `--------------------------------------------------------------------------------`,
      ...(includedSessions.length > 0
        ? includedSessions.map((s, idx) => {
            const time = `${s.startTime || '09:00'} - ${s.endTime || '10:00'}`.padEnd(13);
            const dept = (s.department || 'All').padEnd(13);
            const loc = (s.location || 'Flat').slice(0, 16).padEnd(16);
            const ins = (s.speaker || 'Duty Officer').slice(0, 15).padEnd(15);
            return `${time} | ${dept} | ${loc} | ${ins} | ${idx + 1}. ${s.title}`;
          })
        : [`NO CLASSROOM SESSIONS SELECTED. ROUTINE HARBOUR TRAINING & WATCHKEEPING.`]
      ),
      `--------------------------------------------------------------------------------`,
      ``,
      `SECTION 3: DUTY WATCHKEEPERS & SPECIALIST ROSTER`,
      `--------------------------------------------------------------------------------`,
      `Officer of the Day (OOD)        : ${duties.officerOfTheDay}`,
      `Duty Engineer Officer (DEO)     : ${duties.dutyEngineerOfficer}`,
      `Duty Medical Officer (DMO)      : ${duties.dutyMedicalOfficer}`,
      `Quartermaster of the Day        : ${duties.quartermaster}`,
      `Petty Officer of the Day (POOD) : ${duties.pettyOfficerOfTheDay}`,
      `Duty Gunnery Instructor (GI)    : ${duties.dutyGunneryInstructor}`,
      ...(customFields.length > 0
        ? [
            ``,
            `SECTION 4: ADDITIONAL ROUTINE OFFICE ORDERS & FIELDS`,
            `--------------------------------------------------------------------------------`,
            ...customFields.map(f => `${f.label.padEnd(32)}: ${f.value}`)
          ]
        : []),
      ``,
      `SECTION 5: DRESS OF THE DAY`,
      `--------------------------------------------------------------------------------`,
      `${dressOfTheDay}`,
      ``,
      `SECTION 6: SPECIAL DIRECTIVES & SAFETY DIRECTIVES`,
      `--------------------------------------------------------------------------------`,
      `${specialDirectives}`,
      ``,
      `================================================================================`,
      `PUBLISHED BY AUTHORITY OF THE COMMANDING OFFICER`,
      `GUNNERY & ROUTINE OFFICE · ${ship.name}`,
      `================================================================================`
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  // Published daily orders list
  const publishedOrders = useMemo(() => {
    return (db.dailyOrders || []).sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.publishedAt.localeCompare(a.publishedAt));
  }, [db.dailyOrders]);

  const [selectedNoticeOrder, setSelectedNoticeOrder] = useState<PublishedDailyOrder | null>(null);

  useEffect(() => {
    if (publishedOrders.length > 0 && !selectedNoticeOrder) {
      setSelectedNoticeOrder(publishedOrders[0]);
    }
  }, [publishedOrders, selectedNoticeOrder]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Gunnery & Routine Office"
        subtitle="Executive Department · Daily Orders Fixed Template, Custom Orders, Watch & Station Bill, and Digital Notice Board"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('GENERATOR')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'GENERATOR'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Daily Orders Template</span>
            </button>

            <button
              onClick={() => setActiveTab('WATCHBILL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'WATCHBILL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Anchor className="w-3.5 h-3.5 text-amber-400" />
              <span>Watch & Station Bill & Rosters</span>
            </button>

            <button
              onClick={() => setActiveTab('NOTICE_BOARD')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'NOTICE_BOARD'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>Digital Notice Board ({publishedOrders.length})</span>
            </button>
          </div>
        }
      />

      {/* TAB 2: WATCH & STATION BILL & DUTY ROSTER */}
      {activeTab === 'WATCHBILL' && <WatchAndStationBillManager />}

      {/* TAB 1: DAILY ORDERS GENERATOR & CUSTOM FIELDS */}
      {activeTab === 'GENERATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Target Date & Header Card */}
            <Card title="Daily Order Template Parameters">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetDate(tomorrowStr)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      targetDate === tomorrowStr ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Tomorrow ({tomorrowStr})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetDate(todayStr)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      targetDate === todayStr ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Today ({todayStr})
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Order Target Date">
                    <input
                      type="date"
                      className={inputCls}
                      value={targetDate}
                      onChange={e => setTargetDate(e.target.value)}
                    />
                  </Field>

                  <Field label="Daily Order Serial No.">
                    <input
                      type="text"
                      className={`${inputCls} font-mono`}
                      value={serialNo}
                      onChange={e => setSerialNo(e.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Ship State & Berth / Anchorage">
                  <input
                    type="text"
                    className={inputCls}
                    value={routineState}
                    onChange={e => setRoutineState(e.target.value)}
                  />
                </Field>
              </div>
            </Card>

            {/* Routine Evolutions Editor */}
            <Card title="Section 1: Routine Pipes & Evolutions">
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="time"
                    value={customEvolutionTime}
                    onChange={e => setCustomEvolutionTime(e.target.value)}
                    className={`${inputCls} col-span-3 font-mono text-xs`}
                  />
                  <input
                    type="text"
                    placeholder="Add evolution (e.g. Small Arms Firing)"
                    value={customEvolutionText}
                    onChange={e => setCustomEvolutionText(e.target.value)}
                    className={`${inputCls} col-span-6 text-xs`}
                  />
                  <button
                    type="button"
                    onClick={handleAddEvolution}
                    className="col-span-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                <div className="max-h-44 overflow-y-auto divide-y divide-slate-800/60 pr-1 text-xs">
                  {routines.map((r, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-blue-300 mr-2">{r.time}h</span>
                        <span className="text-slate-200">{r.evolution}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvolution(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Remove pipe"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Select Training Sessions for Tomorrow */}
            <Card
              title={`Section 2: Training Sessions (${includedSessions.length} of ${sessionsOnTargetDate.length})`}
              actions={
                <div className="flex items-center gap-2">
                  <button type="button" onClick={selectAllSessions} className="text-[11px] text-blue-400 hover:underline">All</button>
                  <span className="text-slate-600">·</span>
                  <button type="button" onClick={deselectAllSessions} className="text-[11px] text-slate-400 hover:underline">None</button>
                </div>
              }
            >
              {sessionsOnTargetDate.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-2">
                  <p>No classroom training sessions scheduled for {targetDate} in the matrix.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {sessionsOnTargetDate.map(s => {
                    const isSelected = selectedSessionIds.has(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleSession(s.id)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-blue-950/40 border-blue-600/70 text-slate-100'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold truncate text-white">{s.title}</span>
                            <span className="font-mono text-[11px] text-blue-300 shrink-0">{s.startTime} – {s.endTime}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {s.department} · {s.speaker || 'Duty Lead'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Duty Watchkeepers */}
            <Card
              title="Section 3: Duty Personnel & Specialists Roster"
              actions={
                db.dutyRosters?.[targetDate] ? (
                  <button
                    type="button"
                    onClick={handlePullDutiesFromRoster}
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Pull from Duty Roster</span>
                  </button>
                ) : undefined
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Officer of the Day (OOD)">
                    <input
                      type="text"
                      className={inputCls}
                      value={duties.officerOfTheDay}
                      onChange={e => setDuties({ ...duties, officerOfTheDay: e.target.value })}
                    />
                  </Field>

                  <Field label="Duty Engineer Officer (DEO)">
                    <input
                      type="text"
                      className={inputCls}
                      value={duties.dutyEngineerOfficer}
                      onChange={e => setDuties({ ...duties, dutyEngineerOfficer: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quartermaster (QM)">
                    <input
                      type="text"
                      className={inputCls}
                      value={duties.quartermaster}
                      onChange={e => setDuties({ ...duties, quartermaster: e.target.value })}
                    />
                  </Field>

                  <Field label="Petty Officer of the Day (POOD)">
                    <input
                      type="text"
                      className={inputCls}
                      value={duties.pettyOfficerOfTheDay}
                      onChange={e => setDuties({ ...duties, pettyOfficerOfTheDay: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Duty Gunnery Instructor (GI)">
                    <input
                      type="text"
                      className={inputCls}
                      value={duties.dutyGunneryInstructor}
                      onChange={e => setDuties({ ...duties, dutyGunneryInstructor: e.target.value })}
                    />
                  </Field>

                  <Field label="Duty Medical Officer (DMO)">
                    <input
                      type="text"
                      className={inputCls}
                      value={duties.dutyMedicalOfficer}
                      onChange={e => setDuties({ ...duties, dutyMedicalOfficer: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </Card>

            {/* Custom Additional Daily Order Fields (Gunnery / Routine Office) */}
            <Card title="Section 4: Custom Routine Office Fields (Add More Fields)">
              <div className="space-y-3">
                <p className="text-[11px] text-slate-400">
                  Add custom sections or administrative rows to the fixed Daily Orders template (e.g., Boat Routine, Liberty Timings, Magazine Rounds, Fuel/Water State).
                </p>

                {customFields.map(field => (
                  <div key={field.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-300">{field.label}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(field.id)}
                        className="text-slate-500 hover:text-rose-400 p-0.5"
                        title="Remove custom field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={field.value}
                      onChange={e => handleUpdateCustomField(field.id, e.target.value)}
                      className={`${inputCls} text-xs`}
                    />
                  </div>
                ))}

                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <input
                    type="text"
                    placeholder="New Field Heading (e.g. Duty Boat & Coxswain)"
                    value={newFieldLabel}
                    onChange={e => setNewFieldLabel(e.target.value)}
                    className={`${inputCls} text-xs`}
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Field Value / Order Details"
                      value={newFieldValue}
                      onChange={e => setNewFieldValue(e.target.value)}
                      className={`${inputCls} text-xs flex-1`}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Field</span>
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Dress of the Day & Directives */}
            <Card title="Section 5 & 6: Dress of the Day & Directives">
              <div className="space-y-3">
                <Field label="Dress of the Day">
                  <input
                    type="text"
                    className={inputCls}
                    value={dressOfTheDay}
                    onChange={e => setDressOfTheDay(e.target.value)}
                  />
                </Field>

                <Field label="Gunnery / Routine Office Special Directives">
                  <textarea
                    rows={3}
                    className={inputCls}
                    value={specialDirectives}
                    onChange={e => setSpecialDirectives(e.target.value)}
                  />
                </Field>
              </div>
            </Card>
          </div>

          {/* Live Structured Naval Preview & Action Column */}
          <div className="lg:col-span-7 space-y-4 sticky top-6">
            {/* Publish & Action Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Daily Orders Part I — Fixed Naval Template Preview
                </h4>
                <p className="text-[11px] text-slate-500">
                  Prepared by Gunnery / Routine Office · Ready to publish to Notice Board
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyFormattedText}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText ? 'Copied Text' : 'Copy Text'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>

                <button
                  type="button"
                  onClick={handlePublishOrder}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  {publishSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Published!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Publish to Notice Board</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Naval Structured Document Preview */}
            <div className="bg-[#0b0e14] border-2 border-slate-700 rounded-2xl p-6 sm:p-8 font-mono text-xs text-slate-200 shadow-xl space-y-6 relative overflow-hidden">
              <div className="text-center pb-4 border-b-2 border-slate-800 space-y-1">
                <div className="text-[10px] tracking-widest text-slate-400 font-bold">
                  RESTRICTED · FOR SHIPBOARD USE ONLY
                </div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                  INDIAN NAVAL SHIP {ship.name.toUpperCase()} ({ship.pennant})
                </h2>
                <div className="text-xs text-blue-400 font-bold tracking-wider">
                  EXECUTIVE DEPARTMENT · GUNNERY & ROUTINE OFFICE
                </div>
                <div className="text-sm font-bold text-amber-300 pt-1">
                  DAILY ORDERS PART I · SERIAL NO: {serialNo}
                </div>
                <div className="text-[11px] text-slate-400">
                  DATE: <strong className="text-white">{targetDate}</strong> | ROUTINE: <strong className="text-white">{routineState}</strong>
                </div>
              </div>

              {/* Section 1: Routines */}
              <div className="space-y-2">
                <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1 flex items-center justify-between">
                  <span>SECTION 1: ROUTINE & EVOLUTIONS</span>
                  <span className="text-[10px] text-slate-500 font-normal">Timings strictly observed</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  {routines.map((r, i) => (
                    <div key={i} className="flex items-baseline justify-between py-0.5 border-b border-slate-900/60">
                      <span className="w-16 font-bold text-blue-300 shrink-0 tabular-nums">{r.time}h</span>
                      <span className="flex-1 text-slate-200">{r.evolution}</span>
                      <span className="text-slate-500 text-[10px] shrink-0 text-right">{r.remarks}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Training Programme Table */}
              <div className="space-y-2">
                <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1 flex items-center justify-between">
                  <span>SECTION 2: SHIPBOARD TRAINING PROGRAMME</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {includedSessions.length} session{includedSessions.length === 1 ? '' : 's'} detailed
                  </span>
                </div>

                {includedSessions.length === 0 ? (
                  <div className="py-2 text-slate-500 text-center text-[11px] italic">
                    NO CLASSROOM LECTURES SELECTED. SHIPBOARD ROUTINE & DRILLS APPLY.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border border-slate-800">
                      <thead className="bg-slate-900 text-slate-400">
                        <tr>
                          <th className="p-2 border-r border-slate-800">TIME</th>
                          <th className="p-2 border-r border-slate-800">BRANCH</th>
                          <th className="p-2 border-r border-slate-800">VENUE</th>
                          <th className="p-2 border-r border-slate-800">INSTRUCTOR</th>
                          <th className="p-2">CURRICULUM LESSON</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {includedSessions.map(s => (
                          <tr key={s.id} className="hover:bg-slate-900/50">
                            <td className="p-2 font-bold text-blue-300 whitespace-nowrap border-r border-slate-800 tabular-nums">
                              {s.startTime} – {s.endTime}
                            </td>
                            <td className="p-2 border-r border-slate-800 text-slate-300">{s.department}</td>
                            <td className="p-2 border-r border-slate-800 text-slate-300">{s.location || 'Flat'}</td>
                            <td className="p-2 border-r border-slate-800 text-slate-200">{s.speaker || 'Duty Officer'}</td>
                            <td className="p-2 text-white font-semibold">{s.title}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 3: Duties */}
              <div className="space-y-2">
                <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">
                  SECTION 3: DUTY WATCHKEEPERS & SPECIALIST ROSTER
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                  <div>Officer of the Day (OOD): <strong className="text-white">{duties.officerOfTheDay}</strong></div>
                  <div>Duty Engineer Officer (DEO): <strong className="text-white">{duties.dutyEngineerOfficer}</strong></div>
                  <div>Quartermaster of the Day: <strong className="text-white">{duties.quartermaster}</strong></div>
                  <div>Petty Officer of the Day: <strong className="text-white">{duties.pettyOfficerOfTheDay}</strong></div>
                  <div>Duty Gunnery Instructor: <strong className="text-white">{duties.dutyGunneryInstructor}</strong></div>
                  <div>Duty Medical Officer: <strong className="text-white">{duties.dutyMedicalOfficer}</strong></div>
                </div>
              </div>

              {/* Section 4: Custom Routine Office Fields */}
              {customFields.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">
                    SECTION 4: ROUTINE OFFICE ORDERS & SUPPLEMENTARY DETAILS
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    {customFields.map(f => (
                      <div key={f.id} className="flex flex-col sm:flex-row sm:items-baseline justify-between py-0.5 border-b border-slate-900/60 gap-1">
                        <span className="font-bold text-blue-300 sm:w-56 shrink-0">{f.label}:</span>
                        <span className="text-slate-200 flex-1">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 5 & 6 */}
              <div className="space-y-2">
                <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">
                  SECTION 5: DRESS OF THE DAY
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{dressOfTheDay}</p>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">
                  SECTION 6: GUNNERY / ROUTINE OFFICE SPECIAL DIRECTIVES
                </div>
                <p className="text-[11px] text-slate-300 whitespace-pre-line leading-relaxed">{specialDirectives}</p>
              </div>

              {/* Footer Signature */}
              <div className="pt-6 border-t-2 border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <div>
                  <div>Authority: Commanding Officer, {ship.name}</div>
                  <div className="text-[10px] text-slate-500">Gunnery / Routine Office Record</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-white">(Vikram Singh)</div>
                  <div>Lieutenant Commander</div>
                  <div className="text-[10px] text-blue-400 font-bold">Gunnery Officer / Executive Officer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DIGITAL NOTICE BOARD */}
      {activeTab === 'NOTICE_BOARD' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Ship's Digital Notice Board</span>
              </h3>
              <p className="text-xs text-slate-400">
                Live official notices and daily orders published by the Executive and Gunnery / Routine Office.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('GENERATOR')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Generate New Daily Order</span>
              </button>
            </div>
          </div>

          {publishedOrders.length === 0 ? (
            <Card>
              <Empty>No Daily Orders have been published to the digital notice board yet.</Empty>
              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('GENERATOR')}
                  className={btnPrimary}
                >
                  Generate First Daily Order
                </button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Published Entries Sidebar */}
              <div className="lg:col-span-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                  Published Daily Orders Archive
                </div>

                <div className="space-y-2">
                  {publishedOrders.map(order => {
                    const isSelected = selectedNoticeOrder?.id === order.id;

                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedNoticeOrder(order)}
                        className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-950/60 border-blue-500 text-white shadow-md'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-bold text-blue-300">{order.serialNo}</span>
                          {order.noticeBoardStatus === 'ACTIVE' ? (
                            <span className="text-[10px] font-bold text-emerald-400">ACTIVE</span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">ARCHIVED</span>
                          )}
                        </div>

                        <div className="font-semibold text-white text-sm">
                          Order Date: {order.orderDate}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {order.routineState}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-2 font-mono flex items-center justify-between">
                          <span>{order.trainingSessions.length} training lectures</span>
                          <span>Published {order.publishedAt.slice(0, 10)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Notice Board Display */}
              <div className="lg:col-span-8">
                {selectedNoticeOrder ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-400" />
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {selectedNoticeOrder.serialNo} · {selectedNoticeOrder.orderDate}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Published by {selectedNoticeOrder.publishedBy}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-400" />
                          <span>Print</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#080b11] border-2 border-slate-700/80 rounded-2xl p-6 sm:p-8 font-mono text-xs text-slate-200 shadow-2xl space-y-6">
                      <div className="text-center pb-4 border-b-2 border-slate-700 space-y-1">
                        <div className="text-emerald-400 text-[10px] font-bold tracking-widest uppercase mb-1">
                          SHIP'S OFFICIAL DIGITAL NOTICE BOARD
                        </div>
                        <h2 className="text-base sm:text-lg font-black text-white">
                          INDIAN NAVAL SHIP {selectedNoticeOrder.shipName.toUpperCase()} ({selectedNoticeOrder.pennant})
                        </h2>
                        <div className="text-xs text-blue-400 font-bold">
                          DAILY ORDERS PART I · {selectedNoticeOrder.serialNo}
                        </div>
                        <div className="text-xs text-slate-400">
                          ORDER DATE: <strong className="text-white">{selectedNoticeOrder.orderDate}</strong> · ROUTINE: <strong className="text-white">{selectedNoticeOrder.routineState}</strong>
                        </div>
                      </div>

                      {/* Routines */}
                      <div className="space-y-1.5">
                        <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">
                          1. ROUTINE & TIMINGS
                        </div>
                        <div className="space-y-1 text-[11px]">
                          {selectedNoticeOrder.routines.map((r, i) => (
                            <div key={i} className="flex items-baseline justify-between py-0.5 border-b border-slate-900/60">
                              <span className="w-16 font-bold text-blue-300 tabular-nums">{r.time}h</span>
                              <span className="flex-1 text-slate-200">{r.evolution}</span>
                              <span className="text-slate-500 text-[10px]">{r.remarks}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Training Programme */}
                      <div className="space-y-2">
                        <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">
                          2. GUNNERY & INSTRUCTIONAL PROGRAMME
                        </div>

                        {selectedNoticeOrder.trainingSessions.length === 0 ? (
                          <div className="py-2 text-slate-500 text-center text-[11px] italic">
                            NO CLASSROOM SESSIONS. ALL HANDS FOR WATCHKEEPING & DRILLS.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-[11px] border border-slate-800">
                              <thead className="bg-slate-900 text-slate-400">
                                <tr>
                                  <th className="p-2 border-r border-slate-800">TIME</th>
                                  <th className="p-2 border-r border-slate-800">BRANCH</th>
                                  <th className="p-2 border-r border-slate-800">VENUE</th>
                                  <th className="p-2 border-r border-slate-800">INSTRUCTOR</th>
                                  <th className="p-2">SUBJECT</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/80">
                                {selectedNoticeOrder.trainingSessions.map(s => (
                                  <tr key={s.id} className="hover:bg-slate-900/50">
                                    <td className="p-2 font-bold text-blue-300 whitespace-nowrap border-r border-slate-800 tabular-nums">
                                      {s.startTime} – {s.endTime}
                                    </td>
                                    <td className="p-2 border-r border-slate-800 text-slate-300">{s.department}</td>
                                    <td className="p-2 border-r border-slate-800 text-slate-300">{s.location || 'Flat'}</td>
                                    <td className="p-2 border-r border-slate-800 text-slate-200">{s.speaker}</td>
                                    <td className="p-2 text-white font-semibold">{s.title}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Duties */}
                      <div className="space-y-1.5">
                        <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">
                          3. DUTY WATCHKEEPERS ROSTER
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                          <div>OOD: <strong className="text-white">{selectedNoticeOrder.duties.officerOfTheDay}</strong></div>
                          <div>DEO: <strong className="text-white">{selectedNoticeOrder.duties.dutyEngineerOfficer}</strong></div>
                          <div>QM: <strong className="text-white">{selectedNoticeOrder.duties.quartermaster}</strong></div>
                          <div>POOD: <strong className="text-white">{selectedNoticeOrder.duties.pettyOfficerOfTheDay}</strong></div>
                          <div>GI: <strong className="text-white">{selectedNoticeOrder.duties.dutyGunneryInstructor}</strong></div>
                          <div>DMO: <strong className="text-white">{selectedNoticeOrder.duties.dutyMedicalOfficer}</strong></div>
                        </div>
                      </div>

                      {/* Custom Fields */}
                      {selectedNoticeOrder.customFields && selectedNoticeOrder.customFields.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">
                            4. ROUTINE OFFICE SUPPLEMENTARY ORDERS
                          </div>
                          <div className="space-y-1 text-[11px]">
                            {selectedNoticeOrder.customFields.map(f => (
                              <div key={f.id} className="flex flex-col sm:flex-row sm:items-baseline justify-between py-0.5 border-b border-slate-900/60">
                                <span className="font-bold text-blue-300 sm:w-56 shrink-0">{f.label}:</span>
                                <span className="text-slate-200 flex-1">{f.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dress & Special Directives */}
                      <div className="space-y-1">
                        <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">
                          5. DRESS OF THE DAY
                        </div>
                        <p className="text-[11px] text-slate-300">{selectedNoticeOrder.dressOfTheDay}</p>
                      </div>

                      <div className="space-y-1">
                        <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">
                          6. GUNNERY / ROUTINE OFFICE DIRECTIVES
                        </div>
                        <p className="text-[11px] text-slate-300 whitespace-pre-line">{selectedNoticeOrder.specialDirectives}</p>
                      </div>

                      <div className="pt-4 border-t-2 border-slate-800 text-right text-[11px] text-slate-400">
                        <div className="font-bold text-white">(Vikram Singh)</div>
                        <div>Lieutenant Commander · Gunnery Officer</div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
