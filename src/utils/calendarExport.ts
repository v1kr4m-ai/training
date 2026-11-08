/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import type { ScheduledSession } from '../types';
import { getDepartmentConfig } from '../data/departments';
import { formatDate, parseDate } from './scheduler';
import { timeLabel } from './time';

export type PeriodKind = 'RANGE' | 'MONTH' | 'QUARTER';
export type ExportFormat = 'XLSX' | 'PDF' | 'IMAGE';
export type ExportLayout = 'TABLE' | 'CALENDAR';

export interface PeriodInput { kind: PeriodKind; from: string; to: string; month: string; year: number; quarter: 1 | 2 | 3 | 4 }

const pad = (n: number) => String(n).padStart(2, '0');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** First and last date (YYYY-MM-DD) of the chosen period. Quarters are calendar quarters (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec). */
export function periodRange(p: PeriodInput): { from: string; to: string } {
  if (p.kind === 'MONTH' && /^\d{4}-\d{2}$/.test(p.month)) {
    const [y, m] = p.month.split('-').map(Number);
    return { from: `${y}-${pad(m)}-01`, to: formatDate(new Date(y, m, 0, 12)) };
  }
  if (p.kind === 'QUARTER') {
    const m0 = (p.quarter - 1) * 3;
    return { from: `${p.year}-${pad(m0 + 1)}-01`, to: formatDate(new Date(p.year, m0 + 3, 0, 12)) };
  }
  return { from: p.from, to: p.to };
}

export const periodLabel = (from: string, to: string) => (from === to ? from : `${from} to ${to}`);

export const sessionsBetween = (sessions: ScheduledSession[], from: string, to: string) =>
  sessions.filter(s => s.date >= from && s.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

const HEADER = ['Date', 'Day', 'Start', 'End', 'Duration (min)', 'Topic', 'Department', 'Section', 'Speaker', 'Venue', 'Status'];
const rowOf = (s: ScheduledSession) => [
  s.date, DAYS[s.dayOfWeek] || '', s.startTime, s.endTime || '', s.durationMinutes ?? '', s.title, s.department, s.subDepartment, s.speaker, s.location, s.status
];

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One sheet, one row per session, so it can be sorted and filtered in Excel. */
export function exportXlsx(rows: ScheduledSession[], name: string) {
  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...rows.map(rowOf)]);
  ws['!cols'] = [12, 11, 7, 7, 10, 44, 16, 22, 22, 18, 12].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Training');
  XLSX.writeFile(wb, `${name}.xlsx`);
}

// ---------------------------------------------------------------- drawing (PNG and PDF share it)

const FONT = '"Segoe UI", Arial, sans-serif';
const SCALE = 2;
const STATUS_MARK: Record<string, string> = { Completed: '✓ ', Skipped: '✕ ', Rescheduled: '↻ ' };

function newCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w * SCALE;
  c.height = h * SCALE;
  const ctx = c.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'middle';
  return { c, ctx };
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

const ROW_H = 26;
const COLS: Array<{ label: string; w: number; get: (s: ScheduledSession) => string }> = [
  { label: 'Date', w: 0.085, get: s => s.date },
  { label: 'Day', w: 0.065, get: s => (DAYS[s.dayOfWeek] || '').slice(0, 3) },
  { label: 'Time', w: 0.09, get: s => timeLabel(s) },
  { label: 'Topic', w: 0.3, get: s => s.title },
  { label: 'Department', w: 0.12, get: s => s.department },
  { label: 'Section', w: 0.12, get: s => s.subDepartment },
  { label: 'Speaker', w: 0.1, get: s => s.speaker },
  { label: 'Status', w: 0.08, get: s => `${STATUS_MARK[s.status] || ''}${s.status}` }
];

/** Table pages. `pageH` null = as tall as the rows need (images, split every 100 rows); a number = fixed pages (PDF). */
export function tablePages(rows: ScheduledSession[], title: string, subtitle: string, pageW: number, pageH: number | null): HTMLCanvasElement[] {
  const top = 74;
  const margin = 28;
  const perPage = pageH ? Math.max(1, Math.floor((pageH - top - margin) / ROW_H)) : 100;
  const chunks: ScheduledSession[][] = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += perPage) chunks.push(rows.slice(i, i + perPage));

  return chunks.map((chunk, pi) => {
    const h = pageH ?? top + chunk.length * ROW_H + margin;
    const { c, ctx } = newCanvas(pageW, h);
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(title, margin, 26);
    ctx.fillStyle = '#475569';
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`${subtitle}${chunks.length > 1 ? `  ·  page ${pi + 1} of ${chunks.length}` : ''}`, margin, 48);

    const inner = pageW - margin * 2;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(margin, top - 20, inner, ROW_H - 2);
    let x = margin;
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillStyle = '#0f172a';
    COLS.forEach(col => { ctx.fillText(col.label.toUpperCase(), x + 6, top - 7); x += col.w * inner; });

    chunk.forEach((s, i) => {
      const y = top + i * ROW_H;
      if (i % 2) { ctx.fillStyle = '#f8fafc'; ctx.fillRect(margin, y - 7, inner, ROW_H); }
      let cx = margin;
      COLS.forEach(col => {
        ctx.font = `${col.label === 'Topic' ? 'bold ' : ''}11px ${FONT}`;
        ctx.fillStyle = col.label === 'Department' ? getDepartmentConfig(s.department).color : s.status === 'Skipped' ? '#94a3b8' : '#1e293b';
        ctx.fillText(fit(ctx, col.get(s), col.w * inner - 10), cx + 6, y + 6);
        cx += col.w * inner;
      });
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath(); ctx.moveTo(margin, y + 6 + ROW_H / 2); ctx.lineTo(margin + inner, y + 6 + ROW_H / 2); ctx.stroke();
    });
    if (rows.length === 0) { ctx.fillStyle = '#64748b'; ctx.font = `13px ${FONT}`; ctx.fillText('No training sessions in this period.', margin, top + 10); }
    return c;
  });
}

/** One month grid per page, sessions listed inside their day. Months run from the one holding `from` to the one holding `to`. */
export function calendarPages(rows: ScheduledSession[], title: string, subtitle: string, from: string, to: string, pageW: number, pageH: number | null): HTMLCanvasElement[] {
  const pages: HTMLCanvasElement[] = [];
  const f = parseDate(from);
  const t = parseDate(to);
  const margin = 28;
  const head = 78;
  const labelH = 22;
  let guard = 0;

  for (let y = f.getFullYear(), m = f.getMonth(); (y < t.getFullYear() || (y === t.getFullYear() && m <= t.getMonth())) && guard < 36; guard++) {
    const first = new Date(y, m, 1, 12);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
    const cellW = (pageW - margin * 2) / 7;
    const cellH = pageH ? (pageH - head - labelH - margin) / weeks : 128;
    const h = pageH ?? head + labelH + weeks * cellH + margin;
    const { c, ctx } = newCanvas(pageW, h);

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(`${title} · ${MONTHS[m]} ${y}`, margin, 26);
    ctx.fillStyle = '#475569';
    ctx.font = `12px ${FONT}`;
    ctx.fillText(subtitle, margin, 48);

    ctx.font = `bold 11px ${FONT}`;
    DAYS.forEach((d, i) => { ctx.fillStyle = '#334155'; ctx.fillText(d.slice(0, 3).toUpperCase(), margin + i * cellW + 6, head - 8); });

    for (let day = 1; day <= daysInMonth; day++) {
      const idx = first.getDay() + day - 1;
      const x = margin + (idx % 7) * cellW;
      const yy = head + labelH - 14 + Math.floor(idx / 7) * cellH;
      const iso = `${y}-${pad(m + 1)}-${pad(day)}`;
      const inRange = iso >= from && iso <= to;
      ctx.fillStyle = inRange ? '#ffffff' : '#f1f5f9';
      ctx.fillRect(x, yy, cellW, cellH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(x, yy, cellW, cellH);
      ctx.fillStyle = inRange ? '#0f172a' : '#94a3b8';
      ctx.font = `bold 11px ${FONT}`;
      ctx.fillText(String(day), x + 5, yy + 10);

      const list = inRange ? rows.filter(s => s.date === iso) : [];
      const lines = Math.max(1, Math.floor((cellH - 22) / 14));
      list.slice(0, list.length > lines ? lines - 1 : lines).forEach((s, i) => {
        ctx.font = `10px ${FONT}`;
        ctx.fillStyle = s.status === 'Skipped' ? '#94a3b8' : getDepartmentConfig(s.department).color;
        ctx.fillText(fit(ctx, `${STATUS_MARK[s.status] || ''}${s.startTime} ${s.title}`, cellW - 10), x + 5, yy + 24 + i * 14);
      });
      if (list.length > lines) { ctx.font = `bold 10px ${FONT}`; ctx.fillStyle = '#475569'; ctx.fillText(`+${list.length - lines + 1} more`, x + 5, yy + 24 + (lines - 1) * 14); }
    }
    pages.push(c);
    if (++m > 11) { m = 0; y++; }
  }
  return pages;
}

// ---------------------------------------------------------------- PDF: each drawn page becomes one JPEG page

const b64ToBytes = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(',')[1]), ch => ch.charCodeAt(0));

export function pdfFromCanvases(pages: HTMLCanvasElement[], pageW = 842, pageH = 595): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const obj = (n: number, body: () => void) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };

  push('%PDF-1.4\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`));
  pages.forEach((cv, i) => {
    const jpg = b64ToBytes(cv.toDataURL('image/jpeg', 0.92));
    const k = Math.min(pageW / cv.width, pageH / cv.height);
    const w = (cv.width * k).toFixed(2);
    const h = (cv.height * k).toFixed(2);
    const content = `q ${w} 0 0 ${h} 0 ${(pageH - cv.height * k).toFixed(2)} cm /Im0 Do Q`;
    obj(3 + i * 3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 ${5 + i * 3} 0 R >> >> /Contents ${4 + i * 3} 0 R >>`));
    obj(4 + i * 3, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(5 + i * 3, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
      push(jpg);
      push('\nendstream');
    });
  });
  const total = 3 + pages.length * 3;
  const xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

// ---------------------------------------------------------------- entry point

export interface ExportJob { rows: ScheduledSession[]; from: string; to: string; format: ExportFormat; layout: ExportLayout; shipName: string }

export async function runExport(job: ExportJob) {
  const { rows, from, to, format, layout, shipName } = job;
  const base = `training_${from}_to_${to}`;
  if (format === 'XLSX') return exportXlsx(rows, base);

  const title = `${shipName} Training Calendar`;
  const subtitle = `${periodLabel(from, to)}  ·  ${rows.length} session${rows.length === 1 ? '' : 's'}  ·  printed ${formatDate(new Date())}`;
  const isPdf = format === 'PDF';
  const pageW = isPdf ? 1123 : 1400;
  const pageH = isPdf ? 794 : null;
  const pages = layout === 'TABLE' ? tablePages(rows, title, subtitle, pageW, pageH) : calendarPages(rows, title, subtitle, from, to, pageW, pageH);

  if (isPdf) return save(pdfFromCanvases(pages), `${base}.pdf`);
  for (let i = 0; i < pages.length; i++) {
    const blob = await new Promise<Blob | null>(res => pages[i].toBlob(res, 'image/png'));
    if (blob) save(blob, pages.length > 1 ? `${base}_${i + 1}.png` : `${base}.png`);
    await new Promise(r => setTimeout(r, 250)); // browsers drop downloads fired in the same instant
  }
}
