/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ScheduledSession, HolidayEntry, ScheduleSettings } from '../types';
import { ALL_TRACK_DEPARTMENTS, DEPARTMENT_NAMES, SHIP_WIDE } from '../data/departments';
import { downloadMonthlyBulletinPdf, generateMonthlyBulletinCanvas } from '../utils/monthlyBulletinPdf';
import {
  Download,
  Printer,
  X,
  FileText,
  Calendar,
  CheckSquare,
  Square,
  Settings2,
  ZoomIn,
  Eye,
  ShieldCheck,
  Building2
} from 'lucide-react';

interface MonthlyBulletinModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ScheduledSession[];
  holidays?: HolidayEntry[];
  shipName: string;
  shipPennant?: string;
  initialMonthDate?: Date;
  settings?: ScheduleSettings;
}

const MONTH_OPTIONS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MonthlyBulletinModal: React.FC<MonthlyBulletinModalProps> = ({
  isOpen,
  onClose,
  sessions,
  holidays = [],
  shipName,
  shipPennant = '',
  initialMonthDate,
  settings
}) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    return initialMonthDate ? initialMonthDate.getMonth() : new Date().getMonth();
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return initialMonthDate ? initialMonthDate.getFullYear() : (sessions[0] ? Number(sessions[0].date.slice(0, 4)) : 2026);
  });
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [includeInstructors, setIncludeInstructors] = useState<boolean>(true);
  const [includeVenues, setIncludeVenues] = useState<boolean>(true);
  const [includeStandingOrders, setIncludeStandingOrders] = useState<boolean>(true);
  const [includeSignOffBlock, setIncludeSignOffBlock] = useState<boolean>(true);
  const [paperSize, setPaperSize] = useState<'A4' | 'LETTER'>('A4');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const currentMonthDate = new Date(selectedYear, selectedMonth, 1);

  // Render high-res live preview on canvas
  useEffect(() => {
    if (!isOpen) return;

    try {
      const canvas = generateMonthlyBulletinCanvas({
        monthDate: currentMonthDate,
        sessions,
        holidays,
        shipName,
        shipPennant,
        departmentFilter,
        includeInstructors,
        includeVenues,
        includeStandingOrders,
        includeSignOffBlock,
        paperSize,
        settings
      });

      if (previewContainerRef.current) {
        previewContainerRef.current.innerHTML = '';
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        canvas.style.borderRadius = '8px';
        canvas.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.3)';
        previewContainerRef.current.appendChild(canvas);
      }
    } catch (e) {
      console.error('Failed to generate bulletin preview canvas:', e);
    }
  }, [
    isOpen,
    selectedMonth,
    selectedYear,
    departmentFilter,
    includeInstructors,
    includeVenues,
    includeStandingOrders,
    includeSignOffBlock,
    paperSize,
    sessions,
    holidays,
    shipName,
    shipPennant,
    settings
  ]);

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      await downloadMonthlyBulletinPdf({
        monthDate: currentMonthDate,
        sessions,
        holidays,
        shipName,
        shipPennant,
        departmentFilter,
        includeInstructors,
        includeVenues,
        includeStandingOrders,
        includeSignOffBlock,
        paperSize,
        settings
      });
    } catch (err) {
      console.error('Failed to download bulletin PDF:', err);
      alert('Could not generate PDF: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    // Generate high-res image and open print window
    const canvas = generateMonthlyBulletinCanvas({
      monthDate: currentMonthDate,
      sessions,
      holidays,
      shipName,
      shipPennant,
      departmentFilter,
      includeInstructors,
      includeVenues,
      includeStandingOrders,
      includeSignOffBlock,
      paperSize,
      settings
    });

    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to open the print dialog.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${shipName} Monthly Training Bulletin - ${MONTH_OPTIONS[selectedMonth]} ${selectedYear}</title>
          <style>
            @page {
              size: landscape;
              margin: 0.8cm;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              background-color: #fff;
            }
            img {
              width: 100%;
              max-width: 100vw;
              max-height: 96vh;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.print();window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Month sessions count for badge
  const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const monthSessionCount = sessions.filter(s => {
    if (!s.date.startsWith(monthPrefix)) return false;
    if (departmentFilter === 'ALL') return true;
    return s.department === departmentFilter;
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Ship Notice Board — Monthly Training Bulletin PDF
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Official Print Format
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Formatted specifically for {shipName} bulletin boards, wardroom notice stands, and training flats.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Customization Controls */}
          <div className="lg:col-span-4 space-y-5">
            {/* Period Selector Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Calendar className="w-4 h-4" /> Schedule Period
                </span>
                <span className="text-[11px] font-mono text-emerald-400">
                  {monthSessionCount} Sessions
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                    Month
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    {MONTH_OPTIONS.map((m, idx) => (
                      <option key={m} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                  Department Track Filter
                </label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Departments & Ship-Wide</option>
                  {ALL_TRACK_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bulletin Customization Options */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 text-blue-400">
                <Settings2 className="w-4 h-4" /> Bulletin Layout Directives
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={includeInstructors}
                    onChange={(e) => setIncludeInstructors(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
                  />
                  <span>Show Trainer / Instructor Names</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={includeVenues}
                    onChange={(e) => setIncludeVenues(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
                  />
                  <span>Show Training Flats / Compartment Venues</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={includeStandingOrders}
                    onChange={(e) => setIncludeStandingOrders(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
                  />
                  <span>Include Standing Muster & Training Orders</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={includeSignOffBlock}
                    onChange={(e) => setIncludeSignOffBlock(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
                  />
                  <span>Include XO / CO Official Sign-Off Block</span>
                </label>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                  Paper Format (Landscape)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaperSize('A4')}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                      paperSize === 'A4'
                        ? 'bg-blue-600/30 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    A4 (International)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperSize('LETTER')}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                      paperSize === 'LETTER'
                        ? 'bg-blue-600/30 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    US Letter
                  </button>
                </div>
              </div>
            </div>

            {/* Print Directives Card */}
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                <ShieldCheck className="w-3.5 h-3.5" /> High-DPI Notice Board Ready
              </div>
              <p>
                Renders high-contrast typography, color-coded track ribbons, and naval promulgation headers for pin-up display.
              </p>
            </div>
          </div>

          {/* Right Column: Live High-Resolution Preview Canvas */}
          <div className="lg:col-span-8 flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-400" /> Live Notice Board Print Preview
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                Resolution: 300 DPI Landscape ({paperSize})
              </span>
            </div>

            <div className="flex-1 bg-slate-950/90 border border-slate-800 rounded-xl p-3 overflow-auto flex items-center justify-center min-h-[380px]">
              <div ref={previewContainerRef} className="w-full max-w-4xl" />
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/70">
          <div className="text-xs text-slate-400">
            Selected: <strong className="text-white">{MONTH_OPTIONS[selectedMonth]} {selectedYear}</strong> ({monthSessionCount} sessions)
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors active:scale-95 shadow-sm"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span>Direct Print</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors active:scale-95 shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generating PDF…' : 'Download Bulletin PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
