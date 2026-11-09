/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Bell,
  Building2,
  CalendarDays,
  GraduationCap,
  Home,
  LogOut,
  Users,
  Settings,
  ChevronRight,
  ChevronDown,
  Radio,
  Pin
} from 'lucide-react';
import { Login } from './Login';
import { PortalProvider, usePortal } from './store';
import { ShipsProvider, useShips } from './ships';
import { ShipSwitcher } from './ShipSwitcher';
import { trainingKey } from './registry';
import { useLiveStats } from './stats';
import { ROLE_LABEL, type SystemNotification } from './types';
import { HomePage } from './pages/HomePage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { PersonnelPage } from './pages/PersonnelPage';
import { LeavePage } from './pages/LeavePage';
import { SettingsPage } from './pages/SettingsPage';
import { DailyOrdersPage } from './pages/DailyOrdersPage';
import { WatchAndStationBillManager } from './pages/WatchAndStationBillManager';
import { TrainingModule } from '../training/TrainingModule';
import { PWAInstallButton, OfflineIndicator } from '../components/PWAInstallButton';
import { LanSyncManager } from './LanSyncManager';
import { Modal } from './ui';

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
  const {
    db,
    user,
    logout,
    shipId,
    ship,
    navPosition,
    pinNavBar,
    setPinNavBar,
    me,
    update,
    hasPendingLanSync,
    pendingLanSyncCount
  } = usePortal();
  const stats = useLiveStats();
  const [path, setPath] = useState(currentPath);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarArrowHovered, setIsSidebarArrowHovered] = useState(false);
  const [isTopbarExpanded, setIsTopbarExpanded] = useState(false);
  const [isTopbarArrowHovered, setIsTopbarArrowHovered] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLanSyncOpen, setIsLanSyncOpen] = useState(false);

  useEffect(() => {
    const on = () => {
      const next = currentPath();
      setPath(next);
      // Auto-collapse temporary topbar expansion when changing pages unless pinned
      setIsTopbarExpanded(false);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // Filter notifications relevant to current user
  const userNotifs = useMemo(() => {
    const list = db.notifications || [];
    return list.filter((n: SystemNotification) => {
      if (n.targetRole && n.targetRole !== user?.role && user?.role !== 'ADMIN') return false;
      if (n.targetPersonId && me && n.targetPersonId !== me.id) return false;
      if (n.targetDepartment && me && n.targetDepartment !== me.department && user?.role !== 'ADMIN' && user?.role !== 'CO' && user?.role !== 'EXO') return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db.notifications, user?.role, me]);

  const unreadNotifsCount = userNotifs.filter((n: SystemNotification) => !n.read).length;
  const totalAlertCount = Math.max(stats.waiting, unreadNotifsCount);

  const markAllNotifsRead = () => {
    update(d => ({
      ...d,
      notifications: (d.notifications || []).map((n: SystemNotification) => ({ ...n, read: true }))
    }));
  };

  const markOneNotifRead = (id: string) => {
    update(d => ({
      ...d,
      notifications: (d.notifications || []).map((n: SystemNotification) => n.id === id ? { ...n, read: true } : n)
    }));
  };

  if (!user) return <Login />;

  const [section, arg] = path.split('/');
  const go = (p: string) => { window.location.hash = `/${p}`; };
  const initials = user.displayName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // Top bar visibility: always visible on 'home' or when pinned in Settings (`pinNavBar`), or when manually expanded
  const isTopBarVisible = section === 'home' || pinNavBar || isTopbarExpanded;
  const isSideBarVisible = pinNavBar || isSidebarOpen;

  return (
    <div className={`min-h-screen bg-[#0a0c0f] text-slate-100 antialiased [background-image:radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_60%)] ${navPosition === 'side' ? 'flex' : ''}`}>
      {/* Navigation */}
      {navPosition === 'side' ? (
        <>
          <aside
            className={`fixed left-0 top-0 h-screen z-[110] border-r border-white/10 bg-black/75 backdrop-blur-xl p-4 flex flex-col gap-6 no-print transition-all duration-300 ease-in-out ${
              isSideBarVisible ? 'w-64 translate-x-0' : 'w-0 -translate-x-full overflow-hidden'
            }`}
          >
            <div className="flex items-center justify-between">
              <button onClick={() => go('home')} className="flex items-center gap-2.5 pl-1 pr-2 shrink-0" aria-label="Home">
                <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-black text-sm">
                  {(ship.name.replace(/^(INS|INAS|IN)\s+/i, '')[0] || '?').toUpperCase()}
                </span>
                <span className="text-sm font-bold text-white tracking-tight">{ship.name}</span>
              </button>
              <button
                onClick={() => setPinNavBar(!pinNavBar)}
                title={pinNavBar ? 'Unpin sidebar (auto-hide)' : 'Fix / Pin sidebar open'}
                className={`p-1.5 rounded-lg border transition-colors ${
                  pinNavBar
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1" aria-label="Modules">
              {NAV.map(n => {
                const Icon = n.icon;
                const active = section === n.path;
                return (
                  <button
                    key={n.path}
                    onClick={() => { go(n.path); if (!pinNavBar) setIsSidebarOpen(false); }}
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

            <div className="mt-auto space-y-3">
              <button
                onClick={() => setIsLanSyncOpen(true)}
                title={
                  hasPendingLanSync
                    ? `${pendingLanSyncCount} new data update(s) detected — click to sync to other devices`
                    : 'Offline PWA & Multi-PC LAN Sync (Harbour / Sea Mode)'
                }
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  hasPendingLanSync
                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.25)] animate-pulse'
                    : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <span>LAN Sync</span>
                </span>
                {hasPendingLanSync && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-[10px] font-bold text-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    {pendingLanSyncCount} update{pendingLanSyncCount === 1 ? '' : 's'}
                  </span>
                )}
              </button>
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

          {/* Left-edge Arrow Handle + Parallel Bulging Icons Dock on Hover */}
          <div
            onMouseEnter={() => setIsSidebarArrowHovered(true)}
            onMouseLeave={() => setIsSidebarArrowHovered(false)}
            className={`fixed top-1/2 -translate-y-1/2 z-[125] flex items-center no-print transition-all duration-300 ${
              isSideBarVisible ? 'left-64' : 'left-0'
            }`}
          >
            {/* Arrow Toggle Handle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="flex items-center justify-center w-8 h-14 rounded-r-2xl bg-slate-900/90 border border-white/15 border-l-0 backdrop-blur-md shadow-xl transition-all duration-300 hover:w-10 hover:bg-blue-600/30 group"
              aria-label="Toggle Sidebar"
              title="Hover for quick module icons · Click to toggle sidebar"
            >
              <ChevronRight className={`w-4 h-4 text-white transition-transform duration-300 ${isSideBarVisible ? 'rotate-180' : 'group-hover:translate-x-0.5'}`} />
            </button>

            {/* Bulging Icons Parallel Dock when sidebar is collapsed and arrow is hovered */}
            {!isSideBarVisible && (
              <div
                className={`flex flex-col gap-2.5 pl-2 py-3 transition-all duration-300 ${
                  isSidebarArrowHovered
                    ? 'opacity-100 translate-x-0 pointer-events-auto'
                    : 'opacity-0 -translate-x-8 scale-75 pointer-events-none'
                }`}
              >
                {NAV.map((n, idx) => {
                  const Icon = n.icon;
                  const active = section === n.path;
                  return (
                    <button
                      key={n.path}
                      onClick={() => {
                        go(n.path);
                        setIsSidebarArrowHovered(false);
                      }}
                      style={{ transitionDelay: `${idx * 25}ms` }}
                      className={`group/item flex items-center gap-2.5 px-3 py-2 rounded-full border shadow-2xl backdrop-blur-xl transition-all duration-200 hover:scale-110 hover:translate-x-1.5 whitespace-nowrap ${
                        active
                          ? 'bg-blue-600 text-white border-blue-400 shadow-blue-950/60'
                          : 'bg-slate-900/95 text-slate-200 border-white/15 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-semibold pr-1">{n.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Top Bar: Shown on Home page, or when pinNavBar is true, or when manually expanded */}
          {isTopBarVisible ? (
            <header className="sticky top-0 z-[100] px-3 sm:px-6 pt-3 no-print animate-fadeIn">
              <div className="relative z-30 max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md px-3 py-2">
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

                <div className="flex items-center gap-2 shrink-0 relative">
                  <PWAInstallButton />
                  <button
                    onClick={() => setIsLanSyncOpen(true)}
                    title={
                      hasPendingLanSync
                        ? `${pendingLanSyncCount} new data update(s) detected — sync to other devices available`
                        : 'Offline PWA & Multi-PC LAN Sync (Harbour / Sea Mode)'
                    }
                    className={`relative hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-all duration-500 ${
                      hasPendingLanSync
                        ? 'border-emerald-400/60 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.28)] animate-pulse'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <Radio className={`w-3.5 h-3.5 ${hasPendingLanSync ? 'text-emerald-300' : 'text-emerald-400'}`} />
                    <span>LAN Sync</span>
                    {hasPendingLanSync && (
                      <span className="inline-flex items-center gap-1 ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-[10px] font-bold text-emerald-200">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                        </span>
                        <span>{pendingLanSyncCount}</span>
                      </span>
                    )}
                  </button>
                  <ShipSwitcher />

                  {/* Pin / Fix Top Bar Toggle Button */}
                  <button
                    onClick={() => setPinNavBar(!pinNavBar)}
                    title={pinNavBar ? 'Top Bar is Fixed across all pages (Click to auto-hide on subpages)' : 'Auto-hide Top Bar on non-Home pages (Click to Fix Top Bar)'}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
                      pinNavBar
                        ? 'border-blue-500/60 bg-blue-600/20 text-blue-300'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>

                  {/* Notification Bell Button */}
                  <button
                    onClick={() => setIsNotifOpen(prev => !prev)}
                    aria-label={totalAlertCount ? `${totalAlertCount} alerts or leave requests awaiting your decision` : 'Notifications: nothing waiting'}
                    title={totalAlertCount ? `${totalAlertCount} alerts/pending actions` : 'Notifications'}
                    className="relative w-9 h-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <Bell className="w-4 h-4" />
                    {totalAlertCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-400 text-black text-[10px] font-bold flex items-center justify-center">
                        {totalAlertCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Popover Dropdown */}
                  {isNotifOpen && (
                    <div className="absolute right-0 top-11 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl z-[150] overflow-hidden text-xs">
                      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-blue-400" />
                          <span className="font-bold text-white text-xs">Command Notifications</span>
                          {unreadNotifsCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                              {unreadNotifsCount} new
                            </span>
                          )}
                        </div>
                        {userNotifs.length > 0 && (
                          <button
                            onClick={markAllNotifsRead}
                            className="text-[10px] text-slate-400 hover:text-white hover:underline"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                        {stats.waiting > 0 && (
                          <div
                            onClick={() => { go('leave'); setIsNotifOpen(false); }}
                            className="p-3 bg-emerald-950/40 hover:bg-emerald-900/40 cursor-pointer transition-colors flex items-start gap-2.5"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
                            <div>
                              <div className="font-bold text-emerald-200">
                                {stats.waiting} Leave Request{stats.waiting > 1 ? 's' : ''} Awaiting Your Decision
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Click to review and recommend/approve in the Approvals queue.
                              </div>
                            </div>
                          </div>
                        )}

                        {userNotifs.length === 0 && stats.waiting === 0 ? (
                          <div className="p-6 text-center text-slate-500 text-xs">
                            No notifications at this time.
                          </div>
                        ) : (
                          userNotifs.map((n: SystemNotification) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                markOneNotifRead(n.id);
                                if (n.link) go(n.link);
                                setIsNotifOpen(false);
                              }}
                              className={`p-3 hover:bg-slate-800/50 cursor-pointer transition-colors flex items-start gap-2.5 ${
                                !n.read ? 'bg-blue-950/20' : ''
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-blue-400' : 'bg-slate-700'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`font-semibold truncate ${!n.read ? 'text-white' : 'text-slate-300'}`}>
                                    {n.title}
                                  </span>
                                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                                    {n.createdAt.slice(11, 16)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                  {n.message}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pl-1" title={`${user.displayName} · ${ROLE_LABEL[user.role]}`}>
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 border border-white/20 flex items-center justify-center text-xs font-bold">{initials}</span>
                    <button onClick={logout} className="p-2 text-white/50 hover:text-white" aria-label="Sign out" title="Sign out"><LogOut className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>

              {/* Live ticker */}
              <div className="relative z-10 max-w-7xl mx-auto mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur px-3 py-2 text-[11px] text-white/80">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /></span>
                <span className="truncate">
                  Today: <strong className="text-white">{stats.onBoard}</strong> present · <strong className="text-white">{stats.away}</strong> on leave
                  {stats.waiting > 0 && <> · <strong className="text-emerald-300">{stats.waiting}</strong> leave request{stats.waiting > 1 ? 's' : ''} awaiting your decision</>}
                  {stats.active === 0 && ' · Nominal Roll is empty'}
                </span>
                <button onClick={() => go(stats.waiting > 0 ? 'leave' : 'personnel')} className="ml-auto shrink-0 px-3 py-1 rounded-full border border-white/10 bg-white/10 hover:bg-white/15 text-white">
                  {stats.waiting > 0 ? 'Review' : 'See more'}
                </button>
                {section !== 'home' && !pinNavBar && (
                  <button
                    onClick={() => setIsTopbarExpanded(false)}
                    className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold"
                  >
                    Hide Bar ↑
                  </button>
                )}
              </div>
            </header>
          ) : (
            /* Hidden Top Bar Mode (when on non-home pages and not pinned): Top-edge Arrow Handle + Parallel Bulging Icons on Hover */
            <div
              onMouseEnter={() => setIsTopbarArrowHovered(true)}
              onMouseLeave={() => setIsTopbarArrowHovered(false)}
              className="fixed top-0 left-1/2 -translate-x-1/2 z-[125] flex flex-col items-center no-print"
            >
              <button
                onClick={() => setIsTopbarExpanded(true)}
                className="flex items-center justify-center gap-1.5 px-5 h-7 rounded-b-2xl bg-slate-900/90 border border-white/15 border-t-0 backdrop-blur-md shadow-xl transition-all duration-300 hover:h-9 hover:bg-blue-600/30 group"
                aria-label="Show Top Navigation Bar"
                title="Hover for bulging module icons · Click to open full Top Bar"
              >
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-300 group-hover:text-white">
                  {ship.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-white transition-transform duration-300 group-hover:translate-y-0.5" />
              </button>

              {/* Parallel Bulging Icons Dock emerging downward from the top screen edge on hover */}
              <div
                className={`flex flex-wrap items-center justify-center gap-2 pt-2 px-4 transition-all duration-300 ${
                  isTopbarArrowHovered
                    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                    : 'opacity-0 -translate-y-6 scale-75 pointer-events-none'
                }`}
              >
                {NAV.map((n, idx) => {
                  const Icon = n.icon;
                  const active = section === n.path;
                  return (
                    <button
                      key={n.path}
                      onClick={() => {
                        go(n.path);
                        setIsTopbarArrowHovered(false);
                      }}
                      style={{ transitionDelay: `${idx * 25}ms` }}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-2xl backdrop-blur-xl transition-all duration-200 hover:scale-110 hover:translate-y-1 whitespace-nowrap ${
                        active
                          ? 'bg-blue-600 text-white border-blue-400 shadow-blue-950/60'
                          : 'bg-slate-900/95 text-slate-200 border-white/15 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-semibold">{n.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <main
        className={`px-3 sm:px-6 py-5 max-w-7xl w-full mx-auto ${
          navPosition === 'side'
            ? isSideBarVisible
              ? 'ml-64'
              : 'pl-10'
            : isTopBarVisible
              ? 'mt-4'
              : 'mt-8'
        } transition-all duration-300`}
      >
        {section === 'home' && <HomePage go={go} />}
        {section === 'daily-orders' && <DailyOrdersPage />}
        {section === 'watchbill' && <WatchAndStationBillManager standalone />}
        {section === 'departments' && <DepartmentsPage selected={arg ? decodeURIComponent(arg) : null} go={go} />}
        {section === 'personnel' && <PersonnelPage />}
        {section === 'leave' && <LeavePage />}
        {section === 'settings' && <SettingsPage />}
        {section === 'training' && <TrainingModule key={shipId} storageKey={trainingKey(shipId)} canEdit={user.role !== 'USER'} isAdmin={user.role === 'ADMIN'} />}
        {!NAV.some(n => n.path === section) && section !== 'daily-orders' && section !== 'watchbill' && <HomePage go={go} />}
      </main>

      {isLanSyncOpen && (
        <Modal title="Multi-PC LAN & Thumb-Drive Sync (Harbour / Sea Mode)" onClose={() => setIsLanSyncOpen(false)} wide>
          <LanSyncManager />
        </Modal>
      )}

      <OfflineIndicator />
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
