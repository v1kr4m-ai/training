/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Standalone Single-File Offline Entry Point for the TUSHIL Training Module.
 * This file is bundled with all styles and dependencies into `tushil-training-offline.html`
 * so the entire Training Module can run 100% offline from a single HTML file (`file://`).
 */

import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ShipsProvider, useShips } from './portal/ships';
import { PortalProvider, usePortal } from './portal/store';
import { ShipSwitcher } from './portal/ShipSwitcher';
import { trainingKey } from './portal/registry';
import { TrainingModule } from './training/TrainingModule';
import { GraduationCap, ShieldCheck, Eye, Download, Upload, HardDrive } from 'lucide-react';

const StandaloneTrainingShell: React.FC = () => {
  const { shipId, ship } = usePortal();
  const [isAdminMode, setIsAdminMode] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExportAllOfflineData = () => {
    const payload: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        payload[k] = localStorage.getItem(k);
      }
    }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ship: ship.name, storage: payload }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ship.name.toLowerCase().replace(/\s+/g, '-')}-training-offline-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Full offline state exported to JSON');
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleImportOfflineData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const storage = parsed?.storage || parsed;
        if (storage && typeof storage === 'object') {
          Object.entries(storage).forEach(([k, v]) => {
            if (typeof v === 'string') {
              localStorage.setItem(k, v);
            }
          });
          setStatusMsg('Offline backup restored — reloading…');
          setTimeout(() => window.location.reload(), 600);
        }
      } catch {
        setStatusMsg('Invalid backup JSON file');
        setTimeout(() => setStatusMsg(null), 3500);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#0a0c0f] text-slate-100 antialiased">
      {/* Standalone Single-File Offline Top Utility Bar */}
      <div className="bg-slate-950/95 border-b border-slate-800/90 px-4 py-2 no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-tight text-white">{ship.name} · Standalone Training Module</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <HardDrive className="w-3 h-3" />
                  Single-File Offline HTML
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Runs 100% offline in any browser · All schedules, nominal roll &amp; training records persist locally
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {statusMsg && (
              <span className="text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2.5 py-1 rounded-lg">
                {statusMsg}
              </span>
            )}

            <ShipSwitcher />

            {/* Toggle Admin / Crew Read-Only Mode */}
            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isAdminMode
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="Switch between Full Admin Planner and Read-Only Crew View"
            >
              {isAdminMode ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Mode: Admin / Planner</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mode: Crew Read-Only</span>
                </>
              )}
            </button>

            {/* Full Offline State Backup / Restore */}
            <button
              onClick={handleExportAllOfflineData}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Export all offline Training & Ship data to a JSON file for USB transfer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Backup JSON</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Restore offline Training & Ship data from a JSON backup file"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Restore JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportOfflineData}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Main Training Module */}
      <TrainingModule
        key={`${shipId}-${isAdminMode ? 'admin' : 'readonly'}`}
        storageKey={trainingKey(shipId)}
        canEdit={isAdminMode}
        isAdmin={isAdminMode}
      />
    </div>
  );
};

const StandaloneWorkspace: React.FC = () => {
  const { active } = useShips();
  return (
    <PortalProvider key={active.id} ship={active}>
      <StandaloneTrainingShell />
    </PortalProvider>
  );
};

export function StandaloneTrainingApp() {
  return (
    <ShipsProvider>
      <StandaloneWorkspace />
    </ShipsProvider>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <StandaloneTrainingApp />
    </React.StrictMode>
  );
}
