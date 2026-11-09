/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Zap,
  X,
  Plus,
  Upload,
  Printer,
  Download,
  Calendar,
  Sliders,
  FileText,
  Shield
} from 'lucide-react';

interface TrainingQuickActionsFABProps {
  onOpenAddSession: () => void;
  onOpenIngestion: () => void;
  onOpenBulletinPdf: () => void;
  onOpenExportRange: () => void;
  onOpenDailyOrders: () => void;
  onOpenSettings: () => void;
  canEdit: boolean;
  isAdmin?: boolean;
}

export const TrainingQuickActionsFAB: React.FC<TrainingQuickActionsFABProps> = ({
  onOpenAddSession,
  onOpenIngestion,
  onOpenBulletinPdf,
  onOpenExportRange,
  onOpenDailyOrders,
  onOpenSettings,
  canEdit,
  isAdmin = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    ...(canEdit ? [
      {
        id: 'add',
        label: 'Add Session',
        desc: 'New repeating or single topic',
        icon: Plus,
        color: 'bg-emerald-600 hover:bg-emerald-500 text-white',
        onClick: () => { setIsOpen(false); onOpenAddSession(); }
      },
      {
        id: 'upload',
        label: 'Bulk Upload Schedule',
        desc: 'Excel / CSV topic ingestion',
        icon: Upload,
        color: 'bg-blue-600 hover:bg-blue-500 text-white',
        onClick: () => { setIsOpen(false); onOpenIngestion(); }
      }
    ] : []),
    {
      id: 'daily',
      label: 'Daily Orders Training',
      desc: 'Tomorrow’s Gunnery extract',
      icon: Shield,
      color: 'bg-cyan-600 hover:bg-cyan-500 text-white',
      onClick: () => { setIsOpen(false); onOpenDailyOrders(); }
    },
    {
      id: 'bulletin',
      label: 'Generate PDF Report',
      desc: 'Ship Notice Board Bulletin',
      icon: Printer,
      color: 'bg-purple-600 hover:bg-purple-500 text-white',
      onClick: () => { setIsOpen(false); onOpenBulletinPdf(); }
    },
    {
      id: 'export',
      label: 'Export Calendar Range',
      desc: 'Excel, PDF, or Image',
      icon: Download,
      color: 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold',
      onClick: () => { setIsOpen(false); onOpenExportRange(); }
    },
    ...(canEdit ? [
      {
        id: 'settings',
        label: 'Schedule Timings',
        desc: 'Working days & hours',
        icon: Sliders,
        color: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
        onClick: () => { setIsOpen(false); onOpenSettings(); }
      }
    ] : [])
  ];

  return (
    <div className="fixed bottom-6 right-6 z-[130] no-print flex flex-col items-end">
      {/* Expanded Speed-Dial Menu */}
      {isOpen && (
        <div className="mb-3 space-y-2 flex flex-col items-end animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold pr-1">
            Training Quick Actions
          </div>
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={action.onClick}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl hover:border-slate-500 transition-all group text-left"
              >
                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                    {action.label}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {action.desc}
                  </span>
                </div>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${action.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Quick Actions"
        aria-expanded={isOpen}
        className={`w-13 h-13 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-90 ${
          isOpen
            ? 'bg-rose-600 hover:bg-rose-500 text-white rotate-90'
            : 'bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-500 hover:from-blue-600 hover:to-cyan-400 text-white shadow-blue-500/30'
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
      </button>
    </div>
  );
};
