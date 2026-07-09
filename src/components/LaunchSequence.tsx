import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../state/store';
import { TEST_MODE } from '../lib/testMode';

export function LaunchSequence() {
  const beginTransit = useStore((s) => s.beginTransit);
  const beginAscent = useStore((s) => s.beginAscent);
  const skipRitual = useStore((s) => s.settings.skipRitual);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const reduced =
    reducedMotion || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const quick = skipRitual || reduced || TEST_MODE; // test mode skips the 3-2-1 countdown
  const steps = quick ? ['Ignition'] : ['3', '2', '1', 'Ignition'];
  const [idx, setIdx] = useState(0);
  const isLast = idx >= steps.length - 1;
  const delay = steps[idx] === 'Ignition' ? 700 : 900;

  useEffect(() => {
    const advance = () => {
      if (!isLast) return setIdx((i) => i + 1);
      // reduced motion: simple fade straight to the map, no takeoff animation
      if (reduced) beginTransit(Date.now());
      else beginAscent();
    };
    const t = setTimeout(advance, delay);
    return () => clearTimeout(t);
  }, [idx, isLast, delay, reduced, beginTransit, beginAscent]);

  // The launch pad scene is drawn by the canvas behind this overlay — only
  // the countdown digits live here, in the upper third above the rocket.
  return (
    <div className="flex h-full flex-col items-center pt-[16vh]">
      <div className="h-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={steps[idx]}
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className={`font-mono ${steps[idx] === 'Ignition' ? 'text-2xl tracking-[0.3em] text-accent-300' : 'text-6xl text-ink-100'}`}
            aria-live="polite"
          >
            {steps[idx]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
