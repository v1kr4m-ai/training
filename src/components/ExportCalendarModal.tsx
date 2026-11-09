/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import type { ScheduledSession } from '../types';
import { ExportFormat, ExportLayout, PeriodKind, periodLabel, periodRange, runExport, sessionsBetween } from '../utils/calendarExport';
import { downloadMonthlyBulletinPdf } from '../utils/monthlyBulletinPdf';

const field = 'bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500';
const Choice: React.FC<{ on: boolean; onPick: () => void; label: string; hint?: string }> = ({ on, onPick, label, hint }) => (
  <button type="button" onClick={onPick}
    className={`flex-1 text-left px-3 py-2 rounded-lg border text-xs transition-colors ${on ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
    <span className="font-semibold">{label}</span>
    {hint && <span className="block text-[10px] text-slate-500 mt-0.5">{hint}</span>}
  </button>
);

/** Export the calendar for a date range, a month or a quarter, as Excel, PDF or an image; for PDF and image, as a table or a calendar. */
export const ExportCalendarModal: React.FC<{ sessions: ScheduledSession[]; year: number; shipName: string; today: string; onClose: () => void }> = ({ sessions, year, shipName, today, onClose }) => {
  const [kind, setKind] = useState<PeriodKind>('MONTH');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [qYear, setQYear] = useState(year);
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1 as 1 | 2 | 3 | 4);
  const [format, setFormat] = useState<ExportFormat>('PDF');
  const [layout, setLayout] = useState<ExportLayout>('CALENDAR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => periodRange({ kind, from, to, month, year: qYear, quarter }), [kind, from, to, month, qYear, quarter]);
  const rows = useMemo(() => sessionsBetween(sessions, range.from, range.to), [sessions, range]);
  const rangeBad = !range.from || !range.to || range.to < range.from;

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await runExport({ rows, from: range.from, to: range.to, format, layout: format === 'XLSX' ? 'TABLE' : layout, shipName });
    } catch (e) {
      setError(`Could not create the file: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true" aria-label="Export calendar">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white">Export training calendar</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Period</div>
          <div className="flex gap-2">
            <Choice on={kind === 'RANGE'} onPick={() => setKind('RANGE')} label="Date to date" />
            <Choice on={kind === 'MONTH'} onPick={() => setKind('MONTH')} label="Month" />
            <Choice on={kind === 'QUARTER'} onPick={() => setKind('QUARTER')} label="Quarter" />
          </div>
          {kind === 'RANGE' && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              From <input type="date" className={field} value={from} onChange={e => setFrom(e.target.value)} />
              to <input type="date" className={field} value={to} min={from} onChange={e => setTo(e.target.value)} />
            </div>
          )}
          {kind === 'MONTH' && <input type="month" className={field} value={month} onChange={e => setMonth(e.target.value)} />}
          {kind === 'QUARTER' && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <select className={field} value={quarter} onChange={e => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}>
                <option value={1}>Q1 · Jan–Mar</option><option value={2}>Q2 · Apr–Jun</option><option value={3}>Q3 · Jul–Sep</option><option value={4}>Q4 · Oct–Dec</option>
              </select>
              <input type="number" className={`${field} w-24`} value={qYear} min={2000} max={2100} onChange={e => setQYear(Number(e.target.value))} />
            </div>
          )}
          <div className="text-[11px] text-slate-500">
            {rangeBad ? 'Choose a valid period.' : `${periodLabel(range.from, range.to)} · ${rows.length} session${rows.length === 1 ? '' : 's'}`}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">File type</div>
          <div className="flex gap-2">
            <Choice on={format === 'XLSX'} onPick={() => setFormat('XLSX')} label="Excel" hint=".xlsx table" />
            <Choice on={format === 'PDF'} onPick={() => setFormat('PDF')} label="PDF" hint="A4 landscape" />
            <Choice on={format === 'IMAGE'} onPick={() => setFormat('IMAGE')} label="Image" hint=".png" />
          </div>
        </div>

        {format !== 'XLSX' && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Layout</div>
            <div className="flex gap-2">
              <Choice on={layout === 'CALENDAR'} onPick={() => setLayout('CALENDAR')} label="Calendar" hint="one month grid per page" />
              <Choice on={layout === 'TABLE'} onPick={() => setLayout('TABLE')} label="Table" hint="one row per session" />
            </div>
          </div>
        )}

        {/* Notice Board Bulletin Callout */}
        <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-bold text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Looking for Ship Notice Board Prints?</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Generate official monthly training bulletins with naval masthead, muster directives, and sign-off blocks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const [y, m] = (kind === 'MONTH' ? month : today.slice(0, 7)).split('-').map(Number);
              downloadMonthlyBulletinPdf({
                monthDate: new Date(y, m - 1, 1),
                sessions,
                shipName,
                paperSize: 'A4'
              });
            }}
            className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Bulletin PDF</span>
          </button>
        </div>

        {error && <div className="text-xs text-rose-400" role="alert">{error}</div>}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium">Close</button>
          <button onClick={go} disabled={busy || rangeBad || rows.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold">
            <Download className="w-3.5 h-3.5" /> {busy ? 'Creating…' : 'Export'}
          </button>
        </div>
        {rows.length === 0 && !rangeBad && <p className="text-[11px] text-amber-400">There are no sessions in this period.</p>}
      </div>
    </div>
  );
};
