/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { HolidayEntry } from '../types';
import { Calendar, Trash2, Plus, AlertCircle, RefreshCw } from 'lucide-react';

interface BlackoutManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  blackoutDates: HolidayEntry[];
  onAddBlackout: (entry: HolidayEntry) => void;
  onRemoveBlackout: (dateStr: string) => void;
  onCascadeReschedule: () => void;
}

export const BlackoutManagerModal: React.FC<BlackoutManagerModalProps> = ({
  isOpen,
  onClose,
  blackoutDates,
  onAddBlackout,
  onRemoveBlackout,
  onCascadeReschedule
}) => {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<HolidayEntry['type']>('CORPORATE_BLACKOUT');
  const [newDesc, setNewDesc] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newName.trim()) return;

    onAddBlackout({
      date: newDate,
      name: newName.trim(),
      type: newType,
      description: newDesc.trim() || undefined
    });

    setNewName('');
    setNewDesc('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Holidays & Blackout Calendar
              </h2>
              <p className="text-xs text-slate-400">
                Observed dates excluded from annual training matrix sessions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Add New Blackout Form */}
        <form onSubmit={handleAdd} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <div className="text-xs font-bold text-slate-300">Add New Blackout / Observed Date</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Date (YYYY-MM-DD)</label>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Holiday / Blackout Name</label>
              <input
                type="text"
                required
                placeholder="Holiday or blackout name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Category</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="PUBLIC_HOLIDAY">Public Holiday</option>
                <option value="CORPORATE_BLACKOUT">Ship Blackout (sea period / maintenance)</option>
                <option value="EXECUTIVE_OFFSITE">Command Event</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <input
              type="text"
              placeholder="Optional notes or operational reasoning..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Exclusion</span>
            </button>
          </div>
        </form>

        {/* List of currently active blackouts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Currently Active Exclusions ({blackoutDates.length})</span>
            <span className="font-mono text-[11px]">All bypassed in constraint engine</span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950 sticky top-0 text-[11px] text-slate-400 uppercase">
                <tr className="border-b border-slate-800">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {blackoutDates.map(item => (
                  <tr key={item.date} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-medium text-slate-200 whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-100">
                      {item.name}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.type === 'PUBLIC_HOLIDAY'
                          ? 'bg-red-950/80 text-red-300'
                          : item.type === 'EXECUTIVE_OFFSITE'
                            ? 'bg-purple-950/80 text-purple-300'
                            : 'bg-amber-950/80 text-amber-300'
                      }`}>
                        {item.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-xs">
                      {item.description || '—'}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => onRemoveBlackout(item.date)}
                        title="Remove blackout date"
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            onClick={() => {
              onCascadeReschedule();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Apply & Cascade Reschedule</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
