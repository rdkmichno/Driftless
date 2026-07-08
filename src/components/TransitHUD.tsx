import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { getDestination, formatDistance } from '../data/destinations';
import { formatRemaining, progress, remainingMs } from '../engine/session';
import { computeLayout } from '../canvas/flightmap';
import { getCamera, recenter, worldToScreen, zoomBy, MAX_ZOOM, MIN_ZOOM } from '../canvas/camera';
import { useStore } from '../state/store';
import { formatMinutes } from '../lib/format';
import { Button, Panel } from './ui';

/**
 * Endpoint pills live in the DOM (crisp text) but track the canvas camera at
 * animation-frame rate via refs — React re-renders only on the slow ticker.
 */
function useCameraPills(active: boolean) {
  const originRef = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const layout = computeLayout(w, h);
      const place = (el: HTMLDivElement | null, wx: number, wy: number, dy: number, below: boolean) => {
        if (!el) return;
        const p = worldToScreen(wx, wy, w, h);
        const visible = p.x > -60 && p.x < w + 60 && p.y > -40 && p.y < h + 40;
        el.style.opacity = visible ? '1' : '0';
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y + dy}px`;
        el.style.transform = `translate(-50%, ${below ? '0' : '-100%'})`;
      };
      place(originRef.current, layout.origin.x, layout.origin.y, 16, true);
      place(destRef.current, layout.dest.x, layout.dest.y, -18, false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return { originRef, destRef };
}

const pillCls =
  'absolute flex items-center gap-1.5 rounded-full border border-space-700 bg-space-950/85 px-3 py-1 transition-opacity duration-300';

const zoomBtnCls =
  'flex h-9 w-9 items-center justify-center rounded-lg border border-space-700 bg-space-950/85 font-mono text-lg leading-none text-ink-300 transition-colors hover:text-ink-100';

const Chevron = ({ up }: { up?: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={up ? 'rotate-180' : ''}>
    <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function TransitHUD({ now }: { now: number }) {
  const session = useStore((s) => s.activeSession);
  const phase = useStore((s) => s.phase);
  const abortMission = useStore((s) => s.abortMission);
  const [confirming, setConfirming] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mode, setMode] = useState<'time' | 'distance'>('time');
  const confirmRef = useRef<HTMLDivElement>(null);
  const showMap = phase === 'transit';
  const { originRef, destRef } = useCameraPills(showMap);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (!session) return null;
  const dest = getDestination(session.destinationId);
  if (!dest) return null;
  const classified = !!session.classified;
  const pct = progress(session, now);
  const cam = getCamera();
  const destLabel = classified ? 'CLASSIFIED' : dest.name.replace('The ', '').toUpperCase();
  const remainingDistMkm = dest.distanceMkm * (1 - pct);
  const distReadout = remainingDistMkm < 1
    ? `${Math.max(0, Math.round(remainingDistMkm * 1_000_000)).toLocaleString()} km`
    : `${Math.round(remainingDistMkm).toLocaleString()} M km`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, delay: 0.8 }}
      className="pointer-events-none absolute inset-0"
    >
      {showMap && (
        <>
          <div ref={originRef} className={pillCls}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#4a7fa8' }} />
            <span className="font-mono text-[10px] tracking-[0.18em] text-ink-300">EARTH</span>
          </div>
          <div ref={destRef} className={pillCls}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: classified ? '#8a94a8' : dest.palette.accent }} />
            <span className="font-mono text-[10px] tracking-[0.18em] text-ink-300">{destLabel}</span>
          </div>

          <div className="pointer-events-auto absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-1.5">
            <button aria-label="Zoom in" onClick={() => zoomBy(1.5)} disabled={cam.targetZoom >= MAX_ZOOM} className={`${zoomBtnCls} disabled:opacity-40`}>
              +
            </button>
            <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)} disabled={cam.targetZoom <= MIN_ZOOM} className={`${zoomBtnCls} disabled:opacity-40`}>
              −
            </button>
            {!cam.follow && (
              <button aria-label="Recenter on ship" title="Recenter on ship" onClick={recenter} className={zoomBtnCls}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <circle cx="7" cy="7" r="2.2" fill="currentColor" />
                  <path d="M7 0v3M7 11v3M0 7h3M11 7h3" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            )}
          </div>
        </>
      )}

      <div
        className="absolute inset-x-0 bottom-0 flex justify-center px-4"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            aria-label="Expand mission details"
            className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-space-700 bg-space-950/85 px-4 py-2 text-ink-300 transition-colors hover:text-ink-100"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
            <span className="font-mono text-xs tracking-[0.15em]">{destLabel}</span>
            <span className="font-mono text-sm text-ink-100">{formatRemaining(remainingMs(session, now))}</span>
            <Chevron up />
          </button>
        ) : (
          <Panel className="pointer-events-auto w-full max-w-sm p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 rounded-full border border-accent-600 px-2.5 py-0.5 text-[10px] tracking-[0.2em] text-accent-300">
                <span className="h-1 w-1 rounded-full bg-accent-400" />
                IN PROGRESS
              </span>
              <button
                onClick={() => setCollapsed(true)}
                aria-label="Collapse mission details"
                className="p-1 text-ink-500 transition-colors hover:text-ink-300"
              >
                <Chevron />
              </button>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <div className="font-mono text-sm text-ink-100">
                EARTH <span className="text-ink-500">→</span> {destLabel}
              </div>
              <div className="text-xs text-ink-500">
                {formatMinutes(session.plannedMinutes)}
                {!classified && ` · ${formatDistance(dest.distanceMkm)}`}
              </div>
            </div>

            <div className="mt-2 flex items-end justify-between">
              <div className="font-mono text-3xl text-ink-100" aria-live="off">
                {mode === 'time' ? formatRemaining(remainingMs(session, now)) : distReadout}
              </div>
              <div className="flex gap-1" role="group" aria-label="Readout mode">
                <button
                  onClick={() => setMode('time')}
                  aria-pressed={mode === 'time'}
                  className={`rounded px-2 py-0.5 text-[11px] transition-colors ${mode === 'time' ? 'bg-space-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'}`}
                >
                  Time
                </button>
                {!classified && (
                  <button
                    onClick={() => setMode('distance')}
                    aria-pressed={mode === 'distance'}
                    className={`rounded px-2 py-0.5 text-[11px] transition-colors ${mode === 'distance' ? 'bg-space-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'}`}
                  >
                    Distance
                  </button>
                )}
              </div>
            </div>

            <div
              role="progressbar"
              aria-valuenow={Math.round(pct * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Journey progress"
              className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-space-700"
            >
              <div className="h-full bg-accent-600 transition-[width] duration-1000" style={{ width: `${pct * 100}%` }} />
            </div>

            <div className="mt-3 flex justify-end">
              {confirming ? (
                <div ref={confirmRef} tabIndex={-1} className="flex items-center gap-2 outline-none">
                  <span className="text-xs text-ink-500">End this mission early? It won't be logged as complete.</span>
                  <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => setConfirming(false)}>
                    Stay
                  </Button>
                  <Button variant="quiet" className="text-xs" onClick={() => abortMission(Date.now())}>
                    Abort
                  </Button>
                </div>
              ) : (
                <Button variant="quiet" className="text-xs" onClick={() => setConfirming(true)}>
                  Abort mission
                </Button>
              )}
            </div>
          </Panel>
        )}
      </div>
    </motion.div>
  );
}
