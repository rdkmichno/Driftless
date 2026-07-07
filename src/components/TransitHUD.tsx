import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { getDestination } from '../data/destinations';
import { formatRemaining, progress, remainingMs } from '../engine/session';
import { useStore } from '../state/store';
import { Button, Label, Panel } from './ui';

export function TransitHUD({ now }: { now: number }) {
  const session = useStore((s) => s.activeSession);
  const abortMission = useStore((s) => s.abortMission);
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (!session) return null;
  const dest = getDestination(session.destinationId);
  const pct = progress(session, now) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, delay: 0.8 }}
      className="pointer-events-none absolute inset-0"
      style={{ padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }}
    >
      <div className="absolute right-4 top-4">
        {confirming ? (
          <Panel ref={confirmRef} tabIndex={-1} className="pointer-events-auto max-w-xs p-4 outline-none">
            <p className="text-sm text-ink-300">End this mission early? This journey won't be logged as complete.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => setConfirming(false)}>
                Stay on course
              </Button>
              <Button variant="quiet" onClick={() => abortMission(Date.now())}>
                Abort
              </Button>
            </div>
          </Panel>
        ) : (
          <Button variant="quiet" className="pointer-events-auto" onClick={() => setConfirming(true)}>
            Abort mission
          </Button>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-3">
        <Label>{session.classified ? 'Classified' : dest?.name}</Label>
        <div className="pointer-events-auto opacity-40 transition-opacity duration-700 hover:opacity-90 focus-within:opacity-90" tabIndex={0} aria-label={`Time remaining ${formatRemaining(remainingMs(session, now))}`}>
          <div className="font-mono text-3xl text-ink-100">{formatRemaining(remainingMs(session, now))}</div>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Journey progress"
          className="h-0.5 w-52 overflow-hidden rounded-full bg-space-700"
        >
          <div className="h-full bg-accent-600 transition-[width] duration-1000" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </motion.div>
  );
}
