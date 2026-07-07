import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../state/store';
import { Ship } from './Ship';

export function LaunchSequence() {
  const beginTransit = useStore((s) => s.beginTransit);
  const skipRitual = useStore((s) => s.settings.skipRitual);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const quick =
    skipRitual || reducedMotion || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const steps = quick ? ['Ignition'] : ['3', '2', '1', 'Ignition'];
  const [idx, setIdx] = useState(0);
  const isLast = idx >= steps.length - 1;
  const delay = steps[idx] === 'Ignition' ? 700 : 900;

  useEffect(() => {
    const t = setTimeout(() => (isLast ? beginTransit() : setIdx((i) => i + 1)), delay);
    return () => clearTimeout(t);
  }, [idx, isLast, delay, beginTransit]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10">
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
      <Ship thrusting />
    </div>
  );
}
