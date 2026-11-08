/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { hasCrypto, passwordProblem } from './auth';
import { ShipSwitcher } from './ShipSwitcher';
import { usePortal } from './store';
import { btnPrimary, Field, inputCls } from './ui';

export const Login: React.FC = () => {
  const { db, login, setupAdmin, ship } = usePortal();
  const setup = db.users.length === 0;
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (setup) {
      if (!username.trim() || !displayName.trim()) return setError('Enter a username and a display name.');
      const p = passwordProblem(password);
      if (p) return setError(p);
      if (password !== confirm) return setError('The two passwords do not match.');
    }
    setBusy(true);
    try {
      const err = setup ? await setupAdmin(username, displayName, password) : await login(username, password);
      if (err) setError(err);
    } catch {
      setError('Could not complete sign-in in this browser.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0c0f]">
      <form onSubmit={submit} className="w-full max-w-sm bg-white/[0.04] border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl backdrop-blur">
        <div className="text-center space-y-1">
          <h1 className="text-lg font-extrabold text-white">{ship.name} Portal</h1>
          <p className="text-xs text-slate-400">{setup ? `First start for ${ship.name}: create this ship's administrator account.` : 'Sign in to continue.'}</p>
          <div className="text-left"><ShipSwitcher variant="block" /></div>
        </div>

        {!hasCrypto() && (
          <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-lg p-2">
            This browser blocks secure password hashing on this address. Open the portal at http://localhost (or over https) to sign in.
          </div>
        )}

        <Field label="Username">
          <input className={inputCls} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus />
        </Field>
        {setup && (
          <Field label="Display name" hint="Shown on approvals and orders.">
            <input className={inputCls} value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </Field>
        )}
        <Field label="Password" hint={setup ? 'At least 8 characters.' : undefined}>
          <input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} autoComplete={setup ? 'new-password' : 'current-password'} />
        </Field>
        {setup && (
          <Field label="Confirm password">
            <input type="password" className={inputCls} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
        )}

        {error && <div className="text-xs text-rose-400" role="alert">{error}</div>}

        <button type="submit" disabled={busy || !hasCrypto()} className={`${btnPrimary} w-full justify-center`}>
          {busy ? 'Please wait…' : setup ? 'Create administrator' : 'Sign in'}
        </button>

        <p className="text-[10px] text-slate-600 leading-relaxed">
          Data is stored in this browser only. The login controls access to the screens; it is not protection against someone who can open this PC's browser data. Keep regular JSON backups.
        </p>
      </form>
    </div>
  );
};
