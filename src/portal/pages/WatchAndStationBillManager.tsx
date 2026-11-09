/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { usePortal } from '../store';
import { onLeave, todayIso } from '../leaveLogic';
import { newId } from '../db';
import { btnGhost, btnPrimary, Card, Empty, Field, inputCls, Modal, PageHeader } from '../ui';
import { downloadBlob } from '../../utils/exporters';
import { DEPARTMENT_NAMES } from '../../data/departments';
import type { Person, SpecialParty, WatchStationAssignment, DailyDutyRosterEntry } from '../types';
import {
  Shield,
  Download,
  Printer,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Anchor,
  Compass,
  Search,
  Sliders,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

const DEFAULT_SPECIAL_PARTIES: SpecialParty[] = [
  {
    id: 'party-act',
    name: 'Aviation Core Team',
    code: 'ACT',
    description: 'Flight deck officers, helicopter handling party, and aviation crash/rescue crew.',
    excuseFromWatchbill: true,
    memberPersonIds: []
  },
  {
    id: 'party-vbss',
    name: 'Boarding & Search Party (VBSS)',
    code: 'VBSS',
    description: 'Visit, Board, Search, and Seizure maritime interdiction team.',
    excuseFromWatchbill: true,
    memberPersonIds: []
  },
  {
    id: 'party-nbcd',
    name: 'Harbour Emergency Fire & Repair Party',
    code: 'HEFP',
    description: 'Dedicated NBCD state-1 damage control and firefighting party.',
    excuseFromWatchbill: false,
    memberPersonIds: []
  },
  {
    id: 'party-boat',
    name: 'Sea Boat & Lifebuoy Crew',
    code: 'SBC',
    description: 'Rigid inflatable boat (RIB) coxswains, bowmen, and technical hands.',
    excuseFromWatchbill: true,
    memberPersonIds: []
  }
];

const ACTION_STATIONS_BY_DEPT: Record<string, string[]> = {
  Executive: ['Bridge / Conning Position', 'Operations Room Radar Plot', '76mm SRGM Gun Turret', 'AK-630 CIWS Control', 'Signal Deck / EW Suite', 'Quarterdeck Mooring Party'],
  Engineering: ['Machinery Control Room (MCR)', 'Forward Engine Room', 'Aft Auxiliary Room', 'DCHQ-1 Repair Party No. 1', 'DCHQ-2 Repair Party No. 2'],
  Electrical: ['Main Switchboard Room', 'Weapon Control Console', 'Radar & Sonar Equipment Room', 'Gyro & Internal Comms HQ'],
  Logistics: ['Main Galley & Issue Room', 'First Aid Post / Wardroom Stretcher Party', 'Ammunition Supply Chain Party', 'Damage Control Stores']
};

const EMERGENCY_STATIONS = [
  'Liferaft Station No. 1 (Port)',
  'Liferaft Station No. 2 (Starboard)',
  'Liferaft Station No. 3 (Quarterdeck)',
  'Emergency Fire & Flood Party Alpha',
  'Emergency Steering & Conning Station',
  'Medical Triage & Stretcher Party'
];

export const WatchAndStationBillManager: React.FC<{ standalone?: boolean }> = ({ standalone = false }) => {
  const { db, ship, update } = usePortal();
  const today = todayIso();

  const [subTab, setSubTab] = useState<'WATCHBILL' | 'TEMPLATE_EDITOR' | 'PARTIES' | 'DUTY_ROSTER'>('WATCHBILL');
  const [targetDate, setTargetDate] = useState<string>(today);
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [divisionFilter, setDivisionFilter] = useState<string>('ALL');
  const [partyFilter, setPartyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hideOnLeaveOrExcused, setHideOnLeaveOrExcused] = useState<boolean>(false);

  // Template Editor state
  const [billRef, setBillRef] = useState<string>(`WSB/GUNNERY/${new Date().getFullYear()}/01`);
  const [watchSystem, setWatchSystem] = useState<'2_WATCH' | '3_WATCH'>('2_WATCH');
  const [readinessState, setReadinessState] = useState<string>('Degree 2 Readiness · Normal Cruising / Harbour Watch');
  const [standingOrders, setStandingOrders] = useState<string>(
    '1. Personnel detailed in excused Special Parties (Aviation Core Team, VBSS, Sea Boat Crew) are exempted from routine Part-of-Ship watches during flying/boarding stations.\n' +
    '2. Watchkeepers proceeding on approved leave are automatically flagged and replaced prior to Harbour/Sea Watchbill publication.'
  );
  const [templateExtraColumns, setTemplateExtraColumns] = useState<Array<{ id: string; label: string; defaultVal: string }>>([
    { id: 'col-nbcd', label: 'NBCD / DC Respirator No.', defaultVal: 'ELSA-Standard' },
    { id: 'col-bunk', label: 'Mess Deck / Bunk', defaultVal: 'Fwd Mess' }
  ]);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColDefault, setNewColDefault] = useState('');

  // Special Party modal states
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [partyCode, setPartyCode] = useState('');
  const [partyDesc, setPartyDesc] = useState('');
  const [partyExcuse, setPartyExcuse] = useState(true);
  const [selectedPartyForMembers, setSelectedPartyForMembers] = useState<string | null>(null);

  // Duty Roster states
  const [rosterMode, setRosterMode] = useState<'HARBOUR' | 'SEA'>('HARBOUR');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Active personnel
  const activePersonnel = useMemo(() => db.personnel.filter(p => p.active), [db.personnel]);

  // Ensure default special parties exist or use db.specialParties
  const specialParties = useMemo<SpecialParty[]>(() => {
    if (db.specialParties && db.specialParties.length > 0) return db.specialParties;
    return DEFAULT_SPECIAL_PARTIES;
  }, [db.specialParties]);

  // Personnel on approved/pending leave on targetDate
  const onLeaveSet = useMemo(() => {
    const reqs = onLeave(db, targetDate, false);
    return new Set(reqs.map(r => r.personId));
  }, [db, targetDate]);

  // Personnel in special parties that excuse from Watch & Station Bill
  const excusedByPartyMap = useMemo(() => {
    const map = new Map<string, SpecialParty[]>();
    specialParties.forEach(party => {
      party.memberPersonIds.forEach(pid => {
        const list = map.get(pid) || [];
        list.push(party);
        map.set(pid, list);
      });
    });
    return map;
  }, [specialParties]);

  const isExcusedFromWatch = (personId: string): boolean => {
    const parties = excusedByPartyMap.get(personId) || [];
    return parties.some(p => p.excuseFromWatchbill);
  };

  // Auto-populate Watch & Station Bill from Nominal Roll without clashes
  const handleAutoPopulateWatchbill = () => {
    const nextBill: Record<string, WatchStationAssignment> = { ...(db.watchStationBill || {}) };
    const parts: WatchStationAssignment['partOfShip'][] = ['FORECASTLE', 'TOP', 'MAINTOP', 'QUARTERDECK', 'TECH_HQ', 'FLIGHT_DECK'];
    const threeWatches: WatchStationAssignment['watchDivision'][] = ['RED', 'WHITE', 'BLUE'];

    activePersonnel.forEach((p, idx) => {
      const personParties = excusedByPartyMap.get(p.id) || [];
      const excused = personParties.some(sp => sp.excuseFromWatchbill);

      const deptStations = ACTION_STATIONS_BY_DEPT[p.department] || ACTION_STATIONS_BY_DEPT.Executive;
      const actionStation = excused
        ? `Special Party: ${personParties.map(sp => sp.name).join(', ')}`
        : deptStations[idx % deptStations.length];

      const emergencyStation = EMERGENCY_STATIONS[idx % EMERGENCY_STATIONS.length];
      const partOfShip = p.department === 'Engineering' || p.department === 'Electrical'
        ? 'TECH_HQ'
        : parts[idx % 4];

      const watchDivision: WatchStationAssignment['watchDivision'] = excused
        ? 'EXCUSED_SPECIAL'
        : watchSystem === '3_WATCH'
          ? threeWatches[idx % 3]
          : idx % 2 === 0
            ? 'PORT'
            : 'STARBOARD';

      const harbourWatchRole = p.category === 'Officer'
        ? 'Officer of the Day (OOD) Roster'
        : p.department === 'Executive'
          ? (idx % 3 === 0 ? 'Quartermaster (QM)' : idx % 3 === 1 ? 'Petty Officer of the Day (POOD)' : 'Gangway Sentry')
          : 'Departmental Duty Watchkeeper';

      nextBill[p.id] = {
        personId: p.id,
        watchDivision,
        partOfShip,
        actionStation,
        emergencyStation,
        harbourWatchRole,
        specialPartyIds: personParties.map(sp => sp.id),
        remarks: nextBill[p.id]?.remarks || ''
      };
    });

    update(d => ({
      ...d,
      specialParties: d.specialParties && d.specialParties.length > 0 ? d.specialParties : DEFAULT_SPECIAL_PARTIES,
      watchStationBill: nextBill
    }));

    setStatusBanner(`Watch & Station Bill populated from Nominal Roll (${activePersonnel.length} personnel, ${watchSystem === '3_WATCH' ? '3-Watch Red/White/Blue' : '2-Watch Port/Starboard'} template).`);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  // Update a single person's Watch & Station assignment
  const handleUpdateAssignment = (personId: string, patch: Partial<WatchStationAssignment>) => {
    update(d => {
      const current = d.watchStationBill?.[personId] || {
        personId,
        watchDivision: 'PORT',
        partOfShip: 'FORECASTLE',
        actionStation: 'Bridge / Ops Room',
        emergencyStation: 'Liferaft Station No. 1 (Port)',
        harbourWatchRole: 'Duty Watchkeeper',
        specialPartyIds: []
      };
      return {
        ...d,
        watchStationBill: {
          ...(d.watchStationBill || {}),
          [personId]: { ...current, ...patch }
        }
      };
    });
  };

  // Filtered personnel for Watchbill table (includes Party filter!)
  const filteredPersonnel = useMemo(() => {
    return activePersonnel.filter(p => {
      if (deptFilter !== 'ALL' && p.department !== deptFilter) return false;
      const assign = db.watchStationBill?.[p.id];
      if (divisionFilter !== 'ALL' && (assign?.watchDivision || 'PORT') !== divisionFilter) return false;

      // Party filter
      const personParties = excusedByPartyMap.get(p.id) || [];
      if (partyFilter === 'EXCLUDE_EXCUSED') {
        if (isExcusedFromWatch(p.id)) return false;
      } else if (partyFilter === 'ONLY_EXCUSED') {
        if (!isExcusedFromWatch(p.id)) return false;
      } else if (partyFilter !== 'ALL') {
        if (!personParties.some(sp => sp.id === partyFilter)) return false;
      }

      if (hideOnLeaveOrExcused) {
        if (onLeaveSet.has(p.id) || isExcusedFromWatch(p.id)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchRank = p.rank.toLowerCase().includes(q);
        const matchNo = p.serviceNo.toLowerCase().includes(q);
        const matchStation = (assign?.actionStation || '').toLowerCase().includes(q);
        if (!matchName && !matchRank && !matchNo && !matchStation) return false;
      }
      return true;
    });
  }, [activePersonnel, deptFilter, divisionFilter, partyFilter, hideOnLeaveOrExcused, searchQuery, db.watchStationBill, onLeaveSet, excusedByPartyMap]);

  // Build rows for export (CSV & Excel)
  const buildExportRows = () => {
    return filteredPersonnel.map((p, idx) => {
      const assign = db.watchStationBill?.[p.id];
      const parties = (excusedByPartyMap.get(p.id) || []).map(sp => sp.code).join(', ');
      const away = onLeaveSet.has(p.id);
      const excused = isExcusedFromWatch(p.id);
      const availability = away
        ? 'ON LEAVE (CLASH BLOCKED)'
        : excused
          ? `EXCUSED (${parties})`
          : 'AVAILABLE ON BOARD';

      const base: Record<string, string | number> = {
        'Sr No': idx + 1,
        'Bill Ref': billRef,
        'Personal No': p.serviceNo,
        'Rank': p.rank,
        'Name': p.name,
        'Category': p.category,
        'Department': p.department,
        'Section': p.subDepartment || 'General',
        'Watch Division': assign?.watchDivision || (excused ? 'EXCUSED_SPECIAL' : 'PORT'),
        'Part of Ship': assign?.partOfShip || 'QUARTERDECK',
        'Action Station': assign?.actionStation || 'Unassigned',
        'Emergency Station': assign?.emergencyStation || 'Liferaft No. 1',
        'Harbour Watch Role': assign?.harbourWatchRole || 'Duty Hand',
        'Special Party': parties || 'None',
        [`Status on ${targetDate}`]: availability,
        'Remarks / Custom': assign?.remarks || ''
      };

      templateExtraColumns.forEach(col => {
        base[col.label] = assign?.remarks || col.defaultVal;
      });

      return base;
    });
  };

  // Export Clash-Free Watch & Station Bill as CSV (.csv)
  const handleExportWatchbillCsv = () => {
    const rows = buildExportRows();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      headers.map(esc).join(','),
      ...rows.map(r => headers.map(h => esc(r[h])).join(','))
    ];
    downloadBlob(
      '\uFEFF' + csvLines.join('\r\n'),
      `${ship.name.replace(/\s+/g, '_')}_Watch_And_Station_Bill_${targetDate}.csv`,
      'text/csv;charset=utf-8'
    );
  };

  // Export Clash-Free Watch & Station Bill for targetDate (Excel .xlsx)
  const handleExportWatchbillExcel = () => {
    const rows = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Watchbill_${targetDate}`);
    XLSX.writeFile(wb, `${ship.name.replace(/\s+/g, '_')}_Watch_And_Station_Bill_${targetDate}.xlsx`);
  };

  const handleAddTemplateColumn = () => {
    if (!newColLabel.trim()) return;
    setTemplateExtraColumns(prev => [
      ...prev,
      { id: newId(), label: newColLabel.trim(), defaultVal: newColDefault.trim() || '—' }
    ]);
    setNewColLabel('');
    setNewColDefault('');
  };

  const handleRemoveTemplateColumn = (id: string) => {
    setTemplateExtraColumns(prev => prev.filter(c => c.id !== id));
  };

  // Add new Special Party
  const handleCreateParty = () => {
    if (!partyName.trim() || !partyCode.trim()) return;
    const newParty: SpecialParty = {
      id: newId(),
      name: partyName.trim(),
      code: partyCode.trim().toUpperCase(),
      description: partyDesc.trim() || 'Special evolution party',
      excuseFromWatchbill: partyExcuse,
      memberPersonIds: []
    };
    update(d => ({
      ...d,
      specialParties: [...(d.specialParties && d.specialParties.length > 0 ? d.specialParties : DEFAULT_SPECIAL_PARTIES), newParty]
    }));
    setPartyName('');
    setPartyCode('');
    setPartyDesc('');
    setIsAddPartyOpen(false);
  };

  const handleTogglePartyMember = (partyId: string, personId: string) => {
    update(d => {
      const list = d.specialParties && d.specialParties.length > 0 ? d.specialParties : DEFAULT_SPECIAL_PARTIES;
      const updated = list.map(sp => {
        if (sp.id !== partyId) return sp;
        const exists = sp.memberPersonIds.includes(personId);
        return {
          ...sp,
          memberPersonIds: exists ? sp.memberPersonIds.filter(id => id !== personId) : [...sp.memberPersonIds, personId]
        };
      });
      return { ...d, specialParties: updated };
    });
  };

  const handleTogglePartyExcuseFlag = (partyId: string) => {
    update(d => {
      const list = d.specialParties && d.specialParties.length > 0 ? d.specialParties : DEFAULT_SPECIAL_PARTIES;
      return {
        ...d,
        specialParties: list.map(sp => (sp.id === partyId ? { ...sp, excuseFromWatchbill: !sp.excuseFromWatchbill } : sp))
      };
    });
  };

  const handleDeleteParty = (partyId: string) => {
    update(d => ({
      ...d,
      specialParties: (d.specialParties || DEFAULT_SPECIAL_PARTIES).filter(sp => sp.id !== partyId)
    }));
  };

  // Duty Roster Generation (Clash-Free for targetDate)
  const currentRoster: DailyDutyRosterEntry = useMemo(() => {
    if (db.dutyRosters?.[targetDate]) return db.dutyRosters[targetDate];
    return {
      date: targetDate,
      mode: rosterMode,
      officerOfTheDayId: '',
      dutyEngineerOfficerId: '',
      dutyElectricalOfficerId: '',
      quartermasterId: '',
      pettyOfficerOfTheDayId: '',
      gangwaySentryId: '',
      dutyGunneryInstructorId: '',
      harbourFirePartyLeaderId: '',
      notes: '',
      generatedAt: new Date().toISOString()
    };
  }, [db.dutyRosters, targetDate, rosterMode]);

  // Eligible personnel for duty on targetDate (Not on leave, and not in an excused special party)
  const eligiblePersonnel = useMemo(() => {
    return activePersonnel.filter(p => !onLeaveSet.has(p.id) && !isExcusedFromWatch(p.id));
  }, [activePersonnel, onLeaveSet, excusedByPartyMap]);

  const handleAutoGenerateDutyRoster = () => {
    const officers = eligiblePersonnel.filter(p => p.category === 'Officer');
    const engOfficers = officers.filter(p => p.department === 'Engineering');
    const elecOfficers = officers.filter(p => p.department === 'Electrical');
    const sailors = eligiblePersonnel.filter(p => p.category === 'Sailor');
    const execSailors = sailors.filter(p => p.department === 'Executive');

    const daySeed = targetDate.split('-').reduce((acc, v) => acc + Number(v), 0);
    const pick = (arr: Person[], offset = 0) => (arr.length > 0 ? arr[(daySeed + offset) % arr.length].id : '');

    const generated: DailyDutyRosterEntry = {
      date: targetDate,
      mode: rosterMode,
      officerOfTheDayId: pick(officers, 0),
      dutyEngineerOfficerId: pick(engOfficers.length ? engOfficers : officers, 1),
      dutyElectricalOfficerId: pick(elecOfficers.length ? elecOfficers : officers, 2),
      quartermasterId: pick(execSailors.length ? execSailors : sailors, 0),
      pettyOfficerOfTheDayId: pick(execSailors.length ? execSailors : sailors, 1),
      gangwaySentryId: pick(sailors, 2),
      dutyGunneryInstructorId: pick(execSailors.length ? execSailors : sailors, 3),
      harbourFirePartyLeaderId: pick(sailors, 4),
      notes: `Auto-generated clash-free ${rosterMode} watchbill for ${targetDate}. Excluded ${onLeaveSet.size} on leave and ${activePersonnel.filter(p => isExcusedFromWatch(p.id)).length} special party personnel.`,
      generatedAt: new Date().toISOString()
    };

    update(d => ({
      ...d,
      dutyRosters: {
        ...(d.dutyRosters || {}),
        [targetDate]: generated
      }
    }));

    setStatusBanner(`Clash-free ${rosterMode} Duty Roster generated for ${targetDate}.`);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleUpdateRosterField = (field: keyof DailyDutyRosterEntry, value: string) => {
    update(d => ({
      ...d,
      dutyRosters: {
        ...(d.dutyRosters || {}),
        [targetDate]: {
          ...currentRoster,
          [field]: value
        }
      }
    }));
  };

  const totalExcusedCount = activePersonnel.filter(p => isExcusedFromWatch(p.id)).length;
  const totalAvailableToday = activePersonnel.filter(p => !onLeaveSet.has(p.id) && !isExcusedFromWatch(p.id)).length;

  return (
    <div className="space-y-6">
      {standalone && (
        <PageHeader
          title="Watch & Station Bill Module"
          subtitle="Executive Department · Gunnery & Routine Office — Template Editor, Nominal Roll Auto-Population, Party Excusals, and Clash-Free CSV / Print Export"
        />
      )}

      {/* Print-Only Official Naval Watch & Station Bill Header */}
      <div className="hidden print:block pb-4 mb-4 border-b-2 border-black text-black">
        <div className="text-center space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest font-bold">RESTRICTED · FOR SHIPBOARD USE ONLY</div>
          <h1 className="text-xl font-black uppercase">INDIAN NAVAL SHIP {ship.name} ({ship.pennant})</h1>
          <div className="text-sm font-bold">EXECUTIVE DEPARTMENT · GUNNERY & ROUTINE OFFICE</div>
          <div className="text-xs font-mono">
            WATCH & STATION BILL ({billRef}) · DATE: {targetDate} · {readinessState}
          </div>
        </div>
        <div className="mt-3 text-xs whitespace-pre-line border-t border-black/30 pt-2">
          <strong>Standing Orders:</strong> {standingOrders}
        </div>
      </div>

      {/* Top Operational Summary & Mode Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Anchor className="w-4 h-4 text-blue-400" />
            <span>Watch & Station Bill Template & Duty Roster ({billRef})</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 tabular-nums">
            <span>Nominal Roll: <strong className="text-white">{activePersonnel.length}</strong></span>
            <span aria-hidden="true">·</span>
            <span>On Leave ({targetDate}): <strong className="text-amber-300">{onLeaveSet.size}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Special Party Excused: <strong className="text-purple-300">{totalExcusedCount}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Net Watchkeeping Available: <strong className="text-emerald-400">{totalAvailableToday}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span>Target Date:</span>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="bg-transparent text-white font-mono text-xs outline-none"
            />
          </label>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setSubTab('WATCHBILL')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'WATCHBILL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Watch & Station Bill
            </button>
            <button
              type="button"
              onClick={() => setSubTab('TEMPLATE_EDITOR')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'TEMPLATE_EDITOR' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Template Editor
            </button>
            <button
              type="button"
              onClick={() => setSubTab('PARTIES')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'PARTIES' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Special Parties ({specialParties.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('DUTY_ROSTER')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'DUTY_ROSTER' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Harbour & Sea Duty Roster
            </button>
          </div>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 no-print">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* SUB-TAB 1: WATCH & STATION BILL */}
      {subTab === 'WATCHBILL' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 p-3.5 rounded-xl no-print">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[190px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, rank, service no, station…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`${inputCls} pl-8 text-xs`}
                />
              </div>

              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className={`${inputCls} w-36 text-xs`}
                aria-label="Filter by Department"
              >
                <option value="ALL">All Departments</option>
                {DEPARTMENT_NAMES.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={partyFilter}
                onChange={e => setPartyFilter(e.target.value)}
                className={`${inputCls} w-52 text-xs`}
                aria-label="Filter by Special Party"
              >
                <option value="ALL">All Parties (Show Everyone)</option>
                <option value="EXCLUDE_EXCUSED">Exclude Excused Parties (Active Watchkeepers)</option>
                <option value="ONLY_EXCUSED">Only Excused Special Parties</option>
                {specialParties.map(sp => (
                  <option key={sp.id} value={sp.id}>
                    Party: {sp.name} ({sp.code}){sp.excuseFromWatchbill ? ' — Excused' : ''}
                  </option>
                ))}
              </select>

              <select
                value={divisionFilter}
                onChange={e => setDivisionFilter(e.target.value)}
                className={`${inputCls} w-40 text-xs`}
                aria-label="Filter by Watch Division"
              >
                <option value="ALL">All Watch Divisions</option>
                <option value="PORT">Port Watch</option>
                <option value="STARBOARD">Starboard Watch</option>
                <option value="RED">Red Watch (3-Watch)</option>
                <option value="WHITE">White Watch (3-Watch)</option>
                <option value="BLUE">Blue Watch (3-Watch)</option>
                <option value="EXCUSED_SPECIAL">Excused (Special Party)</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideOnLeaveOrExcused}
                  onChange={e => setHideOnLeaveOrExcused(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600"
                />
                <span>Clash-Free Available Only ({targetDate})</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAutoPopulateWatchbill}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Fetch from Nominal Roll</span>
              </button>

              <button
                type="button"
                onClick={handleExportWatchbillCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportWatchbillExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export .XLSX</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>Print Format</span>
              </button>
            </div>
          </div>

          <Card title={`Ship's Watch & Station Bill (${filteredPersonnel.length} personnel displayed · ${readinessState})`}>
            {filteredPersonnel.length === 0 ? (
              <Empty>No personnel match the current filter criteria. Click "Fetch from Nominal Roll" to populate.</Empty>
            ) : (
              <div className="overflow-x-auto max-h-[38rem] overflow-y-auto print:max-h-none print:overflow-visible">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Personnel</th>
                      <th className="px-3">Dept / Section</th>
                      <th className="px-3">Watch Division</th>
                      <th className="px-3">Part of Ship</th>
                      <th className="px-3">Action Station</th>
                      <th className="px-3">Emergency Station</th>
                      {templateExtraColumns.map(col => (
                        <th key={col.id} className="px-3">{col.label}</th>
                      ))}
                      <th className="px-3">Special Party / Excusal</th>
                      <th className="px-3 text-right">Status ({targetDate})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredPersonnel.map(p => {
                      const assign = db.watchStationBill?.[p.id];
                      const away = onLeaveSet.has(p.id);
                      const parties = excusedByPartyMap.get(p.id) || [];
                      const excused = parties.some(sp => sp.excuseFromWatchbill);

                      return (
                        <tr key={p.id} className={`hover:bg-slate-800/30 transition-colors ${away ? 'opacity-60 bg-amber-950/10' : ''}`}>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-white">{p.rank} {p.name}</div>
                            <div className="text-[10px] font-mono text-slate-400 tabular-nums">{p.serviceNo} · {p.category}</div>
                          </td>
                          <td className="px-3 text-slate-300">
                            <div>{p.department}</div>
                            <div className="text-[10px] text-slate-500">{p.subDepartment || 'General'}</div>
                          </td>
                          <td className="px-3">
                            <select
                              value={assign?.watchDivision || (excused ? 'EXCUSED_SPECIAL' : 'PORT')}
                              onChange={e => handleUpdateAssignment(p.id, { watchDivision: e.target.value as WatchStationAssignment['watchDivision'] })}
                              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                            >
                              <option value="PORT">Port Watch</option>
                              <option value="STARBOARD">Starboard Watch</option>
                              <option value="RED">Red Watch</option>
                              <option value="WHITE">White Watch</option>
                              <option value="BLUE">Blue Watch</option>
                              <option value="EXCUSED_SPECIAL">Excused (Special)</option>
                            </select>
                          </td>
                          <td className="px-3">
                            <select
                              value={assign?.partOfShip || 'QUARTERDECK'}
                              onChange={e => handleUpdateAssignment(p.id, { partOfShip: e.target.value as WatchStationAssignment['partOfShip'] })}
                              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                            >
                              <option value="FORECASTLE">Forecastle</option>
                              <option value="TOP">Top Part</option>
                              <option value="MAINTOP">Maintop</option>
                              <option value="QUARTERDECK">Quarterdeck</option>
                              <option value="TECH_HQ">Technical HQ</option>
                              <option value="FLIGHT_DECK">Flight Deck</option>
                            </select>
                          </td>
                          <td className="px-3">
                            <input
                              type="text"
                              value={assign?.actionStation || ''}
                              placeholder="Assign Action Station…"
                              onChange={e => handleUpdateAssignment(p.id, { actionStation: e.target.value })}
                              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-44"
                            />
                          </td>
                          <td className="px-3">
                            <input
                              type="text"
                              value={assign?.emergencyStation || ''}
                              placeholder="Assign Emergency Station…"
                              onChange={e => handleUpdateAssignment(p.id, { emergencyStation: e.target.value })}
                              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-44"
                            />
                          </td>
                          {templateExtraColumns.map(col => (
                            <td key={col.id} className="px-3">
                              <input
                                type="text"
                                defaultValue={col.defaultVal}
                                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 w-32"
                              />
                            </td>
                          ))}
                          <td className="px-3">
                            {parties.length === 0 ? (
                              <span className="text-slate-500 text-[11px]">General Watchbill</span>
                            ) : (
                              <div className="text-[11px] text-purple-300 font-medium">
                                {parties.map(sp => sp.name).join(' · ')}
                              </div>
                            )}
                          </td>
                          <td className="px-3 text-right whitespace-nowrap">
                            {away ? (
                              <span className="text-amber-400 font-semibold text-[11px]">On Leave (Clash Blocked)</span>
                            ) : excused ? (
                              <span className="text-purple-300 font-semibold text-[11px]">Excused ({parties.map(s => s.code).join('/')})</span>
                            ) : (
                              <span className="text-emerald-400 font-semibold text-[11px]">Available On Board</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* SUB-TAB 2: WATCH & STATION BILL TEMPLATE EDITOR */}
      {subTab === 'TEMPLATE_EDITOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <Card title="Watch & Station Bill Template Parameters" className="lg:col-span-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Bill Serial / Reference">
                  <input
                    type="text"
                    value={billRef}
                    onChange={e => setBillRef(e.target.value)}
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="Default Watch System">
                  <select
                    value={watchSystem}
                    onChange={e => setWatchSystem(e.target.value as '2_WATCH' | '3_WATCH')}
                    className={inputCls}
                  >
                    <option value="2_WATCH">2-Watch System (Port & Starboard)</option>
                    <option value="3_WATCH">3-Watch System (Red, White & Blue)</option>
                  </select>
                </Field>
              </div>

              <Field label="Ship Readiness & Cruising State Header">
                <input
                  type="text"
                  value={readinessState}
                  onChange={e => setReadinessState(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Standing Watch & Station Orders (Printed on Bill)">
                <textarea
                  rows={4}
                  value={standingOrders}
                  onChange={e => setStandingOrders(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    handleAutoPopulateWatchbill();
                    setSubTab('WATCHBILL');
                  }}
                  className={btnPrimary}
                >
                  Apply Template & Re-Populate from Nominal Roll
                </button>
              </div>
            </div>
          </Card>

          <Card title="Custom Watch & Station Bill Columns" className="lg:col-span-6">
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Add custom columns to the Watch & Station Bill template (e.g., NBCD Respirator Number, Abandon Ship Liferaft Billet, Mess Deck Bunk, Action Messing).
              </p>

              <div className="space-y-2">
                {templateExtraColumns.map(col => (
                  <div key={col.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <div>
                      <span className="font-bold text-white">{col.label}</span>
                      <span className="text-slate-500 ml-2 font-mono">Default: {col.defaultVal}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTemplateColumn(col.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  placeholder="Column Heading (e.g. Action Messing)"
                  value={newColLabel}
                  onChange={e => setNewColLabel(e.target.value)}
                  className={`${inputCls} sm:col-span-6`}
                />
                <input
                  type="text"
                  placeholder="Default Value"
                  value={newColDefault}
                  onChange={e => setNewColDefault(e.target.value)}
                  className={`${inputCls} sm:col-span-4`}
                />
                <button
                  type="button"
                  onClick={handleAddTemplateColumn}
                  className="sm:col-span-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 py-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* SUB-TAB 3: SPECIAL PARTIES & EXCUSALS (Aviation Core Team, VBSS, etc.) */}
      {subTab === 'PARTIES' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white">Special Shipboard Parties & Automatic Watchbill Excusals</h4>
              <p className="text-xs text-slate-400">
                Assign personnel to specialized operational teams (such as the Aviation Core Team or Boarding Party) to automatically excuse them from general harbour/sea watchbills.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddPartyOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Special Party</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Parties List */}
            <div className="lg:col-span-5 space-y-3">
              {specialParties.map(party => {
                const isSelected = selectedPartyForMembers === party.id;
                return (
                  <div
                    key={party.id}
                    onClick={() => setSelectedPartyForMembers(party.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-colors space-y-2 ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-sm text-white">
                        {party.name} <span className="font-mono text-xs text-blue-400">({party.code})</span>
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteParty(party.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Delete special party"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">{party.description}</p>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
                      <span className="font-mono text-slate-300">{party.memberPersonIds.length} member(s) detailed</span>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleTogglePartyExcuseFlag(party.id);
                        }}
                        className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                          party.excuseFromWatchbill
                            ? 'bg-purple-950/60 border-purple-700/60 text-purple-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {party.excuseFromWatchbill ? '✓ Excused from Routine Watchbill' : 'Included in Routine Watchbill'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Member Assignment Panel */}
            <div className="lg:col-span-7">
              {!selectedPartyForMembers ? (
                <Card title="Assign Personnel to Special Party">
                  <Empty>Select a Special Party on the left (e.g., Aviation Core Team) to add or remove personnel from the Nominal Roll.</Empty>
                </Card>
              ) : (() => {
                const activeParty = specialParties.find(sp => sp.id === selectedPartyForMembers);
                if (!activeParty) return null;
                return (
                  <Card title={`${activeParty.name} (${activeParty.code}) — Personnel Roster`}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                        <span>Check personnel below to detail them to <strong>{activeParty.name}</strong></span>
                        <span className="font-mono text-white font-semibold">{activeParty.memberPersonIds.length} selected</span>
                      </div>
                      <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60">
                        {activePersonnel.map(p => {
                          const isMember = activeParty.memberPersonIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex items-center justify-between py-2 px-2 hover:bg-slate-800/40 rounded cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isMember}
                                  onChange={() => handleTogglePartyMember(activeParty.id, p.id)}
                                  className="rounded border-slate-700 bg-slate-900 text-blue-600"
                                />
                                <div>
                                  <span className="font-semibold text-white">{p.rank} {p.name}</span>
                                  <span className="text-slate-400 font-mono ml-2">({p.serviceNo})</span>
                                </div>
                              </div>
                              <span className="text-slate-400 text-[11px]">{p.department} · {p.subDepartment || 'General'}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: HARBOUR & SEA DUTY ROSTER GENERATOR */}
      {subTab === 'DUTY_ROSTER' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-400" />
                <span>Automated Clash-Free Watchkeeping & Duty Roster — {targetDate}</span>
              </h4>
              <p className="text-xs text-slate-400">
                Automatically excludes {onLeaveSet.size} personnel on leave and {totalExcusedCount} personnel excused in Special Parties (such as Aviation Core Team).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={rosterMode}
                onChange={e => setRosterMode(e.target.value as 'HARBOUR' | 'SEA')}
                className={`${inputCls} w-40 text-xs font-semibold`}
              >
                <option value="HARBOUR">Harbour Routine</option>
                <option value="SEA">Sea Cruising Watch</option>
              </select>

              <button
                type="button"
                onClick={handleAutoGenerateDutyRoster}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Auto-Assign Clash-Free Roster</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Officer Watchkeepers">
              <div className="space-y-3">
                <Field label="Officer of the Day (OOD) / Officer of the Watch (OOW)">
                  <select
                    className={inputCls}
                    value={currentRoster.officerOfTheDayId}
                    onChange={e => handleUpdateRosterField('officerOfTheDayId', e.target.value)}
                  >
                    <option value="">Select eligible Officer…</option>
                    {eligiblePersonnel.filter(p => p.category === 'Officer').map(p => (
                      <option key={p.id} value={p.id}>{p.rank} {p.name} ({p.department})</option>
                    ))}
                  </select>
                </Field>

                <Field label="Duty Engineer Officer (DEO)">
                  <select
                    className={inputCls}
                    value={currentRoster.dutyEngineerOfficerId}
                    onChange={e => handleUpdateRosterField('dutyEngineerOfficerId', e.target.value)}
                  >
                    <option value="">Select eligible Engineer Officer…</option>
                    {eligiblePersonnel.filter(p => p.category === 'Officer').map(p => (
                      <option key={p.id} value={p.id}>{p.rank} {p.name} ({p.department})</option>
                    ))}
                  </select>
                </Field>

                <Field label="Duty Electrical Officer (DLO)">
                  <select
                    className={inputCls}
                    value={currentRoster.dutyElectricalOfficerId}
                    onChange={e => handleUpdateRosterField('dutyElectricalOfficerId', e.target.value)}
                  >
                    <option value="">Select eligible Electrical Officer…</option>
                    {eligiblePersonnel.filter(p => p.category === 'Officer').map(p => (
                      <option key={p.id} value={p.id}>{p.rank} {p.name} ({p.department})</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Card>

            <Card title="Senior & Junior Sailor Watchkeepers">
              <div className="space-y-3">
                <Field label="Quartermaster of the Day (QM)">
                  <select
                    className={inputCls}
                    value={currentRoster.quartermasterId}
                    onChange={e => handleUpdateRosterField('quartermasterId', e.target.value)}
                  >
                    <option value="">Select eligible Quartermaster…</option>
                    {eligiblePersonnel.filter(p => p.category === 'Sailor').map(p => (
                      <option key={p.id} value={p.id}>{p.rank} {p.name} ({p.department})</option>
                    ))}
                  </select>
                </Field>

                <Field label="Petty Officer of the Day (POOD)">
                  <select
                    className={inputCls}
                    value={currentRoster.pettyOfficerOfTheDayId}
                    onChange={e => handleUpdateRosterField('pettyOfficerOfTheDayId', e.target.value)}
                  >
                    <option value="">Select eligible Petty Officer…</option>
                    {eligiblePersonnel.filter(p => p.category === 'Sailor').map(p => (
                      <option key={p.id} value={p.id}>{p.rank} {p.name} ({p.department})</option>
                    ))}
                  </select>
                </Field>

                <Field label="Duty Gunnery Instructor (GI) / Routine Office">
                  <select
                    className={inputCls}
                    value={currentRoster.dutyGunneryInstructorId}
                    onChange={e => handleUpdateRosterField('dutyGunneryInstructorId', e.target.value)}
                  >
                    <option value="">Select eligible GI…</option>
                    {eligiblePersonnel.filter(p => p.category === 'Sailor').map(p => (
                      <option key={p.id} value={p.id}>{p.rank} {p.name} ({p.department})</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Modal: Create Special Party */}
      {isAddPartyOpen && (
        <Modal title="Add Special Shipboard Party / Team" onClose={() => setIsAddPartyOpen(false)}>
          <div className="space-y-4">
            <Field label="Party / Team Name">
              <input
                type="text"
                placeholder="e.g. Aviation Core Team, Damage Control Party, Survey Team"
                className={inputCls}
                value={partyName}
                onChange={e => setPartyName(e.target.value)}
              />
            </Field>
            <Field label="Short Code">
              <input
                type="text"
                placeholder="e.g. ACT, VBSS, DC"
                className={`${inputCls} font-mono uppercase`}
                value={partyCode}
                onChange={e => setPartyCode(e.target.value)}
              />
            </Field>
            <Field label="Operational Description">
              <input
                type="text"
                placeholder="Brief role description"
                className={inputCls}
                value={partyDesc}
                onChange={e => setPartyDesc(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={partyExcuse}
                onChange={e => setPartyExcuse(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-600"
              />
              <span>Excuse members of this party from general Watch & Station Bill and routine duty rosters</span>
            </label>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button type="button" className={btnGhost} onClick={() => setIsAddPartyOpen(false)}>Cancel</button>
              <button type="button" className={btnPrimary} onClick={handleCreateParty}>Create Special Party</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
