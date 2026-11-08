/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const inputCls =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-white/30 focus:outline-none focus:border-white/40';
export const btnPrimary =
  'inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-semibold rounded-full transition-colors';
export const btnGhost =
  'inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed text-slate-100 text-xs font-medium rounded-full border border-white/10 transition-colors';
export const btnDanger =
  'inline-flex items-center gap-1.5 px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 text-xs font-medium rounded-full border border-rose-800/60 transition-colors';

export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/10 pb-4">
    <div>
      <h1 className="text-2xl font-extrabold text-white tracking-tight">{title}</h1>
      {subtitle && <p className="text-xs text-slate-400 mt-1 max-w-2xl">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export const Card: React.FC<{ title?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, actions, className = '', children }) => (
  <section className={`bg-white/[0.04] border border-white/10 rounded-3xl p-5 backdrop-blur ${className}`}>
    {(title || actions) && (
      <div className="flex items-center justify-between gap-3 mb-3">
        {title && <h2 className="text-sm font-bold text-white">{title}</h2>}
        {actions}
      </div>
    )}
    {children}
  </section>
);

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
  </label>
);

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-white/10 rounded-xl">{children}</div>
);

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true" aria-label={title}>
    <div className={`bg-[#12151a] border border-white/10 rounded-3xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h2 className="text-base font-bold text-white">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white">✕</button>
      </div>
      {children}
    </div>
  </div>
);

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_HOD: { label: 'Awaiting HoD', cls: 'bg-amber-950/70 text-amber-300 border-amber-800/60' },
  PENDING_CO: { label: 'Awaiting CO', cls: 'bg-amber-950/70 text-amber-300 border-amber-800/60' },
  PENDING_ADMIN: { label: 'Awaiting Administrator', cls: 'bg-amber-950/70 text-amber-300 border-amber-800/60' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60' },
  REJECTED: { label: 'Rejected', cls: 'bg-rose-950/70 text-rose-300 border-rose-800/60' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-800 text-slate-400 border-slate-700' }
};
export const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS[status] || STATUS.CANCELLED;
  return <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
};
