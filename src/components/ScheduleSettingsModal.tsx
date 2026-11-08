/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DayUse, ScheduleSettings } from '../types';
import { DAY_NAMES, validateSettings } from '../utils/settings';

interface Props {
  isOpen: boolean;
  settings: ScheduleSettings;
  sessionCount: number;
  onClose: () => void;
  onApply: (next: ScheduleSettings) => void;
}

const OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'OFF', label: 'No training' },
  { value: 'COMPANY_WIDE', label: 'Ship-Wide topics' },
  { value: 'DEPARTMENTAL', label: 'Departmental topics' },
  { value: 'ANY', label: 'Either (balanced)' }
];

export const ScheduleSettingsModal: React.FC<Props> = ({ isOpen, settings, sessionCount, onClose, onApply }) => {
  const [draft, setDraft] = useState<ScheduleSettings>(settings);
  const [prevOpen, setPrevOpen] = useState(false);

  // Start from the saved settings each time the dialog opens
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) setDraft(settings);
  }
  if (!isOpen) return null;

  const error = validateSettings(draft);
  const setDay = (d: number, v: string) =>
    setDraft(p => ({ ...p, days: { ...p.days, [d]: (v === 'OFF' ? null : v) as DayUse } }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">Schedule Settings</h2>
            <p className="text-xs text-slate-400">Choose the training days and the time of day. Change any session's date or time later in the Training Matrix.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map(d => (
            <div key={d} className="flex items-center justify-between gap-3 text-xs">
              <span className="w-24 font-semibold text-slate-200">{DAY_NAMES[d]}</span>
              <select
                value={draft.days[d] ?? 'OFF'}
                onChange={e => setDay(d, e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200"
              >
                {OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs pt-2 border-t border-slate-800">
          <label className="flex items-center gap-2 text-slate-300">
            Start
            <input type="time" value={draft.startTime} onChange={e => setDraft(p => ({ ...p, startTime: e.target.value }))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 font-mono text-slate-200" />
          </label>
          <label className="flex items-center gap-2 text-slate-300">
            Duration (min, optional)
            <input type="number" min={1} max={1439} value={draft.durationMinutes ?? ''} placeholder="none"
              onChange={e => setDraft(p => ({ ...p, durationMinutes: e.target.value === '' ? null : Number(e.target.value) }))}
              className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 font-mono text-slate-200" />
          </label>
        </div>

        {error && <div className="text-xs text-rose-400">{error}</div>}
        {sessionCount > 0 && (
          <p className="text-[11px] text-slate-500">
            Applying rebuilds the schedule from your topics. Sessions you locked or marked Completed keep their date and time.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium">Cancel</button>
          <button
            disabled={!!error}
            onClick={() => { onApply(draft); onClose(); }}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold"
          >
            Apply &amp; rebuild schedule
          </button>
        </div>
      </div>
    </div>
  );
};
