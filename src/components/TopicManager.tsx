/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ALL_TRACK_DEPARTMENTS } from '../data/departments';
import type { ScheduledSession, Topic } from '../types';
import { newTopicId, trackFor, validateTopic } from '../training/topicEdits';

interface Props {
  topics: Topic[];
  sessions: ScheduledSession[];
  sectionsOf: (dept: string) => string[];
  onSave: (topic: Topic, isNew: boolean) => void;
  onDelete: (id: string) => string | null;
  onClearAll: () => void;
}

interface Form {
  id: string;
  title: string;
  department: string;
  subDepartment: string;
  speaker: string;
  venue: string;
  duration: string;
  prerequisiteId: string;
  description: string;
}

const field = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500';
const label = 'block text-[11px] font-semibold text-slate-400 mb-1';

const blankForm = (topics: Topic[]): Form => ({
  id: newTopicId(topics), title: '', department: '', subDepartment: '', speaker: '', venue: '', duration: '', prerequisiteId: '', description: ''
});

const formOf = (t: Topic): Form => ({
  id: t.id,
  title: t.title,
  department: t.department,
  subDepartment: t.subDepartment || '',
  speaker: t.speaker || '',
  venue: t.venue || '',
  duration: t.durationMinutes ? String(t.durationMinutes) : '',
  prerequisiteId: t.prerequisiteId || '',
  description: t.description || ''
});

/** Add, edit and delete single training topics. Saving and deleting are applied by the Training page. */
export const TopicManager: React.FC<Props> = ({ topics, sessions, sectionsOf, onSave, onDelete, onClearAll }) => {
  const [form, setForm] = useState<Form | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const plannedCount = useMemo(() => {
    const m = new Map<string, number>();
    sessions.forEach(s => m.set(s.topicId, (m.get(s.topicId) ?? 0) + 1));
    return m;
  }, [sessions]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter(t => !q || `${t.title} ${t.department} ${t.subDepartment || ''} ${t.speaker || ''} ${t.id}`.toLowerCase().includes(q));
  }, [topics, query]);

  const titleOf = (id: string | null | undefined) => topics.find(t => t.id === id)?.title ?? '';

  const openNew = () => {
    setError(null);
    setIsNew(true);
    setForm(blankForm(topics));
  };

  const openEdit = (t: Topic) => {
    setError(null);
    setIsNew(false);
    setForm(formOf(t));
  };

  const close = () => {
    setForm(null);
    setError(null);
  };

  const save = () => {
    if (!form) return;
    const topic: Topic = {
      id: form.id.trim(),
      title: form.title.trim(),
      department: form.department,
      subDepartment: form.subDepartment,
      trackType: trackFor(form.department),
      speaker: form.speaker.trim(),
      venue: form.venue.trim() || undefined,
      durationMinutes: form.duration.trim() ? Number(form.duration) : undefined,
      prerequisiteId: form.prerequisiteId || null,
      description: form.description.trim()
    };
    const problem = validateTopic(topic, topics, isNew);
    if (problem) {
      setError(problem);
      return;
    }
    onSave(topic, isNew);
    close();
  };

  const remove = (t: Topic) => {
    const planned = plannedCount.get(t.id) ?? 0;
    const msg = planned
      ? `Delete "${t.title}" and its ${planned} planned session(s)? Other topics that need it lose their prerequisite.`
      : `Delete "${t.title}"? Other topics that need it lose their prerequisite.`;
    if (!window.confirm(msg)) return;
    const problem = onDelete(t.id);
    setError(problem);
  };

  const clearAll = () => {
    const completed = sessions.filter(s => s.status === 'Completed').length;
    const msg = `Delete all ${topics.length} topic(s) and ${sessions.length} session(s)` +
      (completed ? ` (${completed} completed)` : '') +
      `? This cannot be undone. Use Backup JSON first if you need them.`;
    if (!window.confirm(msg)) return;
    setError(null);
    onClearAll();
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => (f ? { ...f, [k]: e.target.value } : f));

  const sections = form?.department ? sectionsOf(form.department) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Training topics ({topics.length})</h2>
          <p className="text-[11px] text-slate-400">Add, edit or delete single topics. Bulk lists still come from Import Topics.</p>
        </div>
        <div className="flex items-center gap-2">
          <input className={`${field} w-56`} placeholder="Search topics…" value={query} onChange={e => setQuery(e.target.value)} />
          {!form && topics.length > 0 && (
            <button onClick={clearAll} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-rose-700 text-rose-300 hover:bg-rose-950/60">
              <Trash2 className="w-3.5 h-3.5" /> Clear all topics
            </button>
          )}
          {!form && (
            <button onClick={openNew} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white">
              <Plus className="w-3.5 h-3.5" /> Add topic
            </button>
          )}
        </div>
      </div>

      {error && <div role="alert" className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-lg px-3 py-2">{error}</div>}

      {form && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 space-y-3">
          <div className="text-xs font-bold text-white">{isNew ? 'New topic' : `Edit: ${form.title || form.id}`}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={label}>ID</label>
              <input className={field} value={form.id} onChange={set('id')} disabled={!isNew} />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Title</label>
              <input className={field} value={form.title} onChange={set('title')} />
            </div>
            <div>
              <label className={label}>Department</label>
              <select className={field} value={form.department} onChange={set('department')}>
                <option value="">Choose…</option>
                {ALL_TRACK_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Section</label>
              <select className={field} value={form.subDepartment} onChange={set('subDepartment')} disabled={!form.department || form.department === 'Ship-Wide'}>
                <option value="">None</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Speaker</label>
              <input className={field} value={form.speaker} onChange={set('speaker')} />
            </div>
            <div>
              <label className={label}>Venue</label>
              <input className={field} value={form.venue} onChange={set('venue')} />
            </div>
            <div>
              <label className={label}>Duration (minutes, optional)</label>
              <input className={field} inputMode="numeric" value={form.duration} onChange={set('duration')} />
            </div>
            <div>
              <label className={label}>Prerequisite (optional)</label>
              <select className={field} value={form.prerequisiteId} onChange={set('prerequisiteId')}>
                <option value="">None</option>
                {topics.filter(t => t.id !== form.id).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className={label}>Description</label>
              <textarea className={`${field} min-h-16`} value={form.description} onChange={set('description')} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={close} className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300">Cancel</button>
            <button onClick={save} className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white">
              {isNew ? 'Add topic' : 'Save changes'}
            </button>
          </div>
          {isNew && <p className="text-[11px] text-slate-500">New topics are placed in free training slots automatically. Locked and completed sessions are not moved.</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wide">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Section</th>
              <th className="px-3 py-2">Speaker</th>
              <th className="px-3 py-2">Min</th>
              <th className="px-3 py-2">Prerequisite</th>
              <th className="px-3 py-2">Sessions</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {shown.map(t => (
              <tr key={t.id} className="hover:bg-slate-900/60">
                <td className="px-3 py-2 text-slate-100 font-medium">{t.title}<div className="text-[10px] text-slate-500 font-mono">{t.id}</div></td>
                <td className="px-3 py-2 text-slate-300">{t.department}</td>
                <td className="px-3 py-2 text-slate-400">{t.subDepartment || '—'}</td>
                <td className="px-3 py-2 text-slate-400">{t.speaker || '—'}</td>
                <td className="px-3 py-2 text-slate-400">{t.durationMinutes ?? '—'}</td>
                <td className="px-3 py-2 text-slate-400">{titleOf(t.prerequisiteId) || '—'}</td>
                <td className="px-3 py-2 text-slate-400">{plannedCount.get(t.id) ?? 0}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => openEdit(t)} aria-label={`Edit ${t.title}`} className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(t)} aria-label={`Delete ${t.title}`} className="p-1.5 rounded-md bg-slate-800 hover:bg-rose-900/60 text-rose-300">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">{topics.length === 0 ? 'No topics yet. Add one or use Import Topics.' : 'No topic matches the search.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
