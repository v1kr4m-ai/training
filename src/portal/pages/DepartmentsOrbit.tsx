/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { DEPARTMENT_NAMES, getDepartmentConfig } from '../../data/departments';
import { useLiveStats } from '../stats';
import { usePortal } from '../store';
import { heroOf } from '../shipImages';

/**
 * The departments as slides on a ring that orbits a glowing orb. The front slide is the active one;
 * arrows, the dot list, a click on a side slide or the left/right keys bring another to the front.
 */
export const DepartmentsOrbit: React.FC<{ go: (path: string) => void }> = ({ go }) => {
  const { ship, shipId, subDepartments } = usePortal();
  const stats = useLiveStats();
  const n = DEPARTMENT_NAMES.length;
  const step = 360 / n;

  const [turn, setTurn] = useState(0); // grows without wrapping so the ring always takes the short way round
  const active = ((turn % n) + n) % n;
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // slide size follows the available width; radius makes neighbouring slides just clear each other
  const cardW = Math.max(260, Math.min(540, width * 0.78));
  const cardH = Math.round(cardW * 0.74);
  const compact = cardW < 440; // small screens: drop the description and the dot list so nothing overlaps
  const radius = Math.round(cardW / 2 / Math.tan(Math.PI / n)) + 30;

  const goTo = (i: number) => {
    // shortest rotation from the current front slide to slide i
    let d = ((i - active) % n + n) % n;
    if (d > n / 2) d -= n;
    setTurn(t => t + d);
  };
  const next = () => setTurn(t => t + 1);
  const prev = () => setTurn(t => t - 1);

  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      next();
    }, 3000);
    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, []);

  const hero = heroOf(shipId, ship);

  return (
    <div className="space-y-4">
      <div
        ref={boxRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onWheel={(e) => {
          e.preventDefault();
          if (Math.abs(e.deltaY) > 50) {
            if (e.deltaY > 0) next(); else prev();
          }
        }}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label="Departments"
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-black via-[#0b0e13] to-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        style={{ height: cardH + 330 }}
      >
        {/* soft backdrop glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 78%, ${getDepartmentConfig(DEPARTMENT_NAMES[active]).color}33, transparent 60%)` }} />

        {/* 3D scene */}
        <div className="absolute inset-x-0 top-6" style={{ perspective: 1800, height: cardH + 80 }}>
          <div
            className="orbit-ring relative mx-auto"
            style={{
              width: cardW, height: cardH, transformStyle: 'preserve-3d',
              transform: `translateZ(${-radius}px) rotateX(-7deg) rotateY(${-turn * step}deg)`
            }}
          >
            {DEPARTMENT_NAMES.map((name, i) => {
              const cfg = getDepartmentConfig(name);
              const st = stats.perDept.find(d => d.name === name)!;
              const subs = subDepartments(name);
              const dist = Math.min(((i - active) % n + n) % n, ((active - i) % n + n) % n);
              const isFront = dist === 0;
              const wordSize = name.length > 11 ? cardW * 0.115 : name.length > 8 ? cardW * 0.14 : cardW * 0.17;
              return (
                <div
                  key={name}
                  aria-hidden={!isFront}
                  className="absolute inset-0"
                  style={{
                    transform: `rotateY(${i * step}deg) translateZ(${radius}px)`,
                    backfaceVisibility: 'hidden',
                    opacity: isFront ? 1 : dist === 1 ? 0.55 : 0.25,
                    transition: 'opacity .6s',
                    pointerEvents: 'auto'
                  }}
                  onClick={() => !isFront && goTo(i)}
                >
                  <div className="orbit-float w-full h-full" style={{ animationDelay: `${i * -0.9}s` }}>
                    <article
                      className="relative w-full h-full rounded-3xl overflow-hidden border border-white/15 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)]"
                      style={{ background: `linear-gradient(118deg, #0c0f13 0 46%, ${cfg.color} 46% 49.5%, #161a20 49.5% 100%)` }}
                    >
                      {hero && <img src={hero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity" />}
                      <div className="absolute inset-0" style={{ background: `linear-gradient(118deg, transparent 49.5%, ${cfg.color}1f 80%, transparent)` }} />

                      <span className="absolute left-3 top-4 text-[9px] font-mono tracking-widest text-white/50 [writing-mode:vertical-rl] rotate-180">
                        SLIDE {String(i + 1).padStart(2, '0')} · {name.toUpperCase()}
                      </span>
                      <span className="absolute left-9 top-4 text-[10px] font-bold tracking-widest text-white/70">{ship.name.toUpperCase()}</span>

                      <h2
                        className="absolute inset-x-0 top-[26%] text-center font-black uppercase text-white tracking-tight leading-none drop-shadow-[0_4px_18px_rgba(0,0,0,0.8)]"
                        style={{ fontSize: wordSize }}
                      >
                        {name}
                      </h2>

                      {!compact && <p className="absolute left-9 right-[40%] top-[50%] text-left text-[11px] leading-snug text-white/70 line-clamp-3">{cfg.description}</p>}

                      <div className={`absolute bottom-4 space-y-2 ${compact ? 'inset-x-0 flex flex-col items-center' : 'left-9 bottom-5 space-y-3'}`}>
                        <div className={`flex text-white/80 font-mono ${compact ? 'gap-3 text-[9px]' : 'gap-4 text-[11px]'}`}>
                          <span><strong className="text-white">{st.total}</strong> members</span>
                          <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />{st.total - st.away} present</span>
                          <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1" />{st.away} leave</span>
                        </div>
                        <button
                          tabIndex={isFront ? 0 : -1}
                          onClick={e => { e.stopPropagation(); go(`departments/${encodeURIComponent(name)}`); }}
                          className={`inline-flex items-center gap-2 border font-semibold tracking-wider uppercase text-white hover:bg-white/10 ${compact ? 'px-3 py-1.5 text-[9px]' : 'px-4 py-2 text-[11px]'}`}
                          style={{ borderColor: cfg.color }}
                        >
                          Open department <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* dot list, as on the reference slides */}
                      {!compact && <ul className="absolute right-5 bottom-5 space-y-1.5 text-right">
                        {DEPARTMENT_NAMES.map((d, k) => (
                          <li key={d}>
                            <button
                              tabIndex={isFront ? 0 : -1}
                              onClick={e => { e.stopPropagation(); goTo(k); }}
                              className={`inline-flex items-center gap-2 text-[9px] uppercase tracking-wider ${k === i ? 'font-bold' : 'text-white/45 hover:text-white/80'}`}
                              style={k === i ? { color: cfg.color } : undefined}
                            >
                              {d}
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: k === i ? cfg.color : 'rgba(255,255,255,0.35)' }} />
                            </button>
                          </li>
                        ))}
                      </ul>}
                      <span className="sr-only">{subs.length} sections</span>
                    </article>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* the orb the ring levitates over */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ bottom: 28 }}>
          <div
            className="orbit-orb relative rounded-full flex items-center justify-center"
            style={{
              width: 150, height: 150,
              background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #9fb6d8 18%, #3a5a8c 45%, #0b1426 78%)',
              boxShadow: '0 0 70px 10px rgba(120,160,255,0.35), 0 0 160px 40px rgba(120,160,255,0.15), inset -18px -22px 40px rgba(0,0,0,0.55)'
            }}
          >
            <span className="text-[13px] font-bold tracking-[0.18em] uppercase text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">Departments</span>
          </div>
          <div className="mt-2 w-40 h-3 rounded-full bg-black/60 blur-md" aria-hidden />
        </div>

        {/* controls */}
        <button onClick={prev} aria-label="Previous department" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/15 bg-black/50 hover:bg-black/70 flex items-center justify-center z-10"><ChevronLeft className="w-5 h-5" /></button>
        <button onClick={next} aria-label="Next department" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/15 bg-black/50 hover:bg-black/70 flex items-center justify-center z-10"><ChevronRight className="w-5 h-5" /></button>
        <p className="sr-only" aria-live="polite">{DEPARTMENT_NAMES[active]}, slide {active + 1} of {n}</p>
      </div>
      <p className="text-center text-[11px] text-white/40">Use the arrows or the left and right keys, or click a side slide, to turn the ring.</p>
    </div>
  );
};
