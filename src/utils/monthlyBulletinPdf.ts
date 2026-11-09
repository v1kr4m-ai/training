/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScheduledSession, HolidayEntry, ScheduleSettings } from '../types';
import { ALL_TRACK_DEPARTMENTS, getDepartmentConfig, SHIP_WIDE } from '../data/departments';
import { pdfFromCanvases } from './calendarExport';
import { formatDate } from './scheduler';

export interface BulletinPdfOptions {
  monthDate: Date; // e.g. new Date(2026, 2, 1) for March 2026
  sessions: ScheduledSession[];
  holidays?: HolidayEntry[];
  shipName: string;
  shipPennant?: string;
  departmentFilter?: string; // 'ALL' or specific department
  includeInstructors?: boolean;
  includeVenues?: boolean;
  includeStandingOrders?: boolean;
  includeSignOffBlock?: boolean;
  paperSize?: 'A4' | 'LETTER';
  settings?: ScheduleSettings;
}

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const WEEKDAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const FONT_SANS = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif';
const FONT_MONO = '"JetBrains Mono", Consolas, "Courier New", monospace';

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 2 && ctx.measureText(s + '…').width > maxW) {
    s = s.slice(0, -1);
  }
  return s + '…';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 2): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxW) {
      current = testLine;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  } else if (current && lines.length === maxLines) {
    lines[maxLines - 1] = fitText(ctx, `${lines[maxLines - 1]} ${current}`, maxW);
  }
  return lines;
}

/**
 * Generates an ultra-crisp, high-resolution canvas for a monthly shipboard training bulletin board.
 * Optimized for pin-up notice boards, wardrooms, and department training flats.
 */
export function generateMonthlyBulletinCanvas(options: BulletinPdfOptions): HTMLCanvasElement {
  const {
    monthDate,
    sessions,
    holidays = [],
    shipName,
    shipPennant = '',
    departmentFilter = 'ALL',
    includeInstructors = true,
    includeVenues = true,
    includeStandingOrders = true,
    includeSignOffBlock = true,
    paperSize = 'A4'
  } = options;

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const monthName = MONTH_NAMES[month];

  // A4 Landscape standard: 1123 x 794 pt; Letter Landscape: 1056 x 816 pt
  const pageW = paperSize === 'LETTER' ? 1056 : 1123;
  const pageH = paperSize === 'LETTER' ? 816 : 794;

  // Ultra-crisp 2.5x retina scaling for 300 DPI pin-up board print quality
  const SCALE = 2.5;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pageW * SCALE);
  canvas.height = Math.round(pageH * SCALE);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // Background base
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageW, pageH);

  // Outer naval decorative border
  const margin = 20;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(margin, margin, pageW - margin * 2, pageH - margin * 2);

  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(margin + 3.5, margin + 3.5, pageW - (margin + 3.5) * 2, pageH - (margin + 3.5) * 2);

  // --- HEADER SECTION (Naval Masthead) ---
  const headerTop = margin + 5;
  const headerH = 68;
  const headerW = pageW - (margin + 5) * 2;

  // Deep Navy Masthead Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(margin + 5, headerTop, headerW, headerH);

  // Gold accent pinstripe
  ctx.fillStyle = '#d97706';
  ctx.fillRect(margin + 5, headerTop + headerH - 3, headerW, 3);

  // Top Left: Ship Title & Pennant
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 20px ${FONT_SANS}`;
  ctx.textBaseline = 'top';
  const fullShipTitle = shipPennant ? `${shipName.toUpperCase()} (${shipPennant.toUpperCase()})` : shipName.toUpperCase();
  ctx.fillText(fullShipTitle, margin + 18, headerTop + 10);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `bold 10px ${FONT_MONO}`;
  ctx.fillText(`OFFICIAL TRAINING BULLETIN  ·  DEPARTMENT OF NAVAL TRAINING  ·  NOTICE BOARD COPY`, margin + 18, headerTop + 36);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `9px ${FONT_SANS}`;
  ctx.fillText(`Timing: 13:45 – 14:45 hrs  |  Muster 5 min prior in clean working rig  |  Attendance Mandatory`, margin + 18, headerTop + 50);

  // Top Right: Promulgation & Month Banner
  ctx.fillStyle = '#fbbf24';
  ctx.font = `black 22px ${FONT_SANS}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${monthName} ${year}`, margin + headerW - 14, headerTop + 10);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = `bold 10px ${FONT_MONO}`;
  ctx.fillText(departmentFilter === 'ALL' ? 'ALL DEPARTMENTS & SHIP-WIDE' : `DEPT: ${departmentFilter.toUpperCase()}`, margin + headerW - 14, headerTop + 36);

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold 9px ${FONT_MONO}`;
  ctx.fillText(`STATUS: PROMULGATED ROUTINE  ·  REF: TRG/${year}/${String(month + 1).padStart(2, '0')}`, margin + headerW - 14, headerTop + 50);
  ctx.textAlign = 'left';

  // --- CALENDAR GRID COMPUTATION ---
  const gridTop = headerTop + headerH + 6;
  const footerH = (includeStandingOrders || includeSignOffBlock) ? 82 : 42;
  const gridBottom = pageH - margin - 6 - footerH;
  const gridH = gridBottom - gridTop;
  const gridW = headerW;

  const firstDayOfMonth = new Date(year, month, 1, 12);
  // Monday-first indexing (0 = Mon, 6 = Sun)
  const startDayOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalWeeks = Math.ceil((startDayOffset + daysInMonth) / 7);

  const colW = gridW / 7;
  const weekdayHeaderH = 22;
  const rowH = (gridH - weekdayHeaderH) / totalWeeks;

  // Weekday Headers (MON - SUN)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(margin + 5, gridTop, gridW, weekdayHeaderH);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(margin + 5, gridTop, gridW, weekdayHeaderH);

  WEEKDAY_NAMES.forEach((dayLabel, colIdx) => {
    const x = margin + 5 + colIdx * colW;
    ctx.fillStyle = colIdx >= 5 ? '#f59e0b' : '#f8fafc'; // Weekend slight amber tint
    ctx.font = `bold 11px ${FONT_MONO}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(dayLabel, x + colW / 2, gridTop + weekdayHeaderH / 2);

    // Vertical column divider
    if (colIdx > 0) {
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, gridTop + weekdayHeaderH);
      ctx.stroke();
    }
  });

  ctx.textAlign = 'left';

  // Holiday Lookup Map
  const holidayMap = new Map<string, HolidayEntry>();
  holidays.forEach(h => holidayMap.set(h.date, h));

  // Render Grid Cells
  const calendarCellsY = gridTop + weekdayHeaderH;

  for (let cellIndex = 0; cellIndex < totalWeeks * 7; cellIndex++) {
    const colIdx = cellIndex % 7;
    const rowIdx = Math.floor(cellIndex / 7);
    const dayNumber = cellIndex - startDayOffset + 1;
    const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;

    const cellX = margin + 5 + colIdx * colW;
    const cellY = calendarCellsY + rowIdx * rowH;

    const dateStr = isCurrentMonth
      ? `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
      : '';

    const isWeekend = colIdx >= 5;
    const holiday = isCurrentMonth ? holidayMap.get(dateStr) : undefined;

    // Cell Background
    if (!isCurrentMonth) {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(cellX, cellY, colW, rowH);
    } else if (holiday) {
      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(cellX, cellY, colW, rowH);
    } else if (isWeekend) {
      ctx.fillStyle = '#fafaf9';
      ctx.fillRect(cellX, cellY, colW, rowH);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cellX, cellY, colW, rowH);
    }

    // Cell Border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(cellX, cellY, colW, rowH);

    if (!isCurrentMonth) continue;

    // Day Number Badge
    ctx.textBaseline = 'top';
    ctx.font = `bold 13px ${FONT_SANS}`;
    ctx.fillStyle = holiday ? '#dc2626' : isWeekend ? '#64748b' : '#0f172a';
    ctx.fillText(String(dayNumber), cellX + 6, cellY + 5);

    // If Holiday, draw Holiday Marker
    if (holiday) {
      ctx.fillStyle = '#ef4444';
      ctx.font = `bold 9px ${FONT_SANS}`;
      const holidayLabel = fitText(ctx, `★ ${holiday.name.toUpperCase()}`, colW - 32);
      ctx.fillText(holidayLabel, cellX + 28, cellY + 6);

      // Shaded blackout stamp in cell center
      ctx.fillStyle = '#fecaca';
      ctx.font = `bold 10px ${FONT_MONO}`;
      ctx.fillText('NO ROUTINE TRAINING', cellX + 8, cellY + 28);
      continue;
    }

    // Find Sessions on this day
    const daySessions = sessions.filter(s => {
      if (s.date !== dateStr) return false;
      if (departmentFilter === 'ALL') return true;
      return s.department === departmentFilter;
    });

    if (daySessions.length === 0) {
      if (!isWeekend) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = `italic 9px ${FONT_SANS}`;
        ctx.fillText('Free Study / Duty Watch', cellX + 6, cellY + 26);
      }
    } else {
      // Draw sessions in this day cell
      let currentContentY = cellY + 22;
      const availableH = rowH - 24;
      const maxSessionsToShow = Math.min(daySessions.length, Math.floor(availableH / 32));

      daySessions.slice(0, maxSessionsToShow).forEach(session => {
        const deptCfg = getDepartmentConfig(session.department);
        const cardH = Math.min(48, Math.max(30, availableH / maxSessionsToShow - 3));

        // Session Card Container
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cellX + 4, currentContentY, colW - 8, cardH);

        // Department accent strip on left
        ctx.fillStyle = deptCfg.color;
        ctx.fillRect(cellX + 4, currentContentY, 3.5, cardH);

        // Thin border
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(cellX + 4, currentContentY, colW - 8, cardH);

        // Department badge and time
        ctx.fillStyle = deptCfg.color;
        ctx.font = `bold 9px ${FONT_MONO}`;
        ctx.fillText(`[${deptCfg.code}]`, cellX + 11, currentContentY + 3);

        ctx.fillStyle = '#475569';
        ctx.font = `9px ${FONT_MONO}`;
        ctx.fillText(session.startTime || '13:45', cellX + 42, currentContentY + 3);

        if (session.status === 'Completed') {
          ctx.fillStyle = '#15803d';
          ctx.font = `bold 8px ${FONT_SANS}`;
          ctx.fillText('✓ DONE', cellX + colW - 48, currentContentY + 3);
        }

        // Topic Title
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold 9.5px ${FONT_SANS}`;
        const titleW = colW - 20;
        const wrappedTitle = wrapText(ctx, session.title, titleW, 1);
        ctx.fillText(wrappedTitle[0] || session.title, cellX + 11, currentContentY + 14);

        // Instructor & Venue lines if enabled
        let metaY = currentContentY + 26;
        if (includeInstructors && (session.speaker || session.subDepartment) && metaY + 9 <= currentContentY + cardH) {
          ctx.fillStyle = '#64748b';
          ctx.font = `8px ${FONT_SANS}`;
          const speakerInfo = session.speaker ? `Instr: ${session.speaker}` : session.subDepartment;
          ctx.fillText(fitText(ctx, speakerInfo, titleW), cellX + 11, metaY);
          metaY += 10;
        }

        if (includeVenues && session.location && metaY + 9 <= currentContentY + cardH) {
          ctx.fillStyle = '#0284c7';
          ctx.font = `8px ${FONT_SANS}`;
          ctx.fillText(fitText(ctx, `Loc: ${session.location}`, titleW), cellX + 11, metaY);
        }

        currentContentY += cardH + 3;
      });

      if (daySessions.length > maxSessionsToShow) {
        ctx.fillStyle = '#d97706';
        ctx.font = `bold 8.5px ${FONT_SANS}`;
        ctx.fillText(`+${daySessions.length - maxSessionsToShow} more scheduled`, cellX + 6, cellY + rowH - 12);
      }
    }
  }

  // --- FOOTER SECTION (Bulletin Directives & Official Authorization) ---
  const footerY = gridBottom + 4;
  const footerW = gridW;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(margin + 5, footerY, footerW, footerH);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(margin + 5, footerY, footerW, footerH);

  // Left Section of Footer: Department Legend
  const legendW = 210;
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 9px ${FONT_SANS}`;
  ctx.textBaseline = 'top';
  ctx.fillText('TRACK & DEPARTMENT LEGEND', margin + 12, footerY + 6);

  let legX = margin + 12;
  let legY = footerY + 18;
  ALL_TRACK_DEPARTMENTS.slice(0, 6).forEach((dName, idx) => {
    const cfg = getDepartmentConfig(dName);
    ctx.fillStyle = cfg.color;
    ctx.fillRect(legX, legY, 7, 7);

    ctx.fillStyle = '#334155';
    ctx.font = `8px ${FONT_SANS}`;
    ctx.fillText(`${cfg.code}: ${dName}`, legX + 10, legY);

    if (idx % 2 === 1) {
      legX = margin + 12;
      legY += 12;
    } else {
      legX += 95;
    }
  });

  // Divider 1
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(margin + 5 + legendW, footerY + 4);
  ctx.lineTo(margin + 5 + legendW, footerY + footerH - 4);
  ctx.stroke();

  // Center Section: Standing Notice Board Directives
  if (includeStandingOrders) {
    const ordersX = margin + 15 + legendW;
    const ordersW = footerW - legendW - (includeSignOffBlock ? 270 : 10);

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 9px ${FONT_SANS}`;
    ctx.fillText('STANDING MUSTER & TRAINING DIRECTIVES', ordersX, footerY + 6);

    ctx.fillStyle = '#475569';
    ctx.font = `8px ${FONT_SANS}`;
    ctx.fillText('1. Attendance is compulsory for all hands on off-duty watch. Muster in designated flats 5 min prior.', ordersX, footerY + 18);
    ctx.fillText('2. Instructors are to submit attendance muster sheets to Training Office within 24 hrs of completion.', ordersX, footerY + 30);
    ctx.fillText('3. Any schedule deviation or shift requires prior written sanction from the Executive Officer.', ordersX, footerY + 42);
    ctx.fillText(`4. Reference Naval General Orders & Standing Orders of ${shipName}.`, ordersX, footerY + 54);
  }

  // Right Section: Executive Sign-off Block
  if (includeSignOffBlock) {
    const signX = margin + footerW - 250;
    // Divider 2
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(signX - 10, footerY + 4);
    ctx.lineTo(signX - 10, footerY + footerH - 4);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 9px ${FONT_SANS}`;
    ctx.fillText('EXECUTIVE PROMULGATION & SANCTION', signX, footerY + 6);

    ctx.font = `8px ${FONT_SANS}`;
    ctx.fillStyle = '#64748b';
    ctx.fillText('Verified: _______________________', signX, footerY + 22);
    ctx.fillText('Executive Officer (XO)', signX + 42, footerY + 31);

    ctx.fillText('Approved: _______________________', signX, footerY + 45);
    ctx.fillText('Commanding Officer (CO)', signX + 42, footerY + 54);

    ctx.fillStyle = '#94a3b8';
    ctx.font = `7.5px ${FONT_MONO}`;
    ctx.fillText(`PROMULGATED: ${formatDate(new Date())}`, signX, footerY + 68);
  }

  return canvas;
}

/**
 * Downloads a professional, high-resolution monthly training schedule PDF
 * specifically styled for ship notice boards.
 */
export async function downloadMonthlyBulletinPdf(options: BulletinPdfOptions): Promise<void> {
  const canvas = generateMonthlyBulletinCanvas(options);
  const paperW = options.paperSize === 'LETTER' ? 1056 : 1123;
  const paperH = options.paperSize === 'LETTER' ? 816 : 794;

  const pdfBlob = pdfFromCanvases([canvas], paperW, paperH);

  const monthStr = MONTH_NAMES[options.monthDate.getMonth()].toLowerCase();
  const yearStr = options.monthDate.getFullYear();
  const cleanShipName = options.shipName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${cleanShipName}_Training_Bulletin_${monthStr}_${yearStr}.pdf`;

  const downloadUrl = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
}
