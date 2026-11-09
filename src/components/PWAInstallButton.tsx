/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../utils/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Install Ship Administration Portal as an Offline Desktop/Tablet App"
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
              <h3 className="text-base font-bold text-white">Install on iPhone / iPad</h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                1. Tap the <strong>Share</strong> button in the Safari toolbar.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[180] flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg border border-amber-400/40">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Sea Mode (Offline) — All data cached locally on ship terminal</span>
    </div>
  );
};
