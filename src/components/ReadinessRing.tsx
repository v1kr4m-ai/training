/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface ReadinessRingProps {
  progress: number; // percentage of scheduled sessions (0 - 100)
  label?: string;   // e.g., 'Operational Readiness'
  sublabel?: string; // optional caption under the ring
  scheduledCount?: number;
  annualGoal?: number;
  size?: number;     // SVG pixel width/height (default: 160)
  strokeWidth?: number; // ring stroke width (default: 10)
  glowColor?: string; // optional override for glow color
  className?: string;
}

export const ReadinessRing: React.FC<ReadinessRingProps> = ({
  progress,
  label = 'Operational Readiness',
  sublabel,
  scheduledCount,
  annualGoal,
  size = 160,
  strokeWidth = 10,
  glowColor,
  className = ''
}) => {
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  
  // Radius calculation
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  // Determine color based on progress
  let strokeColor = '#10b981'; // emerald
  let glowFilterColor = 'rgba(16, 185, 129, 0.4)';

  if (clampedProgress < 50) {
    strokeColor = '#f43f5e'; // rose
    glowFilterColor = 'rgba(244, 63, 94, 0.4)';
  } else if (clampedProgress < 100) {
    strokeColor = '#f59e0b'; // amber
    glowFilterColor = 'rgba(245, 158, 11, 0.4)';
  }

  if (glowColor) {
    strokeColor = glowColor;
  }

  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      {/* Glowing SVG Ring Container */}
      <div 
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Soft background ambient glow */}
        <div 
          className="absolute inset-0 rounded-full blur-xl pointer-events-none transition-all duration-700 opacity-20"
          style={{ backgroundColor: strokeColor }}
        />

        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 transform"
        >
          <defs>
            <filter id={`ring-glow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow 
                dx="0" 
                dy="0" 
                stdDeviation="3" 
                floodColor={strokeColor} 
                floodOpacity="0.6" 
              />
            </filter>
            <linearGradient id={`ring-gradient-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={strokeColor} />
              <stop offset="100%" stopColor={strokeColor === '#10b981' ? '#06b6d4' : strokeColor} />
            </linearGradient>
          </defs>

          {/* Background Track Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-slate-800/80 transition-colors"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Glowing Animated Progress Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#ring-gradient-${size})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            filter={`url(#ring-glow-${size})`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Typography Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
          <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight drop-shadow-md">
            {clampedProgress}%
          </span>
          <span className="text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase mt-0.5">
            {label}
          </span>
          {scheduledCount !== undefined && annualGoal !== undefined && (
            <span className="text-[10px] font-mono text-slate-500 mt-0.5">
              {scheduledCount} / {annualGoal}
            </span>
          )}
        </div>
      </div>

      {sublabel && (
        <span className="text-xs text-slate-400 font-mono mt-2">
          {sublabel}
        </span>
      )}
    </div>
  );
};
