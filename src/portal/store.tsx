/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { applyDepartments, DEPARTMENTS } from '../data/departments';
import { hashPassword, newSalt, verifyPassword } from './auth';
import { newId, parseDb } from './db';
import { dbKey, ShipRef, sessionKey } from './registry';
import { blankShip, ShipProfile } from './ship';
import { TUSHIL_ID, tushilSeed } from './tushilSeed';
import { useShips } from './ships';
import type { Db, Person, User } from './types';

/** Profile a ship starts with before anyone edits it. */
const seedFor = (s: ShipRef): ShipProfile => (s.id === TUSHIL_ID ? tushilSeed() : blankShip(s.name, s.pennant));

interface Store {
  db: Db;
  shipId: string;
  ship: ShipProfile;
  updateShip: (p: ShipProfile) => void;
  update: (fn: (d: Db) => Db) => void;
  user: User | null;
  /** The signed-in user's own personnel record, if linked. */
  me: Person | null;
  setupAdmin: (username: string, displayName: string, password: string) => Promise<string | null>;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
  subDepartments: (dept: string) => string[];
  replaceDb: (d: Db) => void;
  navPosition: 'top' | 'side';
  setNavPosition: (pos: 'top' | 'side') => void;
  pinNavBar: boolean;
  setPinNavBar: (pin: boolean) => void;
  showGunneryOnHome: boolean;
  setShowGunneryOnHome: (show: boolean) => void;
  customHeaders: Record<string, string>;
  setCustomHeader: (key: string, value: string) => void;
  hasPendingLanSync: boolean;
  pendingLanSyncCount: number;
  lastLanSyncAt: string | null;
  markLanSynced: () => void;
  notifyLanDataChanged: () => void;
}

const Ctx = createContext<Store | null>(null);

export const usePortal = (): Store => {
  const s = useContext(Ctx);
  if (!s) throw new Error('usePortal outside PortalProvider');
  return s;
};

/** Data of one ship. Mount with key={ship.id} so switching ships loads that ship's own data. */
export const PortalProvider: React.FC<{ ship: ShipRef; children: React.ReactNode }> = ({ ship: ref, children }) => {
  const { renameShip } = useShips();
  const DB = dbKey(ref.id);
  const SESSION = sessionKey(ref.id);
  const [db, setDb] = useState<Db>(() => {
    try { return parseDb(localStorage.getItem(DB), seedFor(ref)); } catch { return parseDb(null, seedFor(ref)); }
  });
  const [userId, setUserId] = useState<string | null>(() => {
    try { return sessionStorage.getItem(SESSION); } catch { return null; }
  });

  // everything entered in the portal is kept in this browser, per ship
  useEffect(() => {
    try { localStorage.setItem(DB, JSON.stringify(db)); } catch (e) { console.error('Could not save the portal data', e); }
  }, [db, DB]);

  // Auto-load nominal roll from external asset file if empty (avoids embedding data in code)
  useEffect(() => {
    if (db.personnel.length === 0) {
      fetch('/data/nominal_roll.json')
        .then(res => (res.ok ? res.json() : null))
        .then((data: Person[] | null) => {
          if (Array.isArray(data) && data.length > 0) {
            setDb(prev => (prev.personnel.length === 0 ? { ...prev, personnel: data } : prev));
          }
        })
        .catch(err => console.info('Note: external nominal_roll.json not loaded:', err));
    }
  }, [db.personnel.length]);

  const [navPosition, setNavPosition] = useState<'top' | 'side'>(() => {
    try { return (localStorage.getItem('nav_position' as string) as 'top' | 'side') || 'top'; } catch { return 'top'; }
  });

  const [pinNavBar, setPinNavBar] = useState<boolean>(() => {
    try { return localStorage.getItem('pin_nav_bar') === 'true'; } catch { return false; }
  });

  const [showGunneryOnHome, setShowGunneryOnHome] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('show_gunnery_on_home');
      return v === null ? true : v === 'true';
    } catch {
      return true;
    }
  });

  const [customHeaders, setCustomHeaders] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('custom_headers') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem('nav_position', navPosition); } catch (e) { console.error('Could not save nav position', e); }
  }, [navPosition]);

  useEffect(() => {
    try { localStorage.setItem('pin_nav_bar', String(pinNavBar)); } catch (e) { console.error('Could not save pinNavBar', e); }
  }, [pinNavBar]);

  useEffect(() => {
    try { localStorage.setItem('show_gunnery_on_home', String(showGunneryOnHome)); } catch (e) { console.error('Could not save showGunneryOnHome', e); }
  }, [showGunneryOnHome]);

  useEffect(() => {
    try { localStorage.setItem('custom_headers', JSON.stringify(customHeaders)); } catch (e) { console.error('Could not save custom headers', e); }
  }, [customHeaders]);

  const LAN_SYNC_KEY = `tushil_lan_sync_state_${ref.id}`;
  const [lanSyncMeta, setLanSyncMeta] = useState<{ pendingCount: number; lastSyncedAt: string | null }>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(LAN_SYNC_KEY) || 'null');
      return {
        pendingCount: typeof parsed?.pendingCount === 'number' ? parsed.pendingCount : 1,
        lastSyncedAt: parsed?.lastSyncedAt || null,
      };
    } catch {
      return { pendingCount: 1, lastSyncedAt: null };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LAN_SYNC_KEY, JSON.stringify(lanSyncMeta));
    } catch {
      // ignore storage errors
    }
  }, [LAN_SYNC_KEY, lanSyncMeta]);

  const notifyLanDataChanged = useCallback(() => {
    setLanSyncMeta(prev => ({ ...prev, pendingCount: prev.pendingCount + 1 }));
  }, []);

  const markLanSynced = useCallback(() => {
    setLanSyncMeta({ pendingCount: 0, lastSyncedAt: new Date().toISOString() });
  }, []);

  useEffect(() => {
    const onCustomChange = () => notifyLanDataChanged();
    window.addEventListener('tushil:data-updated', onCustomChange);
    return () => window.removeEventListener('tushil:data-updated', onCustomChange);
  }, [notifyLanDataChanged]);

  // the department list is shared by every module, so it is rewritten before anything below renders
  useMemo(() => applyDepartments(db.departments), [db.departments]);

  const user = useMemo(() => db.users.find(u => u.id === userId && u.active) || null, [db.users, userId]);
  const me = useMemo(() => db.personnel.find(p => p.id === user?.personId) || null, [db.personnel, user]);

  const update = useCallback((fn: (d: Db) => Db) => {
    setDb(fn);
    setLanSyncMeta(prev => ({ ...prev, pendingCount: prev.pendingCount + 1 }));
  }, []);
  const updateShip = (p: ShipProfile) => {
    setDb(d => ({ ...d, ship: p }));
    renameShip(ref.id, p.name.trim() || ref.name, p.pennant.trim());
    setLanSyncMeta(prev => ({ ...prev, pendingCount: prev.pendingCount + 1 }));
  };

  // a restored backup may carry a different ship profile: keep the ship list in step with it
  const replaceDb = (d: Db) => {
    setDb(d);
    renameShip(ref.id, d.ship.name.trim() || ref.name, d.ship.pennant.trim());
    setLanSyncMeta(prev => ({ ...prev, pendingCount: prev.pendingCount + 1 }));
  };

  const signIn = (id: string) => {
    setUserId(id);
    try { sessionStorage.setItem(SESSION, id); } catch { /* private mode: session lasts until reload */ }
  };

  const setupAdmin: Store['setupAdmin'] = async (username, displayName, password) => {
    if (db.users.length > 0) return 'An administrator already exists.';
    const salt = newSalt();
    const admin: User = {
      id: newId(), username: username.trim().toLowerCase(), displayName: displayName.trim(), role: 'ADMIN',
      personId: null, salt, hash: await hashPassword(password, salt), active: true
    };
    setDb(d => ({ ...d, users: [admin] }));
    signIn(admin.id);
    return null;
  };

  const login: Store['login'] = async (username, password) => {
    const u = db.users.find(x => x.active && x.username === username.trim().toLowerCase());
    // same message for unknown user and wrong password
    if (!u || !(await verifyPassword(password, u.salt, u.hash))) return 'Wrong username or password.';
    signIn(u.id);
    return null;
  };

  const logout = () => {
    setUserId(null);
    try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ }
  };

  const subDepartments = useCallback((dept: string) => db.subDepartments[dept] ?? DEPARTMENTS[dept]?.subDepartments ?? [], [db.subDepartments]);

  const setCustomHeader = useCallback((key: string, value: string) => {
    setCustomHeaders(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <Ctx.Provider
      value={{
        db,
        shipId: ref.id,
        ship: db.ship,
        updateShip,
        update,
        user,
        me,
        setupAdmin,
        login,
        logout,
        subDepartments,
        replaceDb,
        navPosition,
        setNavPosition,
        pinNavBar,
        setPinNavBar,
        showGunneryOnHome,
        setShowGunneryOnHome,
        customHeaders,
        setCustomHeader,
        hasPendingLanSync: lanSyncMeta.pendingCount > 0,
        pendingLanSyncCount: lanSyncMeta.pendingCount,
        lastLanSyncAt: lanSyncMeta.lastSyncedAt,
        markLanSynced,
        notifyLanDataChanged,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};
