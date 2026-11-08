/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ScheduleConflict, ScheduledSession } from '../types';
import { timeLabel } from '../utils/time';

/**
 * Shown when a change would create warnings or conflicts. The administrator may save it anyway (the warnings stay visible
 * on the session afterwards); anyone else is told the change cannot be saved.
 */
export const OverrideModal: React.FC<{
  session: ScheduledSession;
  conflicts: ScheduleConflict[];
  isAdmin: boolean;
  onCancel: () => void;
  onOverride: () => void;
}> = ({ session, conflicts, isAdmin, onCancel, onOverride }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true" aria-label="Conflicts">
    <div className="bg-slate-900 border border-amber-700/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-base font-bold text-white">This change has {conflicts.length} warning{conflicts.length > 1 ? 's' : ''}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            “{session.title}” on {session.date} at {timeLabel(session)}
          </p>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs text-amber-200 bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 max-h-48 overflow-y-auto">
        {conflicts.map((c, i) => <li key={i}>• {c.message}</li>)}
      </ul>
      {isAdmin ? (
        <p className="text-[11px] text-slate-400">
          As administrator you can override and schedule it anyway. The session is marked “Admin override” and the warnings stay visible until they are resolved.
        </p>
      ) : (
        <p className="text-[11px] text-rose-300">Only the administrator can save a change that has warnings. Pick another date or time, or ask the administrator.</p>
      )}
      <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium">
          {isAdmin ? 'Cancel' : 'Close'}
        </button>
        {isAdmin && (
          <button onClick={onOverride} className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-lg text-xs font-bold">
            Override and schedule
          </button>
        )}
      </div>
    </div>
  </div>
);
