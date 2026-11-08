/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { downloadBlob } from '../utils/exporters';
import { resolveFields, ROLL_FIELDS, templateCsv, TOPIC_FIELDS } from './importFields';
import { usePortal } from './store';
import type { FieldSetting } from './types';
import { btnGhost, btnPrimary, inputCls, Modal } from './ui';

const TITLE = { roll: 'Nominal Roll', topics: 'Training topics' } as const;

/**
 * Decide which columns the sheet has, what each is called and which must be filled in. The settings belong to the ship,
 * so the same blank sheet can be handed to every department and it imports the same way for everyone.
 */
export const ImportColumnsEditor: React.FC<{ which: 'roll' | 'topics'; onClose: () => void }> = ({ which, onClose }) => {
  const { db, update } = usePortal();
  const base = which === 'roll' ? ROLL_FIELDS : TOPIC_FIELDS;
  const fields = resolveFields(base, db.importFields[which]);

  const set = (key: string, patch: FieldSetting) =>
    update(d => ({ ...d, importFields: { ...d.importFields, [which]: { ...d.importFields[which], [key]: { ...d.importFields[which][key], ...patch } } } }));
  const reset = () => update(d => ({ ...d, importFields: { ...d.importFields, [which]: {} } }));

  return (
    <Modal title={`Sheet columns: ${TITLE[which]}`} onClose={onClose} wide>
      <p className="text-xs text-slate-400">
        Rename a column to the name your sheet uses, switch off columns you do not need, or make a column compulsory. A sheet that still uses the
        original name keeps working. Columns marked <strong>always</strong> are needed to create a record and can only be renamed.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-[11px] uppercase text-slate-400 border-b border-slate-800">
            <tr><th className="py-2 pr-3">Built-in column</th><th className="pr-3">Column name in the sheet</th><th className="pr-3 text-center">Used</th><th className="text-center">Compulsory</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {fields.map(f => (
              <tr key={f.key} className={f.enabled ? '' : 'opacity-60'}>
                <td className="py-2 pr-3 text-slate-300">{f.defaultLabel}</td>
                <td className="pr-3">
                  <input className={inputCls} value={db.importFields[which][f.key]?.header ?? ''} placeholder={f.defaultLabel}
                    aria-label={`Name for ${f.defaultLabel}`} onChange={e => set(f.key, { header: e.target.value })} />
                </td>
                <td className="pr-3 text-center">
                  {f.hard ? <span className="text-slate-500">always</span>
                    : <input type="checkbox" aria-label={`Use ${f.defaultLabel}`} checked={f.enabled} onChange={e => set(f.key, { enabled: e.target.checked })} />}
                </td>
                <td className="text-center">
                  {f.hard ? <span className="text-slate-500">always</span>
                    : <input type="checkbox" aria-label={`${f.defaultLabel} compulsory`} disabled={!f.enabled} checked={f.required} onChange={e => set(f.key, { required: e.target.checked })} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <button className={btnGhost} onClick={reset}>Back to defaults</button>
          <button className={btnGhost} onClick={() => downloadBlob(templateCsv(fields.filter(f => f.enabled)), `${which === 'roll' ? 'nominal-roll' : 'training-topics'}-sheet.csv`, 'text/csv;charset=utf-8')}>Download blank sheet</button>
        </div>
        <button className={btnPrimary} onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
};
