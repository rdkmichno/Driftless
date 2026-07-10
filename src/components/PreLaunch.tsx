import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../state/store';
import { audio } from '../audio/engine';
import { padState } from '../canvas/ascent';
import { TEST_MODE } from '../lib/testMode';

/**
 * Pre-launch sequence (~3.5s): systems check ticks in → gantry retracts →
 * 3·2·1 countdown with a slow camera push and building engine glow →
 * IGNITION, flowing directly into the takeoff (the glow and camera state are
 * shared with the canvas pad scene via padState, so it is one continuous
 * shot). Skippable by tap; "Skip launch ritual" and test mode bypass it;
 * reduced motion keeps a simple cross-dissolve countdown and then fades
 * straight to the map (matching the previous reduced behavior).
 */

const CHECKS = ['NAVIGATION', 'LIFE SUPPORT', 'FUEL CELLS', 'TRAJECTORY LOCK'];
const CHECK_START = 200;
const CHECK_STEP = 140;
const GANTRY = [550, 1200] as const;
const COUNT = [1350, 2000, 2650] as const; // 3 · 2 · 1
const GLOW = [1650, 3300] as const;
const IGNITE = 3300;
const DONE = 3600;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function PreLaunch() {
  const skipRitual = useStore((s) => s.settings.skipRitual);
  const reducedSetting = useStore((s) => s.settings.reducedMotion);
  const reduced =
    reducedSetting || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const quick = skipRitual || TEST_MODE;
  const [elapsed, setElapsed] = useState(0);
  const doneRef = useRef(false);
  const fired = useRef({ checks: 0, counts: 0 });

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const st = useStore.getState();
    // reduced motion skips the takeoff animation and fades to the map
    if (reduced) st.beginTransit(Date.now());
    else st.beginAscent();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // skip-setting / test-mode: straight to takeoff, no sequence
  useEffect(() => {
    if (quick) finishRef.current();
  }, [quick]);

  useEffect(() => {
    if (quick) return;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const e = performance.now() - t0;
      setElapsed(e);
      // drive the canvas pad scene (skip camera push under reduced motion)
      padState.gantryRetract = clamp01((e - GANTRY[0]) / (GANTRY[1] - GANTRY[0]));
      padState.ignitionGlow = clamp01((e - GLOW[0]) / (GLOW[1] - GLOW[0]));
      padState.camPush = reduced ? 0 : clamp01((e - COUNT[0]) / (IGNITE - COUNT[0]));
      // edge-triggered sounds
      const checksVisible = CHECKS.filter((_, i) => e >= CHECK_START + i * CHECK_STEP).length;
      while (fired.current.checks < checksVisible) {
        fired.current.checks++;
        audio.cueTick();
      }
      const countsShown = COUNT.filter((c) => e >= c).length;
      while (fired.current.counts < countsShown) {
        audio.cuePulse(fired.current.counts); // rising pitch per numeral
        fired.current.counts++;
      }
      if (e >= DONE) finishRef.current();
    }, 50);
    return () => window.clearInterval(id);
  }, [quick, reduced]);

  if (quick) return null;

  const numeral = elapsed >= COUNT[2] ? '1' : elapsed >= COUNT[1] ? '2' : elapsed >= COUNT[0] ? '3' : null;
  const igniting = elapsed >= IGNITE;

  return (
    <div className="absolute inset-0">
      {/* tap anywhere to skip */}
      <button
        aria-label="Skip pre-launch sequence"
        onClick={finish}
        className="absolute inset-0 h-full w-full cursor-default"
      >
        <span className="absolute inset-x-0 bottom-6 text-center text-xs text-ink-500">tap to skip</span>
      </button>

      {/* systems check readout */}
      <div className="pointer-events-none absolute left-[8%] top-[22%] flex flex-col gap-1 font-mono text-xs">
        {CHECKS.map((name, i) => {
          const on = elapsed >= CHECK_START + i * CHECK_STEP;
          return (
            <motion.div
              key={name}
              initial={{ opacity: 0 }}
              animate={{ opacity: on ? 1 : 0 }}
              transition={{ duration: reduced ? 0.2 : 0.08 }}
              className="text-ink-300"
            >
              {name.padEnd(16, '.')}{' '}
              <motion.span
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.5 }}
                animate={on ? { opacity: 1, scale: 1 } : {}}
                transition={{ type: 'spring', stiffness: 600, damping: 24 }}
                className="inline-block text-accent-300"
              >
                OK
              </motion.span>
            </motion.div>
          );
        })}
      </div>

      {/* countdown */}
      <div className="pointer-events-none absolute inset-x-0 top-[16vh] flex justify-center">
        <AnimatePresence mode="wait">
          {igniting ? (
            <motion.div
              key="ignition"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18 }}
              className="font-mono text-2xl tracking-[0.35em] text-accent-300"
              style={{ textShadow: '0 0 24px rgba(232, 180, 90, 0.6)' }}
              aria-live="assertive"
            >
              IGNITION
            </motion.div>
          ) : numeral ? (
            <motion.div
              key={numeral}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.45 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={reduced ? { duration: 0.25 } : { type: 'spring', stiffness: 480, damping: 26 }}
              className="font-mono text-7xl text-ink-100"
              aria-live="polite"
            >
              {numeral}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
