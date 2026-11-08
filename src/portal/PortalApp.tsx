/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Bell, Building2, CalendarDays, GraduationCap, Home, LogOut, Users, Settings, ChevronRight } from 'lucide-react';
import { Login } from './Login';
import { PortalProvider, usePortal } from './store';
import { ShipsProvider, useShips } from './ships';
import { ShipSwitcher } from './ShipSwitcher';
import { trainingKey } from './registry';
import { useLiveStats } from './stats';
import { ROLE_LABEL } from './types';
import { HomePage } from './pages/HomePage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { PersonnelPage } from './pages/PersonnelPage';
import { LeavePage } from './pages/LeavePage';
import { SettingsPage } from './pages/SettingsPage';
import { TrainingModule } from '../training/TrainingModule';

const NAV = [
  { path: 'home', label: 'Home', icon: Home },
  { path: 'departments', label: 'Departments', icon: Building2 },
  { path: 'personnel', label: 'Nominal Roll', icon: Users },
  { path: 'leave', label: 'Leave', icon: CalendarDays },
  { path: 'training', label: 'Training', icon: GraduationCap },
  { path: 'settings', label: 'Settings', icon: Settings },
] as const;

const currentPath = () => window.location.hash.replace(/^#\/?/, '') || 'home';

const Shell: React.FC = () => {
  const { user, logout, shipId, ship, navPosition, setNavPosition } = usePortal();
  const stats = useLiveStats();
  const [path, setPath] = useState(currentPath);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  if (!user) return <Login />;

  const [section, arg] = path.split('/');
  const go = (p: string) => { window.location.hash = `/${p}`; };
  const initials = user.displayName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className={`min-h-screen bg-[#0a0c0f] text-slate-100 antialiased [background-image:radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_60%)] ${navPosition === 'side' ? 'flex' : ''}`}>
      {/* Navigation */}
      {navPosition === 'side' ? (
        <>
          <aside
            className={`fixed left-0 top-0 h-screen z-[110] border-r border-white/10 bg-black/50 backdrop-blur-md p-4 flex flex-col gap-6 no-print transition-all duration-300 ease-in-out ${
              isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full overflow-hidden'
            }`}
          >
            <button onClick={() => go('home')} className="flex items-center gap-2.5 pl-1 pr-2 shrink-0" aria-label="Home">
              <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-black text-sm">
                {(ship.name.replace(/^(INS|INAS|IN)\s+/i, '')[0] || '?').toUpperCase()}
              </span>
              <span className="text-sm font-bold text-white tracking-tight">{ship.name}</span>
            </button>

            <nav className="flex flex-col gap-1" aria-label="Modules">
              {NAV.map(n => {
                const Icon = n.icon;
                const active = section === n.path;
                return (
                  <button
                    key={n.path}
                    onClick={() => { go(n.path); setIsSidebarOpen(false); }}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> <span>{n.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto space-y-4">
              <ShipSwitcher variant="block" />
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10" title={`${user.displayName} · ${ROLE_LABEL[user.role]}`}>
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 border border-white/20 flex items-center justify-center text-[10px] font-bold">{initials}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate text-white">{user.displayName}</p>
                  <p className="text-[10px] text-white/50">{ROLE_LABEL[user.role]}</p>
                </div>
                <button onClick={logout} className="p-2 text-white/50 hover:text-white" aria-label="Sign out" title="Sign out"><LogOut className="w-4 h-4" /></button>
              </div>
            </div>
          </aside>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`fixed left-0 top-1/2 -translate-y-1/2 z-[120] flex items-center justify-center w-8 h-12 rounded-r-xl bg-black/50 border border-white/10 border-l-0 backdrop-blur-md transition-all duration-300 hover:w-10 hover:bg-white/10 group`}
            aria-label="Toggle Sidebar"
          >
            <ChevronRight className={`w-4 h-4 text-white transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : 'group-hover:translate-x-1'}`} />
          </button>
        </>
      ) : (
        <header className="sticky top-0 z-[100] px-3 sm:px-6 pt-3 no-print">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md px-3 py-2">
            <button onClick={() => go('home')} className="flex items-center gap-2.5 pl-1 pr-2 shrink-0" aria-label="Home">
              <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-black text-sm">
                {(ship.name.replace(/^(INS|INAS|IN)\s+/i, '')[0] || '?').toUpperCase()}
              </span>
              <span className="hidden sm:block text-sm font-bold text-white tracking-tight">{ship.name}</span>
            </button>

            <nav className="flex items-center justify-center gap-1 order-last md:order-none w-full md:w-auto" aria-label="Modules">
              {NAV.map(n => {
                const Icon = n.icon;
                const active = section === n.path;
                return (
                  <button
                    key={n.path}
                    onClick={() => go(n.path)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> <span className="hidden md:inline">{n.label}</span>
                    <span className="md:hidden sr-only">{n.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <ShipSwitcher />
              <button
                onClick={() => go('leave')}
                aria-label={stats.waiting ? `${stats.waiting} leave requests awaiting your decision` : 'Notifications: nothing waiting'}
                title={stats.waiting ? `${stats.waiting} leave request(s) awaiting your decision` : 'Nothing waiting for you'}
                className="relative w-9 h-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
              >
                <Bell className="w-4 h-4" />
                {stats.waiting > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-400 text-black text-[10px] font-bold flex items-center justify-center">{stats.waiting}</span>}
              </button>
              <div className="flex items-center gap-2 pl-1" title={`${user.displayName} · ${ROLE_LABEL[user.role]}`}>
                <span className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 border border-white/20 flex items-center justify-center text-xs font-bold">{initials}</span>
                <button onClick={logout} className="p-2 text-white/50 hover:text-white" aria-label="Sign out" title="Sign out"><LogOut className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {/* Live ticker */}
          <div className="max-w-7xl mx-auto mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur px-3 py-2 text-[11px] text-white/80">
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /></span>
            <span className="truncate">
              Today: <strong className="text-white">{stats.onBoard}</strong> present · <strong className="text-white">{stats.away}</strong> on leave
              {stats.waiting > 0 && <> · <strong className="text-emerald-300">{stats.waiting}</strong> leave request{stats.waiting > 1 ? 's' : ''} awaiting your decision</>}
              {stats.active === 0 && ' · Nominal Roll is empty'}
            </span>
            <button onClick={() => go(stats.waiting > 0 ? 'leave' : 'personnel')} className="ml-auto shrink-0 px-3 py-1 rounded-full border border-white/10 bg-white/10 hover:bg-white/15 text-white">
              {stats.waiting > 0 ? 'Review' : 'See more'}
            </button>
          </div>
        </header>
      )}

      <main className={`px-3 sm:px-6 py-5 max-w-7xl w-full mx-auto ${navPosition === 'side' ? (isSidebarOpen ? 'ml-64' : '') : 'mt-16 sm:mt-20'} transition-all duration-300`}>
        {section === 'home' && <HomePage go={go} />}
        {section === 'departments' && <DepartmentsPage selected={arg ? decodeURIComponent(arg) : null} go={go} />}
        {section === 'personnel' && <PersonnelPage />}
        {section === 'leave' && <LeavePage />}
        {section === 'settings' && <SettingsPage />}
        {section === 'training' && <TrainingModule key={shipId} storageKey={trainingKey(shipId)} canEdit={user.role !== 'USER'} isAdmin={user.role === 'ADMIN'} />}
        {!NAV.some(n => n.path === section) && <HomePage go={go} />}
      </main>
    </div>
  );
};

/** Mounted per ship (key) so each ship loads its own data. */
const Workspace: React.FC = () => {
  const { active } = useShips();
  return (
    <PortalProvider key={active.id} ship={active}>
      <Shell />
    </PortalProvider>
  );
};

export const PortalApp: React.FC = () => (
  <ShipsProvider>
    <Workspace />
  </ShipsProvider>
);
