/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { usePortal } from './store';
import { trainingKey } from './registry';
import { DEPARTMENT_NAMES } from '../data/departments';
import { downloadBlob } from '../utils/exporters';
import { useOnlineStatus } from '../utils/usePWAInstall';
import { PWAInstallButton } from '../components/PWAInstallButton';
import type {
  DepartmentLeaveForecastEntry,
  LeaveRequest,
  Person,
  SpecialParty,
  WatchStationAssignment
} from './types';
import type { ScheduledSession } from '../types';
import {
  HardDriveDownload,
  HardDriveUpload,
  Wifi,
  WifiOff,
  CheckCircle2,
  RefreshCw,
  Server,
  ShieldCheck
} from 'lucide-react';

interface DepartmentalSyncPacket {
  packetVersion: '1.0';
  exportedAt: string;
  shipId: string;
  shipName: string;
  sourceDepartment: string;
  exportedBy: string;
  personnel: Person[];
  leaveRequests: LeaveRequest[];
  leaveForecasts: DepartmentLeaveForecastEntry[];
  watchStationBill: WatchStationAssignment[];
  specialParties: SpecialParty[];
  trainingSessions: ScheduledSession[];
}

export const LanSyncManager: React.FC = () => {
  const { db, ship, shipId, user, update, hasPendingLanSync, pendingLanSyncCount, lastLanSyncAt, markLanSynced } = usePortal();
  const isOnline = useOnlineStatus();
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [mergeSummary, setMergeSummary] = useState<string[] | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportSyncPacket = () => {
    const tKey = trainingKey(shipId);
    let trainingSessions: ScheduledSession[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(tKey) || 'null');
      if (raw && Array.isArray(raw.sessions)) {
        trainingSessions = raw.sessions;
      }
    } catch {
      // ignore
    }

    const filterByDept = (dept?: string) =>
      selectedDept === 'ALL' || !dept || dept.toLowerCase() === selectedDept.toLowerCase();

    const deptPersonnel = db.personnel.filter(p => filterByDept(p.department));
    const deptPersonIds = new Set(deptPersonnel.map(p => p.id));

    const packet: DepartmentalSyncPacket = {
      packetVersion: '1.0',
      exportedAt: new Date().toISOString(),
      shipId,
      shipName: ship.name,
      sourceDepartment: selectedDept,
      exportedBy: user?.displayName || 'Ship Terminal',
      personnel: deptPersonnel,
      leaveRequests: db.leaveRequests.filter(r => deptPersonIds.has(r.personId)),
      leaveForecasts: (db.leaveForecasts || []).filter(f => deptPersonIds.has(f.personId) || filterByDept(f.department)),
      watchStationBill: Object.values(db.watchStationBill || {}).filter(w => deptPersonIds.has(w.personId)),
      specialParties: db.specialParties || [],
      trainingSessions: trainingSessions.filter(
        s => selectedDept === 'ALL' || s.department === 'All / Ship-Wide' || filterByDept(s.department)
      )
    };

    const deptSlug = selectedDept === 'ALL' ? 'FULL_SHIP' : selectedDept.toUpperCase().replace(/\s+/g, '_');
    const dateSlug = new Date().toISOString().slice(0, 10);
    downloadBlob(
      JSON.stringify(packet, null, 2),
      `${ship.name.replace(/\s+/g, '_')}_LAN_SYNC_${deptSlug}_${dateSlug}.json`,
      'application/json;charset=utf-8'
    );
    markLanSynced();
  };

  const handleImportAndMergePacket = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMergeSummary(null);
    setMergeError(null);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const packet = JSON.parse(String(evt.target?.result || '{}')) as Partial<DepartmentalSyncPacket>;
        if (!packet || packet.packetVersion !== '1.0') {
          setMergeError('Invalid sync packet file. Expected a valid Ship LAN Sync JSON packet.');
          return;
        }

        let addedOrUpdatedPersonnel = 0;
        let addedOrUpdatedLeaveReqs = 0;
        let addedOrUpdatedForecasts = 0;
        let addedOrUpdatedWatchbill = 0;
        let mergedTrainingMusters = 0;

        update(d => {
          // 1. Merge Personnel by id or serviceNo
          const nextPersonnel = [...d.personnel];
          (packet.personnel || []).forEach(inc => {
            const idx = nextPersonnel.findIndex(p => p.id === inc.id || p.serviceNo === inc.serviceNo);
            if (idx >= 0) {
              nextPersonnel[idx] = { ...nextPersonnel[idx], ...inc };
            } else {
              nextPersonnel.push(inc);
            }
            addedOrUpdatedPersonnel++;
          });

          // 2. Merge Leave Requests by id (prefer newer history length)
          const nextLeaveRequests = [...d.leaveRequests];
          (packet.leaveRequests || []).forEach(inc => {
            const idx = nextLeaveRequests.findIndex(r => r.id === inc.id);
            if (idx >= 0) {
              if ((inc.history?.length || 0) >= (nextLeaveRequests[idx].history?.length || 0)) {
                nextLeaveRequests[idx] = inc;
                addedOrUpdatedLeaveReqs++;
              }
            } else {
              nextLeaveRequests.push(inc);
              addedOrUpdatedLeaveReqs++;
            }
          });

          // 3. Merge Leave Forecasts by id or (personId + proposedFrom)
          const nextForecasts = [...(d.leaveForecasts || [])];
          (packet.leaveForecasts || []).forEach(inc => {
            const idx = nextForecasts.findIndex(
              f => f.id === inc.id || (f.personId === inc.personId && f.proposedFrom === inc.proposedFrom)
            );
            if (idx >= 0) {
              nextForecasts[idx] = inc;
            } else {
              nextForecasts.push(inc);
            }
            addedOrUpdatedForecasts++;
          });

          // 4. Merge Watch & Station Bill by personId (Record<string, WatchStationAssignment>)
          const nextWatchbill: Record<string, WatchStationAssignment> = { ...(d.watchStationBill || {}) };
          (packet.watchStationBill || []).forEach(inc => {
            if (inc && inc.personId) {
              nextWatchbill[inc.personId] = inc;
              addedOrUpdatedWatchbill++;
            }
          });

          // 5. Merge Special Parties by id
          const nextParties = [...(d.specialParties || [])];
          (packet.specialParties || []).forEach(inc => {
            const idx = nextParties.findIndex(sp => sp.id === inc.id);
            if (idx >= 0) {
              nextParties[idx] = inc;
            } else {
              nextParties.push(inc);
            }
          });

          return {
            ...d,
            personnel: nextPersonnel,
            leaveRequests: nextLeaveRequests,
            leaveForecasts: nextForecasts,
            watchStationBill: nextWatchbill,
            specialParties: nextParties
          };
        });

        // 6. Merge Training Sessions & Attendance Musters in localStorage
        if (Array.isArray(packet.trainingSessions) && packet.trainingSessions.length > 0) {
          const tKey = trainingKey(shipId);
          try {
            const currentTraining = JSON.parse(localStorage.getItem(tKey) || 'null') || {};
            const currentSessions: ScheduledSession[] = Array.isArray(currentTraining.sessions)
              ? [...currentTraining.sessions]
              : [];

            packet.trainingSessions.forEach(incSession => {
              const idx = currentSessions.findIndex(s => s.id === incSession.id);
              if (idx >= 0) {
                currentSessions[idx] = {
                  ...currentSessions[idx],
                  ...incSession,
                  attendanceMuster: incSession.attendanceMuster || currentSessions[idx].attendanceMuster
                };
              } else {
                currentSessions.push(incSession);
              }
              mergedTrainingMusters++;
            });

            localStorage.setItem(
              tKey,
              JSON.stringify({
                ...currentTraining,
                sessions: currentSessions,
                lastSaved: new Date().toISOString()
              })
            );
          } catch (err) {
            console.warn('Could not merge training sessions:', err);
          }
        }

        setMergeSummary([
          `Source: ${packet.shipName || ship.name} · ${packet.sourceDepartment || 'Department'} (${packet.exportedBy || 'Terminal'})`,
          `${addedOrUpdatedPersonnel} Nominal Roll record(s) synchronized`,
          `${addedOrUpdatedForecasts} Leave Forecast requirement(s) merged`,
          `${addedOrUpdatedLeaveReqs} Leave Application(s) updated`,
          `${addedOrUpdatedWatchbill} Watch & Station Bill assignment(s) merged`,
          `${mergedTrainingMusters} Training Session & Attendance Muster(s) merged`
        ]);
        markLanSynced();
      } catch (err) {
        console.error(err);
        setMergeError('Could not parse the selected JSON sync file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportAndMergePacket}
        accept=".json"
        className="hidden"
      />

      {/* Pending Data Update Detection Banner */}
      <div
        className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
          hasPendingLanSync
            ? 'bg-emerald-950/35 border-emerald-500/50 text-emerald-200'
            : 'bg-slate-900/70 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2.5 text-xs">
          {hasPendingLanSync ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>
                <strong>{pendingLanSyncCount} new local data update{pendingLanSyncCount === 1 ? '' : 's'} detected</strong> — Export a LAN Sync packet below to synchronize other shipboard PCs.
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                All local changes marked synchronized{lastLanSyncAt ? ` · Last synced at ${new Date(lastLanSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.
              </span>
            </>
          )}
        </div>
        {hasPendingLanSync && (
          <button
            onClick={markLanSynced}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            Dismiss Pulse / Mark Synced
          </button>
        )}
      </div>

      {/* Top Sea/Harbour Mode & PWA Status Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isOnline
                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                : 'bg-amber-950/60 border-amber-700/60 text-amber-400'
            }`}
          >
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{isOnline ? 'Harbour / LAN Connected Mode' : 'Sea Mode (Air-Gapped Offline Operation)'}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                PWA Service Worker Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              All Nominal Roll, Watch & Station Bill, Daily Orders, Leave Forecasts, and Training Musters are cached locally for 100% offline execution at sea.
            </p>
          </div>
        </div>

        <PWAInstallButton />
      </div>

      {/* Multi-PC LAN / Thumb-Drive Department Sync Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Export Department Sync Packet */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
              <HardDriveDownload className="w-4 h-4" />
              <span>Step 1 · Export Department Terminal Packet</span>
            </div>
            <h3 className="text-base font-bold text-white">
              Generate Departmental Sync Package (.json)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export your department's Leave Forecast, Leave Requests, Watch & Station Bill updates, and Training Attendance Musters to transfer via Ship LAN share or USB drive to the Gunnery / EXO Master Terminal.
            </p>

            <div className="pt-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Select Department Scope to Export
              </label>
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
              >
                <option value="ALL">Full Ship Master Snapshot (All Departments)</option>
                {DEPARTMENT_NAMES.map(d => (
                  <option key={d} value={d}>
                    {d} Department Packet Only
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportSyncPacket}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>Download Sync Packet ({selectedDept === 'ALL' ? 'Full Ship' : selectedDept})</span>
          </button>
        </div>

        {/* Card 2: Smart Merge Department Packet into Master Terminal */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <HardDriveUpload className="w-4 h-4" />
              <span>Step 2 · Smart-Merge Into Gunnery / EXO Master</span>
            </div>
            <h3 className="text-base font-bold text-white">
              Import & Non-Destructive Department Merge
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Select a `.json` sync packet received from Engineering, Electrical, Logistics, or Executive offices. Smart-Merge updates only the incoming records without overwriting other departments' data.
            </p>

            {mergeError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs">
                {mergeError}
              </div>
            )}

            {mergeSummary && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>LAN Sync Packet Merged Successfully</span>
                </div>
                <ul className="pl-5 list-disc space-y-0.5 text-[11px] text-emerald-100/90">
                  {mergeSummary.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <HardDriveUpload className="w-4 h-4" />
            <span>Select Departmental Sync Packet (.json) to Merge</span>
          </button>
        </div>
      </div>
    </div>
  );
};
