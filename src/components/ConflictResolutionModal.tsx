/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ScheduleConflict, ScheduledSession } from '../types';
import { 
  AlertTriangle, 
  ArrowRight, 
  FastForward, 
  Lock, 
  Unlock, 
  X, 
  HelpCircle,
  CheckCircle2
} from 'lucide-react';

interface ConflictResolutionModalProps {
  conflict: ScheduleConflict | null;
  session?: ScheduledSession;
  onClose: () => void;
  onShiftOneDay: (sessionId: string) => void;
  onCascadeReschedule: (fromSequence?: number) => void;
  onClearPrerequisite?: (sessionId: string) => void;
  onToggleLock?: (session: ScheduledSession) => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  conflict,
  session,
  onClose,
  onShiftOneDay,
  onCascadeReschedule,
  onClearPrerequisite,
  onToggleLock
}) => {
  if (!conflict) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Interactive Conflict Resolution
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conflict Diagnostic Card */}
        <div className="p-3.5 bg-amber-950/30 border border-amber-800/40 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 border border-amber-700/50">
              {conflict.type.replace(/_/g, ' ')}
            </span>
            <span className="font-mono text-xs text-amber-300">
              Date: {conflict.sessionDate}
            </span>
          </div>

          <div className="text-sm font-bold text-slate-100">
            {conflict.sessionTitle}
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {conflict.message}
          </p>

          {/* Additional forensic details */}
          {conflict.details && (
            <div className="pt-2 border-t border-amber-800/30 text-[11px] text-slate-300 space-y-1 font-mono">
              {conflict.details.holidayName && (
                <div>• Conflicting Holiday: <strong className="text-white">{conflict.details.holidayName}</strong></div>
              )}
              {conflict.details.prerequisiteDate && (
                <div>• Prerequisite Date: <strong className="text-purple-300">{conflict.details.prerequisiteDate}</strong></div>
              )}
              {conflict.details.prerequisiteTitle && (
                <div>• Prerequisite Topic: <strong className="text-purple-200">{conflict.details.prerequisiteTitle}</strong></div>
              )}
              {conflict.details.expectedSlotType && (
                <div>• Expected Track: <strong className="text-blue-300">{conflict.details.expectedSlotType}</strong></div>
              )}
            </div>
          )}
        </div>

        {/* Remediation Action Explanations */}
        <div className="space-y-2 text-xs">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>Recommended Autonomous Remedies:</span>
          </div>

          <div className="space-y-2">
            {/* Action 1: Shift 1 Working Day */}
            <button
              onClick={() => {
                onShiftOneDay(conflict.sessionId);
                onClose();
              }}
              className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between group"
            >
              <div>
                <div className="font-bold text-slate-200 group-hover:text-blue-300 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  <span>Shift Session by 1 Working Day</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Bypasses weekends & holidays, moving subsequent colliding dates forward.
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-blue-600 group-hover:bg-blue-500 text-white rounded-lg shrink-0">
                Shift 1D
              </span>
            </button>

            {/* Action 2: Cascade Reschedule Downstream */}
            <button
              onClick={() => {
                onCascadeReschedule(session?.sequenceNumber || 1);
                onClose();
              }}
              className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between group"
            >
              <div>
                <div className="font-bold text-slate-200 group-hover:text-blue-300 flex items-center gap-1.5">
                  <FastForward className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cascade Reschedule All Downstream</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Topologically re-aligns prerequisites and recalculates dates without collisions.
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-600 group-hover:bg-emerald-500 text-white rounded-lg shrink-0">
                Cascade
              </span>
            </button>

            {/* Action 3: Clear Prerequisite if Prereq conflict */}
            {conflict.type === 'PREREQUISITE_VIOLATION' && onClearPrerequisite && (
              <button
                onClick={() => {
                  onClearPrerequisite(conflict.sessionId);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-slate-200 group-hover:text-purple-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Make Topic Standalone (Remove Prerequisite)</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Removes dependency constraint so this module can occur on any date.
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-purple-600 group-hover:bg-purple-500 text-white rounded-lg shrink-0">
                  Unlink
                </span>
              </button>
            )}

            {/* Action 4: Toggle Pin / Lock */}
            {session && onToggleLock && (
              <button
                onClick={() => {
                  onToggleLock(session);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-slate-200 group-hover:text-amber-300 flex items-center gap-1.5">
                    {session.isCustomLocked ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{session.isCustomLocked ? 'Unlock Session' : 'Lock / Pin Session to Date'}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {session.isCustomLocked ? 'Allow automatic rescheduling engine to adjust this date.' : 'Prevent automated engines from moving this date.'}
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-800 text-slate-200 rounded-lg shrink-0">
                  {session.isCustomLocked ? 'Unlock' : 'Lock'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
