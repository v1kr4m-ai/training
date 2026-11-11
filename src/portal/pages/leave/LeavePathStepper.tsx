/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check, Clock, ShieldAlert, ArrowRight, Bell } from 'lucide-react';
import type { LeaveEvent, LeaveStatus, Person } from '../../types';
import { getApprovalRoute, ApprovalStepInfo, roleOfPerson } from '../../leaveLogic';
import { usePortal } from '../../store';

interface LeavePathStepperProps {
  applicant: Person;
  status: LeaveStatus;
  history?: LeaveEvent[];
  gunneryNotified?: boolean;
  compact?: boolean;
}

export const LeavePathStepper: React.FC<LeavePathStepperProps> = ({
  applicant,
  status,
  history = [],
  gunneryNotified = false,
  compact = false
}) => {
  const { db } = usePortal();
  const steps = getApprovalRoute(applicant, roleOfPerson(db, applicant.id));
  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';
  const isCancelled = status === 'CANCELLED';

  // Determine current active step index (0-based)
  const getActiveStepIndex = (): number => {
    if (isApproved) return steps.length;
    if (isRejected || isCancelled) return -1;
    if (status === 'PENDING_DO') return 0;
    if (status === 'PENDING_HOD') {
      // For sailor, PENDING_HOD is step 2 (0-indexed: 2); for officer it is step 0
      const idx = steps.findIndex(s => s.statusMatch === 'PENDING_HOD');
      return idx >= 0 ? idx : 0;
    }
    if (status === 'PENDING_EXO') {
      const idx = steps.findIndex(s => s.statusMatch === 'PENDING_EXO');
      return idx >= 0 ? idx : steps.length - 1;
    }
    if (status === 'PENDING_CO') {
      const idx = steps.findIndex(s => s.statusMatch === 'PENDING_CO');
      return idx >= 0 ? idx : steps.length - 1;
    }
    return 0;
  };

  const activeIdx = getActiveStepIndex();

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
        {steps.map((step, idx) => {
          const isDone = isApproved || (activeIdx > idx && !isRejected && !isCancelled);
          const isCurrent = activeIdx === idx && !isApproved && !isRejected && !isCancelled;
          return (
            <React.Fragment key={idx}>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                  isDone
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                    : isCurrent
                      ? 'bg-blue-900/60 text-blue-200 border border-blue-600 animate-pulse font-semibold'
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                {isDone ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Clock className="w-2.5 h-2.5" />}
                <span>{step.label}</span>
              </span>
              {idx < steps.length - 1 && <span className="text-slate-600 text-[10px]">→</span>}
            </React.Fragment>
          );
        })}
        {applicant.category === 'Sailor' && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
            gunneryNotified || isApproved
              ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
              : 'bg-slate-900 text-slate-500 border border-slate-800'
          }`}>
            <Bell className="w-2.5 h-2.5" />
            <span>Gunnery Office</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span>Tiered Naval Command Route</span>
          <span className="font-mono text-slate-500">· {applicant.category} Chain</span>
        </div>
        <div className="text-[11px]">
          {isApproved ? (
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Approved by Final Sanction Authority
            </span>
          ) : isRejected ? (
            <span className="text-rose-400 font-semibold">Rejected in Command Chain</span>
          ) : isCancelled ? (
            <span className="text-slate-500 font-semibold">Cancelled by Applicant</span>
          ) : (
            <span className="text-blue-400 font-medium">
              Next Authority: <strong className="text-white">{steps[activeIdx]?.label || 'Pending'}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Stepper Timeline Bar */}
      <div className="relative">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-0 items-start">
          {steps.map((step, idx) => {
            const isDone = isApproved || (activeIdx > idx && !isRejected && !isCancelled);
            const isCurrent = activeIdx === idx && !isApproved && !isRejected && !isCancelled;
            const isPending = activeIdx < idx || isRejected || isCancelled;

            // Find history entry for this stage
            const stageHistory = history.find(h => {
              if (idx === 0 && h.action === 'APPLIED') return true;
              if (h.action === 'FORWARDED' || h.action === 'APPROVED') return true;
              return false;
            });

            return (
              <div key={idx} className="relative flex flex-col sm:items-center text-left sm:text-center group px-1">
                {/* Horizontal line connector for desktop */}
                {idx < steps.length - 1 && (
                  <div
                    className={`hidden sm:block absolute top-3.5 left-1/2 w-full h-0.5 z-0 ${
                      isDone ? 'bg-emerald-500/60' : 'bg-slate-800'
                    }`}
                  />
                )}

                {/* Node Circle */}
                <div
                  className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 ring-2 ring-emerald-500/20'
                      : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-500/30 animate-pulse'
                        : 'bg-slate-900 border border-slate-700 text-slate-500'
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4 stroke-[2.5]" /> : isCurrent ? <Clock className="w-3.5 h-3.5" /> : idx + 1}
                </div>

                {/* Step Details */}
                <div className="mt-2 space-y-0.5">
                  <div className={`text-xs font-semibold ${isDone ? 'text-emerald-300' : isCurrent ? 'text-white' : 'text-slate-400'}`}>
                    {step.label}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    {step.description}
                  </div>
                  {isCurrent && (
                    <span className="inline-block px-1.5 py-0.2 bg-blue-950/80 border border-blue-700 text-blue-300 rounded text-[9px] font-bold mt-1">
                      Action Required
                    </span>
                  )}
                  {isDone && (
                    <span className="text-[10px] text-emerald-400/80 font-mono block">
                      Passed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Special Gunnery Notification Footer for Sailors */}
      {applicant.category === 'Sailor' && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-900 text-[11px] text-slate-400">
          <Bell className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>
            <strong>Gunnery Office Integration:</strong> Upon final approval by the Executive Officer (EXO), a system alert is dispatched automatically to the Gunnery Office to update daily muster records.
          </span>
          {gunneryNotified && (
            <span className="ml-auto px-2 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800 text-[10px] font-bold shrink-0">
              ✓ Alert Dispatched
            </span>
          )}
        </div>
      )}
    </div>
  );
};
