/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ScheduledSession } from '../types';
import { usePortal } from '../portal/store';
import { trainingKey } from '../portal/registry';
import { readTraining } from '../training/trainingStorage';
import { formatDate } from '../utils/scheduler';
import { 
  FileText, 
  Calendar, 
  Clock, 
  Copy, 
  Printer, 
  RefreshCw, 
  Check, 
  Building2, 
  Download,
  Shield,
  Layers,
  MapPin,
  UserCheck
} from 'lucide-react';

interface DailyOrdersPublisherProps {
  embedded?: boolean;
  onClose?: () => void;
  sessionsOverride?: ScheduledSession[];
}

export const DailyOrdersPublisher: React.FC<DailyOrdersPublisherProps> = ({
  embedded = false,
  onClose,
  sessionsOverride
}) => {
  const { ship, shipId } = usePortal();

  // Next day calculation
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  }, []);

  const [targetDate, setTargetDate] = useState(tomorrowStr);
  const [copied, setCopied] = useState(false);

  // Read sessions for this ship
  const allSessions = useMemo(() => {
    if (sessionsOverride && sessionsOverride.length > 0) return sessionsOverride;
    const sessions = readTraining(trainingKey(shipId))?.sessions;
    return Array.isArray(sessions) ? (sessions as ScheduledSession[]) : [];
  }, [shipId, sessionsOverride]);

  // Filter sessions for targetDate
  const nextDaySessions = useMemo(() => {
    return allSessions
      .filter(s => s.date === targetDate && s.status !== 'Cancelled')
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [allSessions, targetDate]);

  // Pull / Refresh action
  const [lastPulled, setLastPulled] = useState(new Date().toLocaleTimeString());
  const handlePullTraining = () => {
    setLastPulled(new Date().toLocaleTimeString());
  };

  // Copy Daily Order table to clipboard in clean naval typography
  const handleCopyDailyOrder = () => {
    const lines = [
      `================================================================================`,
      `${ship.name.toUpperCase()} · DAILY ORDERS PART I · TRAINING PROGRAMME`,
      `EXECUTIVE DEPARTMENT (GUNNERY & TRAINING OFFICE)`,
      `DATE: ${targetDate} | PREPARED AT: ${lastPulled}`,
      `================================================================================`,
      `TIME          | DEPT          | VENUE            | INSTRUCTOR      | SUBJECT / LESSON`,
      `--------------------------------------------------------------------------------`
    ];

    if (nextDaySessions.length === 0) {
      lines.push(`NO FORMAL SHIPBOARD LECTURES SCHEDULED FOR ${targetDate}. ROUTINE WATCHKEEPING.`);
    } else {
      nextDaySessions.forEach((s, idx) => {
        const time = `${s.startTime || '09:00'} - ${s.endTime || '10:00'}`.padEnd(13);
        const dept = (s.department || 'All').padEnd(13);
        const venue = (s.location || 'Flat').slice(0, 16).padEnd(16);
        const speaker = (s.speaker || 'Duty Officer').slice(0, 15).padEnd(15);
        lines.push(`${time} | ${dept} | ${venue} | ${speaker} | ${idx + 1}. ${s.title}`);
      });
    }

    lines.push(`--------------------------------------------------------------------------------`);
    lines.push(`NOTE: ALL NOMINATED PERSONNEL ARE TO BE MUSTERED 5 MINUTES PRIOR TO LECTURE.`);
    lines.push(`DRESS OF THE DAY: WORKING RIG / OVERALLS AS ORDERED.`);
    lines.push(`BY ORDER OF EXECUTIVE OFFICER (EXO) / GUNNERY OFFICER (GDO)`);
    lines.push(`================================================================================`);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const content = (
    <div className="space-y-4 text-slate-100">
      {/* Naval Header & Status Banner */}
      <div className="p-4 bg-gradient-to-r from-blue-950/60 via-slate-900 to-cyan-950/60 border border-blue-800/50 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-semibold flex items-center gap-1.5">
              <span>Executive Department</span>
              <span>·</span>
              <span>Gunnery Section</span>
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Publish Daily Order — Training Programme
            </h2>
            <p className="text-xs text-slate-400">
              Automated extract of next day's training syllabus for ship's Daily Orders Part I.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
            />
          </div>

          <button
            onClick={handlePullTraining}
            title="Pull latest training records for this date"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Pull Training Table</span>
          </button>

          <button
            onClick={handleCopyDailyOrder}
            title="Copy formatted daily order text block to clipboard"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
            <span>{copied ? 'Copied Order' : 'Copy Text Block'}</span>
          </button>

          <button
            onClick={() => window.print()}
            title="Print daily order training slip"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Print Slip</span>
          </button>
        </div>
      </div>

      {/* Naval Daily Orders Template Preview */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-inner space-y-4 font-mono text-xs">
        {/* Notice Board Masthead */}
        <div className="text-center pb-3 border-b border-slate-800 space-y-0.5">
          <div className="text-sm font-bold tracking-widest text-white uppercase">
            {ship.name} {ship.pennant ? `(${ship.pennant})` : ''}
          </div>
          <div className="text-[11px] text-cyan-400 tracking-wider font-semibold uppercase">
            Daily Orders Part I — Training Program Extract
          </div>
          <div className="text-[10px] text-slate-400">
            For Date: <strong className="text-slate-200">{targetDate}</strong> · Issued By: Executive (Gunnery) Office
          </div>
        </div>

        {/* Sessions Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-[10px] uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">S.No</th>
                <th className="py-2.5 px-3 w-28">Time</th>
                <th className="py-2.5 px-3">Subject / Module</th>
                <th className="py-2.5 px-3 w-32">Department</th>
                <th className="py-2.5 px-3 w-36">Instructor</th>
                <th className="py-2.5 px-3 w-36">Venue</th>
                <th className="py-2.5 px-3 w-28">Dress / Rig</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-950/40 text-[11px]">
              {nextDaySessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No scheduled training sessions found for {targetDate}. Routine watchkeeping and shipboard maintenance.
                  </td>
                </tr>
              ) : (
                nextDaySessions.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-300 font-semibold whitespace-nowrap">
                      {s.startTime || '09:00'} - {s.endTime || '10:00'}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-100">
                      <div>{s.title}</div>
                      {s.description && (
                        <div className="text-[10px] text-slate-500 truncate max-w-sm">
                          {s.description}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 text-[10px]">
                        {s.department}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 truncate max-w-[140px]">
                      {s.speaker || 'Duty Trainer'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-[140px]">
                      {s.location || 'Compartment Flat'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                      Working Rig
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Notes */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-500">
          <div>
            1. All personnel detailed are to muster 5 minutes prior to instruction.<br />
            2. Attendance returns to be signed by instructor and forwarded to Gunnery Office.
          </div>
          <div className="text-right">
            By Direction of Executive Officer (EXO)<br />
            Gunnery & Regulating Office
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Ship Daily Orders — Training Extract
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        {content}
      </div>
    </div>
  );
};
