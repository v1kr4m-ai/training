/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { usePortal } from '../store';
import {
  User, Shield, Bell, Palette, Globe, Accessibility,
  Lock, Eye, Database, Puzzle, HardDrive, Settings,
  CreditCard, HelpCircle, LifeBuoy, Info, Trash2,
  ChevronRight, LogOut
} from 'lucide-react';
import { btnGhost, btnPrimary, Card } from '../ui';
import { ListsSettings } from '../ListsSettings';

type SettingSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  groups: {
    id: string;
    label: string;
    items: SettingItem[];
  }[];
};

type SettingItem = {
  id: string;
  label: string;
  description?: string;
  icon?: React.ElementType;
};

const SETTINGS_CONFIG: SettingSection[] = [
  {
    id: 'account',
    label: 'My Account',
    icon: User,
    groups: [{
      id: 'profile-group',
      label: 'Personal',
      items: [
        { id: 'profile', label: 'Profile', description: 'Manage your public profile and avatar' },
        { id: 'account-info', label: 'Account Information', description: 'Email, password and login methods' },
        { id: 'connected-accounts', label: 'Connected Accounts', description: 'SSO and third-party integrations' },
      ]
    }]
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: Palette,
    groups: [{
      id: 'prefs-group',
      label: 'User Experience',
      items: [
        { id: 'general', label: 'General', description: 'Default app behavior and layout' },
        { id: 'appearance', label: 'Appearance', description: 'Themes, colors and density' },
        { id: 'language', label: 'Language & Region', description: 'Localization and time zone' },
        { id: 'accessibility', label: 'Accessibility', description: 'Screen readers and high contrast' },
      ]
    }]
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: Bell,
    groups: [{
      id: 'comm-group',
      label: 'Alerts',
      items: [
        { id: 'notifications', label: 'Notifications', description: 'Push, email and in-app alerts' },
      ]
    }]
  },
  {
    id: 'security',
    label: 'Security & Privacy',
    icon: Shield,
    groups: [{
      id: 'sec-group',
      label: 'Protection',
      items: [
        { id: 'security', label: 'Security', description: 'Two-factor auth and password rotation' },
        { id: 'privacy', label: 'Privacy', description: 'Data visibility and permissions' },
        { id: 'sessions', label: 'Active Sessions', description: 'Manage where you are logged in' },
        { id: 'data-mgmt', label: 'Data Management', description: 'Export and delete your personal data' },
      ]
    }]
  },
  {
    id: 'application',
    label: 'Application',
    icon: Settings,
    groups: [{
      id: 'app-group',
      label: 'Technical',
      items: [
        { id: 'lists', label: 'Lists & sheets', description: 'Departments, ranks, appointments and import sheet columns' },
        { id: 'integrations', label: 'Integrations', description: 'Connect to other ship systems' },
        { id: 'storage', label: 'Storage', description: 'Local cache and cloud sync settings' },
        { id: 'advanced', label: 'Advanced', description: 'Developer tools and debug logs' },
      ]
    }]
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    groups: [{
      id: 'bill-group',
      label: 'Financial',
      items: [
        { id: 'subscription', label: 'Subscription', description: 'Plan details and renewals' },
        { id: 'payments', label: 'Payment Methods', description: 'Cards and billing address' },
        { id: 'history', label: 'Billing History', description: 'Past invoices and receipts' },
      ]
    }]
  },
  {
    id: 'support',
    label: 'Support',
    icon: HelpCircle,
    groups: [{
      id: 'sup-group',
      label: 'Help',
      items: [
        { id: 'help-centre', label: 'Help Centre', description: 'Documentation and FAQs' },
        { id: 'contact', label: 'Contact Support', description: 'Open a ticket with the team' },
        { id: 'about', label: 'About', description: 'Version info and legal' },
      ]
    }]
  },
];

export const SettingsPage: React.FC = () => {
  const { navPosition, setNavPosition, customHeaders, setCustomHeader } = usePortal();
  const [activeSection, setActiveSection] = useState('account');
  const [activeItem, setActiveItem] = useState('profile');

  const currentSection = SETTINGS_CONFIG.find(s => s.id === activeSection) || SETTINGS_CONFIG[0];

  return (
    <div className="flex h-full gap-6 animate-fadeIn">
      {/* Left Sidebar: Sections */}
      <aside className="w-64 shrink-0 space-y-8 py-4">
        <div className="space-y-1">
          {SETTINGS_CONFIG.map(section => (
            <button
              key={section.id}
              onClick={() => {
                setActiveSection(section.id);
                setActiveItem(section.groups[0].items[0].id);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === section.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </div>

        <div className="pt-8 border-t border-white/10">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors">
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </aside>

      {/* Middle Column: Groups & Items */}
      <div className="w-64 shrink-0 space-y-6 py-4">
        {currentSection.groups.map(group => (
          <div key={group.id} className="space-y-2">
            <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-white/30">{group.label}</h3>
            <div className="space-y-1">
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveItem(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                    activeItem === item.id
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                  {activeItem === item.id && <ChevronRight className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Right Column: Content Area */}
      <main className="flex-1 py-4">
        <Card className="h-full bg-black/20 border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                {SETTINGS_CONFIG.find(s => s.id === activeSection)?.groups[0].items.find(i => i.id === activeItem)?.label || 'Setting'}
              </h2>
              <p className="text-sm text-white/50">
                {SETTINGS_CONFIG.find(s => s.id === activeSection)?.groups[0].items.find(i => i.id === activeItem)?.description || 'Manage your preferences and configuration.'}
              </p>
            </div>
          </div>

          <div className="space-y-8">
            {activeItem === 'appearance' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="text-sm font-medium text-white">Navigation Position</p>
                    <p className="text-xs text-white/50">Choose where the main menu is located</p>
                  </div>
                  <select
                    value={navPosition}
                    onChange={(e) => setNavPosition(e.target.value as 'top' | 'side')}
                    className="bg-black/40 border border-white/10 text-white text-xs rounded-lg p-2 outline-none focus:ring-2 ring-white/20"
                  >
                    <option value="top">Top Bar</option>
                    <option value="side">Side Bar</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">Custom Page Headers</p>
                      <p className="text-xs text-white/50">Rename modules (e.g., 'personnel', 'training')</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['personnel', 'training'].map(key => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-20 capitalize">{key}:</span>
                        <input
                          className="flex-1 bg-black/40 border border-white/10 text-white text-xs rounded-lg p-2 outline-none focus:ring-2 ring-white/20"
                          value={customHeaders[key] || ''}
                          onChange={(e) => setCustomHeader(key, e.target.value)}
                          placeholder={`Default ${key}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : activeItem === 'lists' ? (
              <ListsSettings />
            ) : (
              <div className="p-8 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-white/60">Configuration for <strong className="text-white">{activeItem}</strong></p>
                  <p className="text-xs text-white/40">This module is ready for implementation.</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};
