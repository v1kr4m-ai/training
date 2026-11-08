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
  onCancel: () => void;
  onApply: (date: string, startTime: string, reason: string) => void;
}> = ({ session, today, onCancel, onApply }) => {
  const dayAfter = (() => { const d = parseDate(session.date); d.setDate(d.getDate() + 1); return formatDate(d); })();
  const min = dayAfter > today ? dayAfter : today;
  const [date, setDate] = useState(min);
  const [start, setStart] = useState(session.startTime);
  const [reason, setReason] = useState('');
  const bad = !date || date < min;
  const field = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500';

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
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
          <button onClick={onCancel} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium">Cancel</button>
          <button disabled={bad || !start} onClick={() => onApply(date, start, reason.trim())}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-slate-950 rounded-lg text-xs font-bold">
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
};
