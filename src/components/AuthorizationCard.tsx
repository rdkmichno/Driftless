import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { getDestination, formatDistance } from '../data/destinations';
import { useStore } from '../state/store';
import { formatMinutes } from '../lib/format';
import { audio } from '../audio/engine';
import { Button } from './ui';
import { devMinutes } from '../lib/devOverride';

const CATEGORIES = ['Study', 'Work', 'Reading', 'Deep Work'];
const HOLD_MS = 1700; // fill time for the authorize ring
const DRAIN_MS = 550; // drain-back after an early release
const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

const timeAt = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Fingerprint glyph — concentric arcs, illuminated bottom-up by `lit` (0..1). */
function PrintGlyph({ lit }: { lit: number }) {
  const arcs = (color: string, width: number) => (
    <g fill="none" stroke={color} strokeWidth={width} strokeLinecap="round">
      <path d="M12 21c0-6 4-10 10-10s10 4 10 10" />
      <path d="M16 22c0-4 2.5-7 6-7s6 3 6 7v3" />
      <path d="M22 19.5c2 0 3.5 1.6 3.5 4v4.5" />
      <path d="M18.5 23.5c0-1 .4-2.2 1.1-3" />
      <path d="M18.5 27.5v2.5" />
    </g>
  );
  return (
    <svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true">
      {arcs('rgba(106, 113, 137, 0.7)', 1.6)}
      <g style={{ clipPath: `inset(${(1 - lit) * 100}% 0 0 0)` }}>{arcs('#f5ce82', 1.7)}</g>
    </svg>
  );
}

function Field({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 font-mono text-xs">
      <span className="text-ink-500">{label}</span>
      <span className="text-right text-ink-100">
        {value}
        {extra}
      </span>
    </div>
  );
}

export function AuthorizationCard() {
  const pending = useStore((s) => s.pending);
  const cancelBriefing = useStore((s) => s.cancelBriefing);
  const reducedSetting = useStore((s) => s.settings.reducedMotion);
  const reduced = reducedSetting || matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [category, setCategory] = useState<string | undefined>();
  const [progress, setProgress] = useState(0);
  const [cleared, setCleared] = useState(false);
  const holding = useRef(false);
  const clearedRef = useRef(false);
  const launchTimer = useRef(0);
  const categoryRef = useRef<string | undefined>(undefined);
  categoryRef.current = category;
  const panelRef = useRef<HTMLDivElement>(null);

  const missionId = useMemo(() => `DFT-${1000 + Math.floor(Math.random() * 9000)}`, []);
  const departureAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Hold engine: interval-driven from wall-clock (framerate-independent), so
  // the ring fills over HOLD_MS held and drains over DRAIN_MS released. The
  // accumulator lives in a ref — never inside a setState updater, which React
  // may re-invoke (StrictMode) and must stay pure.
  const progressRef = useRef(0);
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (clearedRef.current) return;
      const p = progressRef.current;
      const next = holding.current ? Math.min(1, p + dt / HOLD_MS) : Math.max(0, p - dt / DRAIN_MS);
      if (next === p) return;
      progressRef.current = next;
      if (holding.current) audio.setHoldProgress(next);
      setProgress(next);
      if (next >= 1 && !clearedRef.current) {
        clearedRef.current = true;
        holding.current = false;
        audio.stopHoldTone(true);
        audio.cueAuthorized();
        try {
          navigator.vibrate?.(30);
        } catch { /* unsupported */ }
        setCleared(true);
        launchTimer.current = window.setTimeout(() => {
          useStore.getState().launch(Date.now(), categoryRef.current);
        }, 700);
      }
    }, 40);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(launchTimer.current);
      audio.stopHoldTone(false); // cancel mid-ritual leaves no running nodes
    };
  }, []);

  if (!pending) return null;
  const dest = getDestination(pending.destinationId);
  if (!dest) return null;
  const classified = !!pending.classified;
  const destCode = classified ? 'CLASSIFIED' : dest.name.replace('The ', '').toUpperCase();

  const startHold = () => {
    if (clearedRef.current || holding.current) return;
    holding.current = true;
    audio.unlock();
    audio.startHoldTone();
    try {
      navigator.vibrate?.(10);
    } catch { /* unsupported */ }
  };
  const endHold = () => {
    if (!holding.current) return;
    holding.current = false;
    audio.stopHoldTone(false);
  };
  const authorizeDirect = () => {
    // plain-confirm path for users who cannot press-and-hold
    if (clearedRef.current) return;
    clearedRef.current = true;
    holding.current = false;
    progressRef.current = 1;
    setProgress(1);
    setCleared(true);
    audio.unlock();
    audio.cueAuthorized();
    launchTimer.current = window.setTimeout(() => {
      useStore.getState().launch(Date.now(), categoryRef.current);
    }, 700);
  };

  const stagger = reduced ? 0 : 0.05;
  const rise = (i: number) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0.15 : 0.22, delay: 0.12 + i * stagger },
  });

  return (
    <div className="flex h-full items-center justify-center px-4">
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={
          reduced
            ? { opacity: 0, transition: { duration: 0.2 } }
            : { opacity: 0, y: -34, scale: 0.92, rotateX: 16, transition: { duration: 0.35 } }
        }
        transition={{ duration: 0.3 }}
        style={{ transformPerspective: 700 }}
        className="w-full max-w-sm"
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className="relative overflow-hidden rounded-xl border bg-space-950/90 p-5"
          style={{
            outline: 'none',
            borderColor: 'rgba(232, 180, 90, 0.35)', // deliberate holo hairline
            boxShadow: '0 0 26px rgba(232, 180, 90, 0.08), 0 12px 40px rgba(4, 6, 14, 0.6)',
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(233,235,244,0.016) 0 1px, transparent 1px 3px)',
          }}
        >
          {!reduced && <span className="holo-scanline" />}
          {/* HUD corner brackets */}
          {(['top-1.5 left-1.5 border-t border-l', 'top-1.5 right-1.5 border-t border-r', 'bottom-1.5 left-1.5 border-b border-l', 'bottom-1.5 right-1.5 border-b border-r'] as const).map(
            (pos, i) => (
              <motion.span
                key={pos}
                aria-hidden="true"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: 0.05 + i * 0.04 }}
                className={`absolute h-3 w-3 border-accent-600 ${pos}`}
              />
            ),
          )}

          <motion.div {...rise(0)} className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.24em] text-ink-500">Mission Authorization</span>
            <motion.span
              key={cleared ? 'cleared' : 'waiting'}
              initial={cleared && !reduced ? { scale: 1.5, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              role="status"
              className={`rounded border px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] ${
                cleared
                  ? 'border-accent-400 bg-accent-400/10 text-accent-300'
                  : 'border-space-700 text-ink-500'
              }`}
              style={cleared ? { boxShadow: '0 0 14px rgba(232, 180, 90, 0.35)' } : undefined}
            >
              {cleared ? 'CLEARED FOR LAUNCH' : 'AWAITING CLEARANCE'}
            </motion.span>
          </motion.div>

          {/* route */}
          <motion.div {...rise(1)} className="mt-4 flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-space-700 px-2.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#4a7fa8' }} />
              <span className="font-mono text-[10px] tracking-[0.18em] text-ink-300">EARTH</span>
            </span>
            <span aria-hidden="true" className="flex-1 border-t border-dotted border-space-700" />
            <span aria-hidden="true" className="text-accent-600">▸</span>
            <span className="flex items-center gap-1.5 rounded-full border border-space-700 px-2.5 py-0.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: classified ? '#8a94a8' : dest.palette.accent }}
              />
              <span className="font-mono text-[10px] tracking-[0.18em] text-ink-300">{destCode}</span>
            </span>
          </motion.div>

          {/* manifest data */}
          <motion.div {...rise(2)} className="mt-4 flex flex-col gap-1.5 border-y border-space-700/60 py-3">
            <Field label="MISSION ID" value={missionId} />
            <Field label="DEPARTURE" value={timeAt(departureAt)} />
            <Field label="EST. ARRIVAL" value={timeAt(departureAt + pending.plannedMinutes * 60_000)} />
            <Field
              label="TRANSIT TIME"
              value={formatMinutes(pending.plannedMinutes)}
              extra={
                devMinutes != null && !pending.custom ? (
                  <span className="ml-2 rounded border border-accent-600 px-1 text-[10px] text-accent-300">TEST</span>
                ) : undefined
              }
            />
            <Field label="DISTANCE" value={classified ? 'SEALED' : formatDistance(dest.distanceMkm)} />
            <Field label="VESSEL" value="DRIFTLESS I" />
            <Field label="CREW" value="COMMANDER" />
          </motion.div>

          <motion.p {...rise(3)} className="mt-3 text-xs italic text-ink-300">
            {classified ? 'Coordinates sealed until arrival.' : dest.flavor}
          </motion.p>

          <motion.div {...rise(4)} className="mt-3 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? undefined : c)}
                aria-pressed={category === c}
                disabled={cleared}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  category === c
                    ? 'border-accent-600 bg-accent-400/10 text-accent-300'
                    : 'border-space-700 text-ink-500 hover:text-ink-300'
                }`}
              >
                {c}
              </button>
            ))}
          </motion.div>

          {/* authorization pad */}
          <motion.div {...rise(5)} className="mt-5 flex flex-col items-center gap-2">
            <div
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Authorization progress"
              className="relative"
            >
              <button
                type="button"
                aria-label="Hold to authorize launch"
                disabled={cleared}
                onPointerDown={(e) => {
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch { /* synthetic events */ }
                  startHold();
                }}
                onPointerUp={endHold}
                onPointerCancel={endHold}
                onKeyDown={(e) => {
                  if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                    e.preventDefault();
                    startHold();
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') endHold();
                }}
                onBlur={endHold}
                className={`relative flex h-[76px] w-[76px] items-center justify-center rounded-full border transition-colors ${
                  cleared ? 'border-accent-400 bg-accent-400/10' : 'border-space-700 bg-space-800/60'
                }`}
                style={cleared ? { boxShadow: '0 0 22px rgba(232, 180, 90, 0.4)' } : undefined}
              >
                <PrintGlyph lit={progress} />
                <svg
                  aria-hidden="true"
                  className="absolute inset-0 -rotate-90"
                  width="76"
                  height="76"
                  viewBox="0 0 76 76"
                >
                  <circle cx="38" cy="38" r={RING_R} fill="none" stroke="rgba(30,39,80,0.9)" strokeWidth="3" />
                  <circle
                    cx="38"
                    cy="38"
                    r={RING_R}
                    fill="none"
                    stroke="#e8b45a"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - progress)}
                  />
                </svg>
              </button>
            </div>
            <span className="font-mono text-[10px] tracking-[0.24em] text-ink-500">
              {cleared ? 'AUTHORIZED' : 'HOLD TO AUTHORIZE'}
            </span>
            <span aria-live="polite" className="sr-only">
              {cleared ? 'Cleared for launch' : ''}
            </span>
            {!cleared && (
              <button onClick={authorizeDirect} className="text-[11px] text-ink-500 underline-offset-2 hover:text-ink-300 hover:underline">
                authorize without holding
              </button>
            )}
          </motion.div>

          <motion.div {...rise(6)} className="mt-4 flex justify-start">
            <Button variant="quiet" onClick={cancelBriefing} disabled={cleared} className="text-xs">
              Stand down
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
