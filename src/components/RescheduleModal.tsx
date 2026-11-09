/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { ScheduledSession } from '../types';
import { formatDate, parseDate } from '../utils/scheduler';

/** Move a session to a later date (never earlier than today) and record the reason. */
export const RescheduleModal: React.FC<{
  session: ScheduledSession;
  today: string;
  sessions?: ScheduledSession[];
  isAdmin?: boolean;
  onCancel: () => void;
  onApply: (date: string, startTime: string, reason: string, adminOverride?: boolean) => void;
}> = ({ session, today, sessions = [], isAdmin = true, onCancel, onApply }) => {
  const dayAfter = (() => { const d = parseDate(session.date); d.setDate(d.getDate() + 1); return formatDate(d); })();
  const min = dayAfter > today ? dayAfter : today;
  const [date, setDate] = useState(min);
  const [start, setStart] = useState(session.startTime);
  const [reason, setReason] = useState('');
  const [adminOverride, setAdminOverride] = useState(false);
  const bad = !date || date < min;
  const field = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500';

  // Check for concurrent sessions on selected date & time
  const concurrentSessions = sessions.filter(s => s.id !== session.id && s.date === date && s.startTime === start);
  const hasConcurrent = concurrentSessions.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true" aria-label="Reschedule session">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div>
          <h2 className="text-base font-bold text-white">Reschedule to a later date</h2>
          <p className="text-xs text-slate-400 mt-0.5">“{session.title}”, now {session.date}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            New date
            <input type="date" className={field} value={date} min={min} onChange={e => setDate(e.target.value)} />
          </label>
          <label className="space-y-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            Start time
            <input type="time" className={field} value={start} onChange={e => setStart(e.target.value)} />
          </label>
        </div>
        <label className="block space-y-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
          Reason (optional)
          <input className={field} value={reason} placeholder="e.g. instructor on duty" onChange={e => setReason(e.target.value)} />
        </label>
        {bad && <p className="text-xs text-rose-400">Choose {min} or a later date.</p>}

        {hasConcurrent && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-2 text-xs text-amber-300">
            <div className="font-semibold flex items-center gap-1.5">
              <span>⚠️ Caution: Concurrent Lecture Conflict</span>
            </div>
            <p className="text-[11px] text-amber-200/80">
              {concurrentSessions.length} session(s) already scheduled at {start} on {date}: {concurrentSessions.map(c => `[${c.department}] ${c.title}`).join(', ')}.
            </p>
            {isAdmin && (
              <label className="flex items-start gap-2 pt-1 border-t border-amber-900/50 cursor-pointer text-[11px] text-slate-200">
                <input
                  type="checkbox"
                  checked={adminOverride}
                  onChange={e => setAdminOverride(e.target.checked)}
                  className="mt-0.5 rounded text-amber-500"
                />
                <span>
                  <strong>Admin Override:</strong> Schedule concurrent lectures on same day and time. The caution warning will remain visible on the schedule.
                </span>
              </label>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
          <button onClick={onCancel} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium">Cancel</button>
          <button
            disabled={bad || !start}
            onClick={() => onApply(date, start, reason.trim(), adminOverride)}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-slate-950 rounded-lg text-xs font-bold"
          >
            Reschedule {adminOverride ? '(Admin Override)' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
