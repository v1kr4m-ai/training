/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Topic } from '../types';
import { ALL_TRACK_DEPARTMENTS } from '../data/departments';
import { parseTopicTable } from '../utils/topicImport';
import { downloadBlob } from '../utils/exporters';
import { readTableFile, TABLE_FILE_ACCEPT } from '../utils/readTableFile';
import { activeFields, extraRequired, templateCsv, TOPIC_FIELDS } from '../portal/importFields';
import { ImportColumnsEditor } from '../portal/ImportColumnsEditor';
import { usePortal } from '../portal/store';
import { ColumnMapper, useColumnMapping } from './ColumnMapper';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ClipboardCheck
} from 'lucide-react';

interface TopicIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTopics: (newTopics: Topic[], mode: 'REPLACE' | 'APPEND') => void;
  currentTopics: Topic[];
}

export const TopicIngestionModal: React.FC<TopicIngestionModalProps> = ({
  isOpen,
  onClose,
  onImportTopics,
  currentTopics
}) => {
  const [rawPastedText, setRawPastedText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Topic[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'REPLACE' | 'APPEND'>('REPLACE');
  const fileRef = useRef<HTMLInputElement>(null);
  const { db } = usePortal();
  const [columns, setColumns] = useState(false);
  const fields = activeFields(TOPIC_FIELDS, db.importFields.topics);
  const map = useColumnMapping(rawPastedText, fields);

  if (!isOpen) return null;

  const parse = (text: string) => {
    const { topics, errors } = parseTopicTable(text, importMode === 'APPEND' ? currentTopics : [], extraRequired(fields));
    setParsedPreview(topics);
    setParseErrors(errors);
  };

  // with a header and data row the chosen column matching is applied; otherwise the parser reports what is missing
  const handleParseText = () => parse(map.mappedText ?? rawPastedText);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await readTableFile(file);
      setRawPastedText(text);
      setParsedPreview([]);
      setParseErrors([]);
    } catch (err) {
      setParsedPreview([]);
      setParseErrors([`Could not read ${file.name}: ${err instanceof Error ? err.message : String(err)}`]);
    }
  };

  const downloadTemplate = () =>
    downloadBlob(templateCsv(fields), 'training-topics-template.csv', 'text/csv;charset=utf-8');

  const handleApplyImport = () => {
    if (parsedPreview.length === 0) return;
    onImportTopics(parsedPreview, importMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Import Training Topics
              </h2>
              <p className="text-xs text-slate-400">
                Upload a CSV or Excel file, or paste rows copied from Excel / Google Sheets.
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

        <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-blue-200">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              First row is a header. Required columns: {fields.filter(f => f.required).map((f, i) => <span key={f.key}>{i > 0 && ', '}<strong>{f.label}</strong></span>)}.
              Department is one of {ALL_TRACK_DEPARTMENTS.join(', ')}. Other columns: {fields.filter(f => !f.required).map(f => f.label).join(', ')} (a prerequisite is a topic ID or its exact title).
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={downloadTemplate}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium text-xs transition-colors"
            >
              CSV Template
            </button>
            <a
              href="/templates/Training_Schedule_Template.xlsx"
              download="Training_Schedule_Template.xlsx"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel (.xlsx)</span>
            </a>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <label className="font-semibold">
              Paste table with header row
            </label>
            <span className="text-slate-500 font-mono text-[11px]">Tab, Comma, or Semicolon Separated</span>
          </div>
          <textarea
            rows={5}
            placeholder={fields.map(f => f.label).join('\t')}
            value={rawPastedText}
            onChange={(e) => setRawPastedText(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {map.table && <ColumnMapper table={map.table} fields={fields} mapping={map.mapping} onChange={map.setMapping} />}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Upload className="w-4 h-4 text-blue-400" />
              <span>Upload CSV / Excel</span>
            </button>
            <input ref={fileRef} type="file" accept={TABLE_FILE_ACCEPT} className="hidden" onChange={handleFile} />
            <button
              onClick={() => setColumns(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
            >
              <span>Sheet columns…</span>
            </button>
            <button
              onClick={handleParseText}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
            >
              <ClipboardCheck className="w-4 h-4 text-emerald-400" />
              <span>Check</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>Import Mode:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'REPLACE'}
                onChange={() => setImportMode('REPLACE')}
                className="text-blue-500"
              />
              <span>Replace All</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'APPEND'}
                onChange={() => setImportMode('APPEND')}
                className="text-blue-500"
              />
              <span>Append ({currentTopics.length} existing)</span>
            </label>
          </div>
        </div>

        {parseErrors.length > 0 && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Rejected rows:</span>
            </div>
            {parseErrors.map((err, idx) => (
              <div key={idx} className="text-[11px] text-rose-300/80 pl-5">
                • {err}
              </div>
            ))}
          </div>
        )}

        {parsedPreview.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>{parsedPreview.length} topics ready to import</span>
              </span>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 sticky top-0 text-[11px] text-slate-400 uppercase">
                  <tr className="border-b border-slate-800">
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3">Department</th>
                    <th className="py-2 px-3">Section</th>
                    <th className="py-2 px-3">Speaker</th>
                    <th className="py-2 px-3">Prereq</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {parsedPreview.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-1.5 px-3 font-medium text-slate-200">{item.title}</td>
                      <td className="py-1.5 px-3 text-slate-400">{item.department}</td>
                      <td className="py-1.5 px-3 text-slate-400">{item.subDepartment || '—'}</td>
                      <td className="py-1.5 px-3 text-slate-300">{item.speaker || '—'}</td>
                      <td className="py-1.5 px-3 font-mono text-purple-400 text-[11px]">
                        {item.prerequisiteId || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyImport}
            disabled={parsedPreview.length === 0}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
          >
            Import {parsedPreview.length} Topics
          </button>
        </div>
      </div>
      {columns && <ImportColumnsEditor which="topics" onClose={() => setColumns(false)} />}
    </div>
  );
};
