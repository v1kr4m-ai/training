/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { DEPARTMENT_NAMES } from '../../../data/departments';
import { downloadBlob } from '../../../utils/exporters';
import { balances, daysBetween, monthlyForecast, onLeave, shortfalls, todayIso } from '../../leaveLogic';
import { usePortal } from '../../store';
import { btnGhost, btnPrimary, Card, Empty, Field, inputCls, Modal } from '../../ui';
import { BalanceBar } from './MyLeave';
import {
  Calendar,
  CalendarDays,
  Check,
  Edit3,
  Plus,
  TrendingUp,
  Users,
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { DepartmentLeaveForecastEntry } from '../../types';
import { newId } from '../../db';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

function inferQuarter(dateStr: string): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  const m = Number(dateStr.slice(5, 7)) || 1;
  if (m <= 3) return 'Q1';
  if (m <= 6) return 'Q2';
  if (m <= 9) return 'Q3';
  return 'Q4';
}

export const Forecast: React.FC<{
  viewMode?: 'DEPARTMENTAL' | 'INDIVIDUAL';
  onViewModeChange?: (mode: 'DEPARTMENTAL' | 'INDIVIDUAL') => void;
}> = ({ viewMode = 'DEPARTMENTAL', onViewModeChange }) => {
  const { db, user, me, update, ship } = usePortal();
  const today = todayIso();
  const [year, setYear] = useState(+today.slice(0, 4));
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'Officer' | 'Sailor'>('ALL');
  const [selectedIndividualId, setSelectedIndividualId] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'COLLATED' | 'CALENDAR' | 'ANALYTICS' | 'AVAILED'>('COLLATED');

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());
  const [selectedCalDate, setSelectedCalDate] = useState<string>(today);

  // Modal states
  const [isAddForecastOpen, setIsAddForecastOpen] = useState(false);
  const [forecastPersonId, setForecastPersonId] = useState('');
  const [forecastQuarter, setForecastQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [forecastFrom, setForecastFrom] = useState('');
  const [forecastTo, setForecastTo] = useState('');
  const [forecastTypeId, setForecastTypeId] = useState(db.leaveTypes[0]?.id || '');
  const [forecastReliever, setForecastReliever] = useState('');
  const [forecastPriority, setForecastPriority] = useState<'NORMAL' | 'HIGH' | 'ESSENTIAL'>('NORMAL');
  const [forecastRemarks, setForecastRemarks] = useState('');

  // Bulk Upload state
  const bulkUploadRef = useRef<HTMLInputElement>(null);
  const [uploadBanner, setUploadBanner] = useState<string | null>(null);

  // Availed Leave Adjustment state
  const [selectedPersonForAvailed, setSelectedPersonForAvailed] = useState<string>('');
  const [availedEdits, setAvailedEdits] = useState<Record<string, { days: number; remarks: string }>>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const role = user?.role;
  const canEdit = role === 'ADMIN' || role === 'CO' || role === 'EXO' || role === 'HOD' || role === 'USER';
  const seesNames = role !== 'USER';

  // Department scope
  const scope = useMemo(() => {
    const active = db.personnel.filter(p => p.active);
    if (role === 'ADMIN' || role === 'CO' || role === 'EXO') return active;
    if (me) return active.filter(p => p.department === me.department);
    return active;
  }, [db.personnel, role, me]);

  const deptScopedPeople = useMemo(
    () =>
      scope
        .filter(p => (deptFilter === 'ALL' || p.department === deptFilter) && (categoryFilter === 'ALL' || p.category === categoryFilter))
        .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name)),
    [scope, deptFilter, categoryFilter]
  );

  const effectiveIndividualId = selectedIndividualId || me?.id || deptScopedPeople[0]?.id || '';

  const people = useMemo(() => {
    if (viewMode === 'INDIVIDUAL' && effectiveIndividualId) {
      return deptScopedPeople.filter(p => p.id === effectiveIndividualId);
    }
    return deptScopedPeople;
  }, [viewMode, effectiveIndividualId, deptScopedPeople]);

  const peopleIds = useMemo(() => new Set(people.map(p => p.id)), [people]);
  const scoped = useMemo(
    () => ({
      ...db,
      personnel: people,
      leaveRequests: db.leaveRequests.filter(r => peopleIds.has(r.personId))
    }),
    [db, people, peopleIds]
  );

  // Department forecasts stored in db filtered by current scope/filters
  const departmentForecasts = useMemo(() => {
    return (db.leaveForecasts || []).filter(f => f.year === year && peopleIds.has(f.personId));
  }, [db.leaveForecasts, year, peopleIds]);

  // Combined Monthly Chart Data (Approved + Pending + Planned Forecast + Peak)
  const monthlyCombinationData = useMemo(() => {
    const base = monthlyForecast(scoped, year);
    return base.map(m => {
      const mStr = String(m.month + 1).padStart(2, '0');
      const mStart = `${year}-${mStr}-01`;
      const mEnd = `${year}-${mStr}-31`;
      let plannedForecastDays = 0;
      let officerForecastDays = 0;
      let sailorForecastDays = 0;

      departmentForecasts.forEach(f => {
        if (f.proposedTo >= mStart && f.proposedFrom <= mEnd) {
          const fromClamp = f.proposedFrom < mStart ? mStart : f.proposedFrom;
          const toClamp = f.proposedTo > mEnd ? mEnd : f.proposedTo;
          const d = daysBetween(fromClamp, toClamp);
          plannedForecastDays += d;
          const p = db.personnel.find(x => x.id === f.personId);
          if (p?.category === 'Officer') officerForecastDays += d;
          else sailorForecastDays += d;
        }
      });

      return {
        name: MONTHS[m.month],
        Approved: m.approvedDays,
        Pending: m.pendingDays,
        PlannedForecast: plannedForecastDays,
        OfficerForecast: officerForecastDays,
        SailorForecast: sailorForecastDays,
        PeakPersonnelAway: m.peakOnLeave
      };
    });
  }, [scoped, year, departmentForecasts, db.personnel]);

  // Departmental Leave Load Comparison Data
  const departmentComparisonData = useMemo(() => {
    return DEPARTMENT_NAMES.map(dept => {
      const deptCrew = scope.filter(p => p.department === dept);
      const deptIds = new Set(deptCrew.map(p => p.id));
      const approvedDays = db.leaveRequests
        .filter(r => deptIds.has(r.personId) && r.status === 'APPROVED' && r.from.startsWith(String(year)))
        .reduce((acc, r) => acc + r.days, 0);
      const pendingDays = db.leaveRequests
        .filter(r => deptIds.has(r.personId) && r.status.startsWith('PENDING') && r.from.startsWith(String(year)))
        .reduce((acc, r) => acc + r.days, 0);
      const forecastDays = (db.leaveForecasts || [])
        .filter(f => deptIds.has(f.personId) && f.year === year)
        .reduce((acc, f) => acc + f.plannedDays, 0);

      return {
        department: dept,
        Headcount: deptCrew.length,
        Approved: approvedDays,
        Pending: pendingDays,
        PlannedForecast: forecastDays
      };
    });
  }, [scope, db.leaveRequests, db.leaveForecasts, year]);

  // Quarter-wise Category & Priority Breakdown
  const quarterBreakdownData = useMemo(() => {
    return QUARTERS.map(q => {
      const qList = departmentForecasts.filter(f => f.quarter === q);
      let normalDays = 0;
      let highDays = 0;
      let essentialDays = 0;
      let officerCount = 0;
      let sailorCount = 0;

      qList.forEach(f => {
        if (f.priority === 'ESSENTIAL') essentialDays += f.plannedDays;
        else if (f.priority === 'HIGH') highDays += f.plannedDays;
        else normalDays += f.plannedDays;

        const p = db.personnel.find(x => x.id === f.personId);
        if (p?.category === 'Officer') officerCount++;
        else sailorCount++;
      });

      return {
        quarter: q,
        Normal: normalDays,
        HighPriority: highDays,
        Essential: essentialDays,
        Officers: officerCount,
        Sailors: sailorCount
      };
    });
  }, [departmentForecasts, db.personnel]);

  const warn = useMemo(() => shortfalls(scoped, `${year}-01-01`, `${year}-12-31`), [scoped, year]);
  const awayToday = useMemo(() => onLeave(scoped, today), [scoped, today]);

  // Calendar grid helper for selected month & year
  const calendarDaysGrid = useMemo(() => {
    const firstDay = new Date(year, calendarMonth, 1);
    const daysInMonth = new Date(year, calendarMonth + 1, 0).getDate();
    const startWeekday = firstDay.getDay(); // 0 = Sun

    const cells: Array<{
      dateStr: string | null;
      dayNum: number | null;
      approvedCount: number;
      pendingCount: number;
      forecastCount: number;
      totalAway: number;
      isClashWarning: boolean;
    }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({
        dateStr: null,
        dayNum: null,
        approvedCount: 0,
        pendingCount: 0,
        forecastCount: 0,
        totalAway: 0,
        isClashWarning: false
      });
    }

    const headcount = Math.max(people.length, 1);
    const maxPct = db.maxLeavePctPerDept || 25;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const approvedIds = new Set<string>();
      const pendingIds = new Set<string>();
      const forecastIds = new Set<string>();

      scoped.leaveRequests.forEach(r => {
        if (r.from <= dateStr && r.to >= dateStr) {
          if (r.status === 'APPROVED') approvedIds.add(r.personId);
          else if (r.status.startsWith('PENDING')) pendingIds.add(r.personId);
        }
      });

      departmentForecasts.forEach(f => {
        if (f.proposedFrom <= dateStr && f.proposedTo >= dateStr) {
          if (!approvedIds.has(f.personId)) {
            forecastIds.add(f.personId);
          }
        }
      });

      const unionIds = new Set([...approvedIds, ...pendingIds, ...forecastIds]);
      const pct = (unionIds.size / headcount) * 100;

      cells.push({
        dateStr,
        dayNum: d,
        approvedCount: approvedIds.size,
        pendingCount: pendingIds.size,
        forecastCount: forecastIds.size,
        totalAway: unionIds.size,
        isClashWarning: pct > maxPct
      });
    }

    return cells;
  }, [year, calendarMonth, scoped.leaveRequests, departmentForecasts, people.length, db.maxLeavePctPerDept]);

  // Detailed personnel away on selectedCalDate
  const selectedDayDetails = useMemo(() => {
    const items: Array<{
      personId: string;
      mode: 'APPROVED' | 'PENDING' | 'FORECAST';
      from: string;
      to: string;
      leaveTypeName: string;
      reliever?: string;
      priority?: string;
    }> = [];

    scoped.leaveRequests.forEach(r => {
      if (r.from <= selectedCalDate && r.to >= selectedCalDate) {
        if (r.status === 'APPROVED' || r.status.startsWith('PENDING')) {
          const lt = db.leaveTypes.find(t => t.id === r.typeId);
          items.push({
            personId: r.personId,
            mode: r.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
            from: r.from,
            to: r.to,
            leaveTypeName: lt?.name || 'Leave'
          });
        }
      }
    });

    departmentForecasts.forEach(f => {
      if (f.proposedFrom <= selectedCalDate && f.proposedTo >= selectedCalDate) {
        const lt = db.leaveTypes.find(t => t.id === f.leaveTypeId);
        items.push({
          personId: f.personId,
          mode: 'FORECAST',
          from: f.proposedFrom,
          to: f.proposedTo,
          leaveTypeName: lt?.name || 'Planned Leave',
          reliever: f.relieverName,
          priority: f.priority
        });
      }
    });

    return items;
  }, [selectedCalDate, scoped.leaveRequests, departmentForecasts, db.leaveTypes]);

  // Handle saving new or edited forecast entry
  const handleSaveForecast = () => {
    if (!forecastPersonId || !forecastFrom || !forecastTo) return;
    const targetPerson = db.personnel.find(p => p.id === forecastPersonId);
    if (!targetPerson) return;
    const days = daysBetween(forecastFrom, forecastTo);

    const newEntry: DepartmentLeaveForecastEntry = {
      id: newId(),
      personId: targetPerson.id,
      department: targetPerson.department,
      subDepartment: targetPerson.subDepartment,
      year,
      quarter: forecastQuarter,
      proposedFrom: forecastFrom,
      proposedTo: forecastTo,
      plannedDays: days,
      leaveTypeId: forecastTypeId,
      relieverName: forecastReliever.trim() || undefined,
      priority: forecastPriority,
      remarks: forecastRemarks.trim() || undefined,
      status: 'PLANNED',
      updatedAt: new Date().toISOString()
    };

    update(d => ({
      ...d,
      leaveForecasts: [...(d.leaveForecasts || []).filter(f => !(f.personId === targetPerson.id && f.proposedFrom === forecastFrom)), newEntry]
    }));

    setIsAddForecastOpen(false);
    setForecastFrom('');
    setForecastTo('');
    setForecastRemarks('');
    setForecastReliever('');
  };

  const handleDeleteForecast = (id: string) => {
    if (!window.confirm('Remove this planned forecast entry?')) return;
    update(d => ({
      ...d,
      leaveForecasts: (d.leaveForecasts || []).filter(f => f.id !== id)
    }));
  };

  // Download Blank / Sample Excel Template for Individual or Departmental Leave Forecast Upload
  const handleDownloadForecastTemplate = () => {
    const sampleRows = people.slice(0, 6).map((p, idx) => ({
      'Personal No': p.serviceNo,
      Rank: p.rank,
      Name: p.name,
      Department: p.department,
      Section: p.subDepartment || 'General',
      Quarter: QUARTERS[idx % 4],
      'Leave Type': db.leaveTypes[0]?.name || 'Annual Leave (AL)',
      'Proposed From': `${year}-0${(idx % 4) * 2 + 2}-10`,
      'Proposed To': `${year}-0${(idx % 4) * 2 + 2}-24`,
      Reliever: people[(idx + 1) % Math.max(people.length, 1)]?.name || '',
      Priority: idx === 0 ? 'HIGH' : 'NORMAL',
      Remarks: 'Planned Departmental Leave Forecast'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Leave Forecast Template');
    XLSX.writeFile(wb, `${ship.name.replace(/\s+/g, '_')}_Leave_Forecast_Template_${year}.xlsx`);
  };

  // Bulk Upload Departmental or Individual Forecast Spreadsheet (.xlsx / .csv)
  const handleBulkUploadForecast = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        const imported: DepartmentLeaveForecastEntry[] = [];
        rows.forEach(row => {
          const svcNo = String(row['Personal No'] || row['Service No'] || row['Personal Number'] || '').trim().toLowerCase();
          const nameStr = String(row['Name'] || '').trim().toLowerCase();
          const matchedPerson =
            db.personnel.find(p => svcNo && p.serviceNo.toLowerCase() === svcNo) ||
            db.personnel.find(p => nameStr && p.name.toLowerCase() === nameStr) ||
            me;

          if (!matchedPerson) return;

          const rawFrom = String(row['Proposed From'] || row['From'] || row['Start Date'] || '').trim().slice(0, 10);
          const rawTo = String(row['Proposed To'] || row['To'] || row['End Date'] || '').trim().slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(rawFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(rawTo) || rawTo < rawFrom) return;

          const qRaw = String(row['Quarter'] || '').trim().toUpperCase();
          const quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' =
            qRaw === 'Q1' || qRaw === 'Q2' || qRaw === 'Q3' || qRaw === 'Q4' ? qRaw : inferQuarter(rawFrom);

          const typeStr = String(row['Leave Type'] || row['Type'] || '').toLowerCase();
          const matchedType = db.leaveTypes.find(t => t.name.toLowerCase().includes(typeStr)) || db.leaveTypes[0];

          const prioRaw = String(row['Priority'] || 'NORMAL').toUpperCase();
          const priority: 'NORMAL' | 'HIGH' | 'ESSENTIAL' =
            prioRaw === 'HIGH' || prioRaw === 'ESSENTIAL' ? prioRaw : 'NORMAL';

          imported.push({
            id: newId(),
            personId: matchedPerson.id,
            department: matchedPerson.department,
            subDepartment: matchedPerson.subDepartment,
            year: Number(rawFrom.slice(0, 4)) || year,
            quarter,
            proposedFrom: rawFrom,
            proposedTo: rawTo,
            plannedDays: daysBetween(rawFrom, rawTo),
            leaveTypeId: matchedType?.id || '',
            relieverName: String(row['Reliever'] || '').trim() || undefined,
            priority,
            remarks: String(row['Remarks'] || '').trim() || undefined,
            status: 'PLANNED',
            updatedAt: new Date().toISOString()
          });
        });

        if (imported.length > 0) {
          update(d => ({
            ...d,
            leaveForecasts: [...(d.leaveForecasts || []), ...imported]
          }));
          setUploadBanner(`Successfully collated ${imported.length} leave forecast requirement(s) from "${file.name}".`);
          setTimeout(() => setUploadBanner(null), 5000);
        } else {
          setUploadBanner('No matching personnel or valid YYYY-MM-DD dates found in uploaded sheet. Download the template to check column names.');
          setTimeout(() => setUploadBanner(null), 5000);
        }
      } catch (err) {
        console.error('Error importing forecast sheet:', err);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Populate availed edits when person changes
  const activeAvailedPerson = useMemo(() => {
    return db.personnel.find(p => p.id === selectedPersonForAvailed);
  }, [db.personnel, selectedPersonForAvailed]);

  const handleSelectPersonForAvailed = (personId: string) => {
    setSelectedPersonForAvailed(personId);
    setSaveSuccessMsg(null);
    if (!personId) {
      setAvailedEdits({});
      return;
    }
    const currentAdjustments = db.availedAdjustments?.[personId] || {};
    const initialEdits: Record<string, { days: number; remarks: string }> = {};
    db.leaveTypes.forEach(t => {
      initialEdits[t.id] = {
        days: currentAdjustments[t.id]?.days || 0,
        remarks: currentAdjustments[t.id]?.remarks || ''
      };
    });
    setAvailedEdits(initialEdits);
  };

  const handleSaveAvailedAdjustments = () => {
    if (!selectedPersonForAvailed) return;
    const person = db.personnel.find(p => p.id === selectedPersonForAvailed);
    if (!person) return;

    update(d => {
      const existing = { ...(d.availedAdjustments || {}) };
      const personRecord: Record<string, { days: number; remarks?: string; updatedAt?: string }> = {};
      Object.entries(availedEdits).forEach(([typeId, val]) => {
        if (val.days > 0 || val.remarks.trim()) {
          personRecord[typeId] = {
            days: Number(val.days) || 0,
            remarks: val.remarks.trim() || undefined,
            updatedAt: new Date().toISOString()
          };
        }
      });
      existing[selectedPersonForAvailed] = personRecord;
      return { ...d, availedAdjustments: existing };
    });

    setSaveSuccessMsg(`Baseline availed leave updated for ${person.rank} ${person.name}.`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const exportCollatedForecastCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Personal Number', 'Rank', 'Name', 'Department', 'Sub-Department', 'Quarter', 'Leave Type', 'Planned From', 'Planned To', 'Days', 'Reliever', 'Priority', 'Remarks']];
    departmentForecasts.forEach(f => {
      const p = db.personnel.find(x => x.id === f.personId);
      const t = db.leaveTypes.find(x => x.id === f.leaveTypeId);
      rows.push([
        p?.serviceNo,
        p?.rank,
        p?.name,
        p?.department,
        p?.subDepartment,
        f.quarter,
        t?.name,
        f.proposedFrom,
        f.proposedTo,
        f.plannedDays,
        f.relieverName || '',
        f.priority,
        f.remarks || ''
      ].map(esc));
    });
    downloadBlob('\uFEFF' + rows.map(r => r.join(',')).join('\r\n'), `collated_leave_forecast_${year}.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={bulkUploadRef}
        onChange={handleBulkUploadForecast}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      {/* Top Filter & Module Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-400 flex items-center gap-1.5 font-semibold">
            <span>Year:</span>
            <input
              type="number"
              className={`${inputCls} w-24 text-center font-bold font-mono`}
              value={year}
              min={2020}
              max={2035}
              onChange={e => e.target.value && setYear(+e.target.value)}
            />
          </label>

          <label className="text-xs text-slate-400 flex items-center gap-1.5 font-semibold">
            <span>Department:</span>
            <select
              className={`${inputCls} max-w-xs text-xs`}
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              aria-label="Filter department"
            >
              <option value="ALL">All Departments ({scope.length} personnel)</option>
              {DEPARTMENT_NAMES.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400 flex items-center gap-1.5 font-semibold">
            <span>Category:</span>
            <select
              className={`${inputCls} w-36 text-xs`}
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as 'ALL' | 'Officer' | 'Sailor')}
              aria-label="Filter category"
            >
              <option value="ALL">Officers & Sailors</option>
              <option value="Officer">Officers Only</option>
              <option value="Sailor">Sailors Only</option>
            </select>
          </label>

          {/* Toggle between Departmental Aggregated View & Individual View */}
          {onViewModeChange && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => onViewModeChange('DEPARTMENTAL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === 'DEPARTMENTAL' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Departmental View
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('INDIVIDUAL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === 'INDIVIDUAL' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Individual View
              </button>
            </div>
          )}

          {viewMode === 'INDIVIDUAL' && (
            <label className="text-xs text-slate-400 flex items-center gap-1.5 font-semibold">
              <span>Personnel:</span>
              <select
                className={`${inputCls} w-56 text-xs`}
                value={effectiveIndividualId}
                onChange={e => setSelectedIndividualId(e.target.value)}
                aria-label="Select Individual Personnel"
              >
                {deptScopedPeople.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.rank} {p.name} ({p.serviceNo}) · {p.department}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Sub-Tab Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('COLLATED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeSubTab === 'COLLATED'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Collated Matrix</span>
          </button>

          <button
            onClick={() => setActiveSubTab('CALENDAR')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeSubTab === 'CALENDAR'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Leave Calendar</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ANALYTICS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeSubTab === 'ANALYTICS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Charts & Combinations</span>
          </button>

          <button
            onClick={() => setActiveSubTab('AVAILED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeSubTab === 'AVAILED'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Update Availed</span>
          </button>
        </div>
      </div>

      {uploadBanner && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{uploadBanner}</span>
        </div>
      )}

      {/* SUB-TAB 1: COLLATED DEPARTMENT LEAVE FORECAST */}
      {activeSubTab === 'COLLATED' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-400" />
                <span>Departmental & Individual Leave Forecast Collator · {year}</span>
              </h3>
              <p className="text-xs text-slate-400">
                Each person can submit or upload their leave requirement individually, or departments can bulk-upload a collated Excel/CSV sheet.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadForecastTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                <span>Template (.xlsx)</span>
              </button>

              <button
                onClick={() => bulkUploadRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Upload Dept / Individual Sheet</span>
              </button>

              <button
                onClick={exportCollatedForecastCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>

              {canEdit && (
                <button
                  onClick={() => {
                    setForecastPersonId(people[0]?.id || '');
                    setIsAddForecastOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Forecast Entry</span>
                </button>
              )}
            </div>
          </div>

          {/* Department Manning Health Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {QUARTERS.map(q => {
              const qForecasts = departmentForecasts.filter(f => f.quarter === q);
              const totalDaysPlanned = qForecasts.reduce((acc, f) => acc + f.plannedDays, 0);
              const uniquePersonnelAway = new Set(qForecasts.map(f => f.personId)).size;
              const deptHeadcount = people.length;
              const percentAway = deptHeadcount ? Math.round((uniquePersonnelAway / deptHeadcount) * 100) : 0;
              const isWarning = percentAway > (db.maxLeavePctPerDept || 25);

              return (
                <div key={q} className={`p-3.5 rounded-xl border ${isWarning ? 'bg-amber-950/30 border-amber-800/60' : 'bg-slate-900/80 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-300">{q} Routine</span>
                    {isWarning ? (
                      <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Manning Alert ({percentAway}%)</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-300">
                        Watchkeeping OK ({percentAway}%)
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-xl font-bold font-mono tabular-nums text-white">{uniquePersonnelAway}</span>
                      <span className="text-xs text-slate-400"> of {deptHeadcount} planned</span>
                    </div>
                    <span className="font-mono tabular-nums text-xs text-slate-400 font-semibold">{totalDaysPlanned} person-days</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className={`h-full ${isWarning ? 'bg-amber-400' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, percentAway)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Multi-Person Visual Leave Cycle, Coverage Gaps & Aggregated Bar/Line Chart Strip */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <Card
              title={
                viewMode === 'INDIVIDUAL'
                  ? `Individual Monthly Leave Cycle & Forecast (${year})`
                  : `Departmental Leave Cycles & Coverage Gap Chart (${year})`
              }
              className="lg:col-span-7"
            >
              <div className="h-60" role="img" aria-label="Bar and line chart of monthly leave cycles and peak away">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyCombinationData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Approved" name="Approved (d)" stackId="a" fill="#10b981" />
                    <Bar dataKey="Pending" name="Pending (d)" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="PlannedForecast" name="Planned Forecast (d)" stackId="a" fill="#3b82f6" />
                    <Line type="monotone" dataKey="PeakPersonnelAway" name="Peak Concurrent Away" stroke="#f43f5e" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Coverage Gaps & Unrelieved Leave Windows" className="lg:col-span-5">
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 text-xs">
                {warn.length === 0 && departmentForecasts.filter(f => !f.relieverName).length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-300">
                    Zero coverage gaps detected. All planned leave windows have reliever coverage and stay within the {db.maxLeavePctPerDept}% departmental threshold.
                  </div>
                ) : (
                  <>
                    {warn.slice(0, 5).map((w, idx) => (
                      <div key={`warn-${idx}`} className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/60 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-amber-200">
                            {w.department} Coverage Gap · {Math.round(w.peakPct)}% Away
                          </div>
                          <div className="text-[11px] text-slate-300 font-mono">
                            {w.from} → {w.to} ({w.peakCount} of {w.headcount} away)
                          </div>
                        </div>
                      </div>
                    ))}
                    {departmentForecasts
                      .filter(f => !f.relieverName)
                      .slice(0, 6)
                      .map(f => {
                        const p = db.personnel.find(x => x.id === f.personId);
                        return (
                          <div key={f.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                            <div>
                              <span className="font-semibold text-white">{p ? `${p.rank} ${p.name}` : f.personId}</span>
                              <span className="block text-[10px] font-mono text-slate-400">
                                {f.proposedFrom} → {f.proposedTo} ({f.quarter})
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-rose-400 whitespace-nowrap">
                              No Reliever Named
                            </span>
                          </div>
                        );
                      })}
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Collated Matrix Table */}
          <Card title={`Personnel Leave Forecast Matrix (${people.length} personnel)`}>
            {people.length === 0 ? (
              <Empty>No personnel found in the selected department/category.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/80 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Personnel</th>
                      <th className="px-3">Branch / Section</th>
                      <th className="px-3">Q1 (Jan-Mar)</th>
                      <th className="px-3">Q2 (Apr-Jun)</th>
                      <th className="px-3">Q3 (Jul-Sep)</th>
                      <th className="px-3">Q4 (Oct-Dec)</th>
                      <th className="px-3 text-right">Total Planned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {people.map(p => {
                      const personForecasts = departmentForecasts.filter(f => f.personId === p.id);
                      const totalDays = personForecasts.reduce((a, b) => a + b.plannedDays, 0);

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-100">
                              {p.rank} {p.name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {p.serviceNo} · {p.category}
                            </div>
                          </td>
                          <td className="px-3 text-slate-400">
                            <div>{p.department}</div>
                            <div className="text-[10px] text-slate-500">{p.subDepartment || 'General'}</div>
                          </td>

                          {QUARTERS.map(q => {
                            const entries = personForecasts.filter(f => f.quarter === q);
                            return (
                              <td key={q} className="px-3 align-top py-2.5">
                                {entries.length === 0 ? (
                                  <span className="text-slate-600 font-mono text-[11px]">—</span>
                                ) : (
                                  <div className="space-y-1.5">
                                    {entries.map(e => {
                                      const type = db.leaveTypes.find(t => t.id === e.leaveTypeId);
                                      return (
                                        <div
                                          key={e.id}
                                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-[11px] space-y-0.5 group relative"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-semibold text-blue-300">{type?.name || 'Leave'}</span>
                                            <span className="font-mono text-emerald-400 font-bold">{e.plannedDays}d</span>
                                          </div>
                                          <div className="text-[10px] font-mono text-slate-400">{e.proposedFrom} → {e.proposedTo}</div>
                                          {e.relieverName && (
                                            <div className="text-[9px] text-purple-300">Reliever: {e.relieverName}</div>
                                          )}
                                          {canEdit && (
                                            <button
                                              onClick={() => handleDeleteForecast(e.id)}
                                              title="Delete planned forecast"
                                              className="absolute right-1 top-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                            >
                                              ✕
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          <td className="px-3 text-right font-mono tabular-nums font-bold text-slate-200">
                            {totalDays > 0 ? (
                              <span className="text-blue-300">{totalDays} days</span>
                            ) : (
                              <span className="text-slate-600 text-xs">0d</span>
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

      {/* SUB-TAB 2: INTERACTIVE LEAVE FORECAST & MANNING CALENDAR */}
      {activeSubTab === 'CALENDAR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Leave & Forecast Overlap Calendar — {FULL_MONTHS[calendarMonth]} {year}
                </h3>
                <p className="text-xs text-slate-400">
                  Combines Approved Leave, Pending Requests, and Planned Departmental Forecast to highlight daily manning density.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCalendarMonth(m => (m === 0 ? 11 : m - 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={calendarMonth}
                  onChange={e => setCalendarMonth(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  {FULL_MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>{m} {year}</option>
                  ))}
                </select>
                <button
                  onClick={() => setCalendarMonth(m => (m === 11 ? 0 : m + 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDaysGrid.map((cell, idx) => {
                if (!cell.dateStr) {
                  return <div key={`empty-${idx}`} className="h-24 rounded-xl bg-slate-950/30 border border-slate-800/30" />;
                }
                const isSelected = cell.dateStr === selectedCalDate;
                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => setSelectedCalDate(cell.dateStr!)}
                    className={`h-24 p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-500 ring-1 ring-blue-500'
                        : cell.isClashWarning
                          ? 'bg-amber-950/30 border-amber-700/70 hover:bg-amber-950/50'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono font-bold text-xs text-white">{cell.dayNum}</span>
                      {cell.isClashWarning && (
                        <span title="Exceeds manning threshold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        </span>
                      )}
                    </div>

                    {cell.totalAway > 0 ? (
                      <div className="space-y-0.5 text-[10px] font-mono tabular-nums">
                        {cell.approvedCount > 0 && (
                          <div className="text-emerald-400 font-semibold">{cell.approvedCount} Approved</div>
                        )}
                        {cell.pendingCount > 0 && (
                          <div className="text-amber-400">{cell.pendingCount} Pending</div>
                        )}
                        {cell.forecastCount > 0 && (
                          <div className="text-blue-400">{cell.forecastCount} Forecast</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600 font-mono">100% Manned</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Day Inspector */}
          <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4 self-start">
            <div>
              <h3 className="text-sm font-bold text-white font-mono">
                Date Inspector · {selectedCalDate}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedDayDetails.length} personnel away or forecasted on this date (out of {people.length} in current view).
              </p>
            </div>

            {selectedDayDetails.length === 0 ? (
              <Empty>All personnel in the selected scope are onboard on {selectedCalDate}.</Empty>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {selectedDayDetails.map((item, idx) => {
                  const p = db.personnel.find(x => x.id === item.personId);
                  return (
                    <div
                      key={`${item.personId}-${item.mode}-${idx}`}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">
                          {p ? `${p.rank} ${p.name}` : item.personId}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            item.mode === 'APPROVED'
                              ? 'text-emerald-400'
                              : item.mode === 'PENDING'
                                ? 'text-amber-400'
                                : 'text-blue-400'
                          }`}
                        >
                          {item.mode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {p?.department} ({p?.subDepartment || 'General'}) · {item.leaveTypeName}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {item.from} → {item.to}
                        {item.reliever ? ` · Reliever: ${item.reliever}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: MULTI-COMBINATION CHARTS & MANNING ANALYTICS */}
      {activeSubTab === 'ANALYTICS' && (
        <div className="space-y-6">
          {warn.length > 0 && (
            <Card title={`Manpower warnings (more than ${db.maxLeavePctPerDept}% of a department away)`}>
              <ul className="space-y-1 text-xs">
                {warn.slice(0, 12).map((w, i) => (
                  <li key={i} className="text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      <strong className="font-semibold text-white">{w.department}</strong> · {w.from === w.to ? w.from : `${w.from} to ${w.to}`} · up to {w.peakCount} of {w.headcount} away ({Math.round(w.peakPct)}%)
                    </span>
                  </li>
                ))}
                {warn.length > 12 && <li className="text-slate-500">+{warn.length - 12} more</li>}
              </ul>
            </Card>
          )}

          {/* Chart Row 1: Monthly Combined ComposedChart (Approved + Pending + Planned Forecast + Peak) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title={`Combined Monthly Leave & Forecast Load (${year})`} className="lg:col-span-2">
              <div className="h-72" role="img" aria-label="Composed chart of approved, pending, and planned forecast leave days per month">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyCombinationData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Approved" name="Approved Leave (d)" stackId="a" fill="#10b981" />
                    <Bar dataKey="Pending" name="Pending Approval (d)" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="PlannedForecast" name="Planned Forecast (d)" stackId="a" fill="#3b82f6" />
                    <Line type="monotone" dataKey="PeakPersonnelAway" name="Peak Daily Away" stroke="#f43f5e" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title={`On leave today (${awayToday.length})`}>
              {awayToday.length === 0 ? (
                <Empty>No one is on approved leave today.</Empty>
              ) : seesNames ? (
                <ul className="space-y-2 text-xs max-h-64 overflow-y-auto pr-1">
                  {awayToday.map(r => {
                    const p = db.personnel.find(x => x.id === r.personId);
                    return (
                      <li key={r.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-slate-200 font-semibold">{p?.rank} {p?.name}</span>
                          <span className="block text-[10px] text-slate-500 font-mono">{p?.department}</span>
                        </div>
                        <span className="text-[11px] font-mono text-amber-300">Until {r.to}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-slate-300">{awayToday.length} on approved leave today.</p>
              )}
            </Card>
          </div>

          {/* Chart Row 2: Departmental Comparison & Quarterly Priority / Category Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Department-Wise Leave & Forecast Comparison (Person-Days)">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentComparisonData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="department" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Approved" name="Approved Days" fill="#10b981" />
                    <Bar dataKey="Pending" name="Pending Days" fill="#f59e0b" />
                    <Bar dataKey="PlannedForecast" name="Forecasted Days" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Quarterly Forecast Priority & Category Combination">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={quarterBreakdownData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="quarter" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Normal" name="Normal Routine (d)" stackId="p" fill="#3b82f6" />
                    <Bar dataKey="HighPriority" name="High Priority (d)" stackId="p" fill="#f59e0b" />
                    <Bar dataKey="Essential" name="Essential / Refit (d)" stackId="p" fill="#ec4899" />
                    <Line type="monotone" dataKey="Officers" name="Officers Planned" stroke="#a855f7" strokeWidth={2} />
                    <Line type="monotone" dataKey="Sailors" name="Sailors Planned" stroke="#14b8a6" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Individual Balances */}
          {seesNames && (
            <Card title="Personnel Leave Balances Summary">
              {people.length === 0 ? (
                <Empty>No personnel to show.</Empty>
              ) : (
                <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1">
                  {people.map(p => {
                    const bal = balances(db, p.id, year, today).filter(b => b.entitled != null);
                    const pend = db.leaveRequests.filter(r => r.personId === p.id && r.status.startsWith('PENDING')).length;
                    return (
                      <div key={p.id} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>{p.rank} {p.name} <span className="font-normal text-slate-500">· {p.department} ({p.serviceNo})</span></span>
                          {pend > 0 && <span className="text-[10px] text-amber-400 font-normal">{pend} pending request(s)</span>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {bal.map(b => (
                            <BalanceBar key={b.typeId} b={b} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* SUB-TAB 4: UPDATE ALREADY AVAILED LEAVES */}
      {activeSubTab === 'AVAILED' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>Update Previously Availed Leaves & Baseline Records</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Record historical leave taken (e.g. during refit, prior to digital onboarding, or manually sanctioned leave) for any sailor or officer.
              The system factors these directly into annual balances.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title="Select Personnel to Update" className="lg:col-span-1">
              <div className="space-y-4">
                <Field label="Personnel from Nominal Roll">
                  <select
                    className={inputCls}
                    value={selectedPersonForAvailed}
                    onChange={e => handleSelectPersonForAvailed(e.target.value)}
                  >
                    <option value="">Choose officer or sailor…</option>
                    {people.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.rank} {p.name} ({p.serviceNo}) · {p.department}
                      </option>
                    ))}
                  </select>
                </Field>

                {activeAvailedPerson && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
                    <div className="font-bold text-white text-sm">
                      {activeAvailedPerson.rank} {activeAvailedPerson.name}
                    </div>
                    <div className="text-slate-400">
                      Personal No: <span className="font-mono text-slate-200">{activeAvailedPerson.serviceNo}</span>
                    </div>
                    <div className="text-slate-400">
                      Branch: <span className="text-blue-300">{activeAvailedPerson.department}</span> ({activeAvailedPerson.subDepartment || 'General'})
                    </div>
                    <div className="text-slate-400">
                      Category: <span className="text-slate-200 font-semibold">{activeAvailedPerson.category}</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card title="Baseline & Manual Availed Days" className="lg:col-span-2">
              {!activeAvailedPerson ? (
                <Empty>Select an officer or sailor on the left to review and update availed leave records.</Empty>
              ) : (
                <div className="space-y-4">
                  {saveSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{saveSuccessMsg}</span>
                    </div>
                  )}

                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/80 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Leave Type</th>
                        <th className="px-3">Entitled</th>
                        <th className="px-3">System Taken</th>
                        <th className="px-3 w-32">Manual Availed Days</th>
                        <th className="px-3">Audit Remarks</th>
                        <th className="px-3 text-right">Net Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {db.leaveTypes.map(t => {
                        const bal = balances(db, activeAvailedPerson.id, year, today).find(b => b.typeId === t.id);
                        const currentVal = availedEdits[t.id] || { days: 0, remarks: '' };

                        return (
                          <tr key={t.id}>
                            <td className="py-3 px-3 font-semibold text-white">{t.name}</td>
                            <td className="px-3 font-mono text-slate-400">{t.annualDays == null ? 'Uncapped' : `${t.annualDays}d`}</td>
                            <td className="px-3 font-mono text-slate-400">{bal ? bal.availed - (db.availedAdjustments?.[activeAvailedPerson.id]?.[t.id]?.days || 0) : 0}d</td>
                            <td className="px-3">
                              <input
                                type="number"
                                min={0}
                                max={t.annualDays || 365}
                                value={currentVal.days}
                                onChange={e => {
                                  const v = Math.max(0, +e.target.value || 0);
                                  setAvailedEdits(prev => ({
                                    ...prev,
                                    [t.id]: { ...(prev[t.id] || { remarks: '' }), days: v }
                                  }));
                                }}
                                className={`${inputCls} w-24 text-center font-mono font-bold`}
                              />
                            </td>
                            <td className="px-3">
                              <input
                                type="text"
                                placeholder="e.g. Availed during refit / baseline"
                                value={currentVal.remarks}
                                onChange={e => {
                                  const r = e.target.value;
                                  setAvailedEdits(prev => ({
                                    ...prev,
                                    [t.id]: { ...(prev[t.id] || { days: 0 }), remarks: r }
                                  }));
                                }}
                                className={`${inputCls} w-full text-xs`}
                              />
                            </td>
                            <td className="px-3 text-right font-mono font-bold">
                              {bal?.available == null ? (
                                <span className="text-slate-500">—</span>
                              ) : (
                                <span className={bal.available > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                  {bal.available} days
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                    <button
                      onClick={handleSaveAvailedAdjustments}
                      className={`${btnPrimary} flex items-center gap-1.5`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Availed Leave Adjustment</span>
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Department Leave Forecast */}
      {isAddForecastOpen && (
        <Modal title="Add Department Planned Leave Forecast" onClose={() => setIsAddForecastOpen(false)}>
          <div className="space-y-4">
            <Field label="Personnel">
              <select
                className={inputCls}
                value={forecastPersonId}
                onChange={e => setForecastPersonId(e.target.value)}
              >
                {people.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.rank} {p.name} ({p.serviceNo}) · {p.department}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Quarter">
                <select
                  className={inputCls}
                  value={forecastQuarter}
                  onChange={e => setForecastQuarter(e.target.value as 'Q1' | 'Q2' | 'Q3' | 'Q4')}
                >
                  <option value="Q1">Q1 (Jan – Mar)</option>
                  <option value="Q2">Q2 (Apr – Jun)</option>
                  <option value="Q3">Q3 (Jul – Sep)</option>
                  <option value="Q4">Q4 (Oct – Dec)</option>
                </select>
              </Field>

              <Field label="Leave Type">
                <select
                  className={inputCls}
                  value={forecastTypeId}
                  onChange={e => setForecastTypeId(e.target.value)}
                >
                  {db.leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Proposed Start Date">
                <input
                  type="date"
                  className={inputCls}
                  value={forecastFrom}
                  onChange={e => {
                    setForecastFrom(e.target.value);
                    if (!forecastTo || forecastTo < e.target.value) setForecastTo(e.target.value);
                  }}
                />
              </Field>

              <Field label="Proposed End Date">
                <input
                  type="date"
                  className={inputCls}
                  min={forecastFrom}
                  value={forecastTo}
                  onChange={e => setForecastTo(e.target.value)}
                />
              </Field>
            </div>

            {forecastFrom && forecastTo && (
              <div className="text-xs font-mono text-blue-300">
                Planned duration: {daysBetween(forecastFrom, forecastTo)} calendar days
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Reliever / Handover Personnel">
                <input
                  type="text"
                  placeholder="e.g. PO Vikram Singh"
                  className={inputCls}
                  value={forecastReliever}
                  onChange={e => setForecastReliever(e.target.value)}
                />
              </Field>

              <Field label="Priority">
                <select
                  className={inputCls}
                  value={forecastPriority}
                  onChange={e => setForecastPriority(e.target.value as 'NORMAL' | 'HIGH' | 'ESSENTIAL')}
                >
                  <option value="NORMAL">Normal Routine</option>
                  <option value="HIGH">High (Domestic / Family)</option>
                  <option value="ESSENTIAL">Essential (Annual Refit)</option>
                </select>
              </Field>
            </div>

            <Field label="Remarks & Justification">
              <input
                type="text"
                placeholder="e.g. Planned wedding leave / examination leave"
                className={inputCls}
                value={forecastRemarks}
                onChange={e => setForecastRemarks(e.target.value)}
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setIsAddForecastOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={!forecastPersonId || !forecastFrom || !forecastTo}
                onClick={handleSaveForecast}
              >
                Save Planned Forecast
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
