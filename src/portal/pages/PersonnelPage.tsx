/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import { Database, KeyRound, Pencil, Plus, Upload, Search, X, FileSpreadsheet, Download } from 'lucide-react';
import { DEPARTMENT_NAMES } from '../../data/departments';
import { downloadBlob } from '../../utils/exporters';
import { readTableFile, TABLE_FILE_ACCEPT } from '../../utils/readTableFile';
import { hashPassword, newSalt, passwordProblem } from '../auth';
import { newId, parseDb } from '../db';
import { parsePersonnelTable } from '../personnelImport';
import { ranksFor } from '../../data/ranks';
import { ComboSelect } from '../../components/ComboSelect';
import { addDepartment, addSection, hasDept } from '../departmentOps';
import { activeFields, extraRequired, ROLL_FIELDS, templateCsv } from '../importFields';
import { ImportColumnsEditor } from '../ImportColumnsEditor';
import { ColumnMapper, useColumnMapping } from '../../components/ColumnMapper';
import { usePortal } from '../store';
import { Category, Person, Role, ROLE_LABEL, User } from '../types';
import { btnGhost, btnPrimary, Card, Empty, Field, inputCls, Modal, PageHeader } from '../ui';

const blank = (): Person => ({ id: '', serviceNo: '', name: '', rank: '', designation: '', category: 'Sailor', department: DEPARTMENT_NAMES[0], subDepartment: '', active: true });

export const PersonnelPage: React.FC = () => {
  const { db, user, update, subDepartments, replaceDb, customHeaders } = usePortal();
  const isAdmin = user?.role === 'ADMIN';
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('ALL');
  const [cat, setCat] = useState('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [accountFor, setAccountFor] = useState<Person | null>(null);
  const [importing, setImporting] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);

  const userOf = (id: string) => db.users.find(u => u.personId === id);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.personnel
      .filter(p => (showInactive || p.active) && (dept === 'ALL' || p.department === dept) && (cat === 'ALL' || p.category === cat))
      .filter(p => !s || `${p.name} ${p.department} ${p.subDepartment || ''} ${p.serviceNo} ${p.rank} ${p.designation || ''}`.toLowerCase().includes(s))
      .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
  }, [db.personnel, q, dept, cat, showInactive]);

  const backup = () => downloadBlob(JSON.stringify(db, null, 2), `${db.ship.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_portal_backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json;charset=utf-8');
  const restore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = parseDb(String(reader.result));
      if (next.users.length === 0) return alert('This file is not a valid portal backup (no user accounts found). Nothing was changed.');
      if (window.confirm(`Replace ALL portal data with this backup (${next.personnel.length} personnel, ${next.users.length} users, ${next.leaveRequests.length} leave requests)?`)) replaceDb(next);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={customHeaders['personnel'] || 'Nominal Roll'}
        subtitle="The ship's Nominal Roll. Departments, leave and daily figures are built on these records."
        actions={isAdmin && (
          <>
            <button className={btnPrimary} onClick={() => setEditing(blank())}><Plus className="w-3.5 h-3.5" /> Add person</button>
            <button className={btnGhost} onClick={() => setImporting(true)}><Upload className="w-3.5 h-3.5" /> Import</button>
            <button
              className={btnGhost}
              onClick={() => {
                fetch('/data/nominal_roll.json')
                  .then(r => r.ok ? r.json() : null)
                  .then(data => {
                    if (Array.isArray(data) && data.length) {
                      update(d => ({ ...d, personnel: data }));
                    }
                  });
              }}
              title="Load standard naval nominal roll entries from external data file"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>Load Roll Data</span>
            </button>
            <a href="/templates/Nominal_Roll_Template.xlsx" download="Nominal_Roll_Template.xlsx" className={btnGhost} title="Download official Excel template for Nominal Roll">
              <Download className="w-3.5 h-3.5 text-emerald-400" /> Excel Template
            </a>
            <button className={btnGhost} onClick={backup}><Database className="w-3.5 h-3.5" /> Backup</button>
            <button className={btnGhost} onClick={() => restoreRef.current?.click()}>Restore</button>
            <input ref={restoreRef} type="file" accept=".json" className="hidden" onChange={restore} />
          </>
        )}
      />

      {/* Prominent Search Bar at the Top of Nominal Roll Module */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search personnel by name or department (e.g. Sharma, Engineering, Executive, Navigation)..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-9 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
            />
            {q && (
              <button
                onClick={() => setQ('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              aria-label="Filter by category"
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
              value={cat}
              onChange={e => setCat(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option>Officer</option>
              <option>Sailor</option>
              <option>Civilian</option>
            </select>

            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-xl">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0" />
              <span className="text-[11px]">Inactive</span>
            </label>
          </div>
        </div>

        {/* Quick Filter Department Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
          <span className="text-[10px] uppercase font-mono text-slate-500 mr-1">Quick Dept:</span>
          <button
            onClick={() => setDept('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              dept === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All ({db.personnel.length})
          </button>
          {DEPARTMENT_NAMES.map(d => {
            const count = db.personnel.filter(p => p.department === d).length;
            const isSelected = dept === d;
            return (
              <button
                key={d}
                onClick={() => setDept(isSelected ? 'ALL' : d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <span>{d}</span>
                <span className={`text-[10px] font-mono px-1 rounded ${isSelected ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}

          <div className="ml-auto text-xs font-mono text-slate-400">
            {rows.length} of {db.personnel.length} listed
          </div>
        </div>
      </div>

      <Card>

        {rows.length === 0 ? (
          <Empty>{db.personnel.length === 0 ? (isAdmin ? 'No personnel yet. Use "Add person" or "Import" to enter the ship\'s roll.' : 'No personnel have been entered yet.') : 'No one matches these filters.'}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 pr-3">Personal Number</th><th className="pr-3">Name</th><th className="pr-3">Rank</th><th className="pr-3">Department</th>
                  <th className="pr-3">Category</th><th className="pr-3">Login</th>{isAdmin && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {rows.map(p => {
                  const u = userOf(p.id);
                  return (
                    <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                      <td className="py-2 pr-3 font-mono text-slate-300">{p.serviceNo}</td>
                      <td className="pr-3 font-semibold text-slate-100">{p.name}{p.designation && <span className="block text-[10px] font-normal text-slate-500">{p.designation}</span>}</td>
                      <td className="pr-3 text-slate-300">{p.rank || '—'}</td>
                      <td className="pr-3 text-slate-300">{p.department}{p.subDepartment && <span className="block text-[10px] text-slate-500">{p.subDepartment}</span>}</td>
                      <td className="pr-3 text-slate-400">{p.category}</td>
                      <td className="pr-3 text-slate-400">{u ? `${u.username} · ${ROLE_LABEL[u.role]}${u.active ? '' : ' (disabled)'}` : '—'}</td>
                      {isAdmin && (
                        <td className="text-right whitespace-nowrap">
                          <button className="p-1.5 text-slate-400 hover:text-white" title="Edit" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}><Pencil className="w-3.5 h-3.5" /></button>
                          <button className="p-1.5 text-slate-400 hover:text-white" title="Login & role" aria-label={`Login for ${p.name}`} onClick={() => setAccountFor(p)}><KeyRound className="w-3.5 h-3.5" /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <PersonForm person={editing} onClose={() => setEditing(null)} />}
      {accountFor && <AccountForm person={accountFor} onClose={() => setAccountFor(null)} />}
      {importing && <ImportForm onClose={() => setImporting(false)} />}
    </div>
  );

  function PersonForm({ person, onClose }: { person: Person; onClose: () => void }) {
    const [p, setP] = useState<Person>(person);
    const [error, setError] = useState<string | null>(null);
    const isNew = !person.id;
    const subs = subDepartments(p.department);
    const ranks = ranksFor(p.category, db.lists.ranks[p.category]);

    const save = () => {
      if (!p.serviceNo.trim() || !p.name.trim()) return setError('Personal Number and name are required.');
      if (db.personnel.some(x => x.id !== p.id && x.serviceNo.toLowerCase() === p.serviceNo.trim().toLowerCase())) return setError('That Personal Number already exists.');
      const clean = { ...p, serviceNo: p.serviceNo.trim(), name: p.name.trim() };
      update(d => ({
        ...d,
        personnel: isNew ? [...d.personnel, { ...clean, id: newId() }] : d.personnel.map(x => (x.id === clean.id ? clean : x)),
        // a person who is made inactive can no longer sign in
        users: !isNew && !clean.active ? d.users.map(u => (u.personId === clean.id ? { ...u, active: false } : u)) : d.users
      }));
      onClose();
    };

    return (
      <Modal title={isNew ? 'Add person' : `Edit ${person.name}`} onClose={onClose}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Personal Number"><input className={inputCls} value={p.serviceNo} onChange={e => setP({ ...p, serviceNo: e.target.value })} /></Field>
          <Field label="Category">
            <select className={inputCls} value={p.category} onChange={e => setP({ ...p, category: e.target.value as Category })}>
              <option>Officer</option><option>Sailor</option><option>Civilian</option>
            </select></Field>
          <div className="col-span-2"><Field label="Name"><input className={inputCls} value={p.name} onChange={e => setP({ ...p, name: e.target.value })} /></Field></div>
          <Field label="Rank"><ComboSelect noun="rank" value={p.rank} options={ranks} onChange={v => setP({ ...p, rank: v })}
            onAdd={v => update(d => (d.lists.ranks[p.category].includes(v) ? d : { ...d, lists: { ...d.lists, ranks: { ...d.lists.ranks, [p.category]: [v, ...d.lists.ranks[p.category]] } } }))} /></Field>
          <Field label="Appointment / trade"><ComboSelect noun="appointment or trade" value={p.designation} options={db.lists.designations} onChange={v => setP({ ...p, designation: v })}
            onAdd={v => update(d => (d.lists.designations.includes(v) ? d : { ...d, lists: { ...d.lists, designations: [v, ...d.lists.designations] } }))} /></Field>
          <Field label="Department">
            <ComboSelect noun="department" emptyLabel={null} value={p.department} options={DEPARTMENT_NAMES}
              onChange={v => setP({ ...p, department: v, subDepartment: '' })}
              onAdd={v => update(d => (hasDept(d, v) ? d : addDepartment(d, v)))} /></Field>
          <Field label="Section">
            <ComboSelect noun="section" value={p.subDepartment} options={subs} onChange={v => setP({ ...p, subDepartment: v })}
              onAdd={v => update(d => addSection(d, p.department, v))} /></Field>
        </div>
        {!isNew && <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={p.active} onChange={e => setP({ ...p, active: e.target.checked })} /> Active on the Nominal Roll (untick when drafted out; history is kept)</label>}
        {error && <div className="text-xs text-rose-400" role="alert">{error}</div>}
        <div className="flex justify-end gap-2"><button className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} onClick={save}>Save</button></div>
      </Modal>
    );
  }

  function AccountForm({ person, onClose }: { person: Person; onClose: () => void }) {
    const existing = userOf(person.id);
    const [username, setUsername] = useState(existing?.username || person.serviceNo.toLowerCase());
    const [role, setRole] = useState<Role>(existing?.role || 'USER');
    const [password, setPassword] = useState('');
    const [active, setActive] = useState(existing?.active ?? true);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
      const uname = username.trim().toLowerCase();
      if (!uname) return setError('Enter a username.');
      if (db.users.some(u => u.id !== existing?.id && u.username === uname)) return setError('That username is taken.');
      if (!existing || password) { const pw = passwordProblem(password); if (pw) return setError(pw); }
      const admins = db.users.filter(u => u.active && u.role === 'ADMIN');
      if (existing && existing.role === 'ADMIN' && (role !== 'ADMIN' || !active) && admins.length === 1) return setError('This is the only active administrator. Make someone else an administrator first.');
      const salt = password ? newSalt() : existing!.salt;
      const hash = password ? await hashPassword(password, salt) : existing!.hash;
      const next: User = { id: existing?.id || newId(), username: uname, displayName: person.name, role, personId: person.id, salt, hash, active };
      update(d => ({ ...d, users: existing ? d.users.map(u => (u.id === next.id ? next : u)) : [...d.users, next] }));
      onClose();
    };

    return (
      <Modal title={`Login for ${person.name}`} onClose={onClose}>
        {!person.active && <div className="text-xs text-amber-300">This person is inactive; a login will not work until they are made active again.</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username"><input className={inputCls} value={username} onChange={e => setUsername(e.target.value)} /></Field>
          <Field label="Role">
            <select className={inputCls} value={role} onChange={e => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select></Field>
          <div className="col-span-2"><Field label={existing ? 'New password (leave blank to keep)' : 'Password'} hint="At least 8 characters. Tell the person to keep it private."><input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></Field></div>
        </div>
        <p className="text-[11px] text-slate-500">A Head of Department approves leave for their own department. The Commanding Officer gives the final approval.</p>
        {existing && <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Login enabled</label>}
        {error && <div className="text-xs text-rose-400" role="alert">{error}</div>}
        <div className="flex justify-end gap-2"><button className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} onClick={save}>{existing ? 'Save login' : 'Create login'}</button></div>
      </Modal>
    );
  }

  function ImportForm({ onClose }: { onClose: () => void }) {
    const [text, setText] = useState('');
    const [result, setResult] = useState<{ people: Person[]; errors: string[] } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [columns, setColumns] = useState(false);
    const fields = activeFields(ROLL_FIELDS, db.importFields.roll);
    const map = useColumnMapping(text, fields);
    // with a header and data row the chosen column matching is applied; otherwise the parser reports what is missing
    const check = () => setResult(parsePersonnelTable(map.mappedText ?? text, db.personnel, subDepartments, newId, extraRequired(fields)));
    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const t = await readTableFile(file);
        setText(t);
        setResult(null);
      } catch (err) {
        setResult({ people: [], errors: [`Could not read ${file.name}: ${err instanceof Error ? err.message : String(err)}`] });
      }
    };
    const commit = () => {
      if (!result) return;
      update(d => ({ ...d, personnel: [...d.personnel, ...result.people] }));
      onClose();
    };
    return (
      <Modal title="Import Nominal Roll" onClose={onClose} wide>
        <p className="text-xs text-slate-400">
          Upload a CSV or Excel (.xlsx/.xls) file, or paste rows copied from Excel/Sheets. First row is a header with: <code>{fields.map(f => f.label).join(', ')}</code>.
          Required: {fields.filter(f => f.required).map(f => f.label).join(', ')}. Category is Officer, Sailor or Civilian; department is one of {DEPARTMENT_NAMES.join(', ')}. Rows with a problem are rejected with the reason; existing records are never changed.
        </p>
        <textarea rows={7} className={`${inputCls} font-mono`} value={text} onChange={e => setText(e.target.value)} placeholder={fields.map(f => f.label).join('\t')} />
        {map.table && <ColumnMapper table={map.table} fields={fields} mapping={map.mapping} onChange={map.setMapping} />}
        <div className="flex gap-2">
          <button className={btnGhost} onClick={() => fileRef.current?.click()}><Upload className="w-3.5 h-3.5" /> Upload CSV / Excel</button>
          <input ref={fileRef} type="file" accept={TABLE_FILE_ACCEPT} className="hidden" onChange={onFile} />
          <button className={btnGhost} onClick={() => downloadBlob(templateCsv(fields), 'nominal-roll-template.csv', 'text/csv;charset=utf-8')}>Download template</button>
          <button className={btnGhost} onClick={() => setColumns(true)}>Sheet columns…</button>
          <button className={btnGhost} onClick={check}>Check</button>
        </div>
        {result && (
          <div className="space-y-2 text-xs">
            {result.errors.length > 0 && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 space-y-1 max-h-40 overflow-y-auto">
                <div className="font-semibold">Rejected rows</div>
                {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
            <div className="text-emerald-400 font-semibold">{result.people.length} people ready to import</div>
          </div>
        )}
        {columns && <ImportColumnsEditor which="roll" onClose={() => setColumns(false)} />}
        <div className="flex justify-end gap-2"><button className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={!result || result.people.length === 0} onClick={commit}>Import {result?.people.length || 0}</button></div>
      </Modal>
    );
  }
};
