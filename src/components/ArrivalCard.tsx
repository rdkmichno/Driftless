import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { getDestination, formatDistance } from '../data/destinations';
import { useStore } from '../state/store';
import { formatHours, formatMinutes } from '../lib/format';
import { Button, Label, Panel } from './ui';

export function ArrivalCard() {
  const arrival = useStore((s) => s.arrival);
  const dismissArrival = useStore((s) => s.dismissArrival);
  const totalFocusMinutes = useStore((s) => s.totalFocusMinutes);
  const totalDistanceMkm = useStore((s) => s.totalDistanceMkm);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => panelRef.current?.focus(), 700);
    return () => clearTimeout(t);
  }, []);

  if (!arrival) return null;
  const dest = getDestination(arrival.destinationId);
  if (!dest) return null;
  const unlockedNames = arrival.newlyUnlockedIds
    .map((id) => getDestination(id)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="flex h-full items-end justify-center px-4 pb-14 sm:items-center sm:pb-0">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="w-full max-w-sm"
        role="status"
        aria-live="polite"
      >
        <Panel ref={panelRef} tabIndex={-1} className="outline-none">
          <Label>Mission complete</Label>
          <h2 className="mt-2 text-2xl">Arrived at {dest.name}</h2>
          <p className="mt-2 text-sm italic text-ink-300">{dest.flavor}</p>
          <dl className="mt-4 flex flex-col gap-1.5 font-mono text-sm text-ink-300">
            <div className="flex justify-between">
              <dt className="text-ink-500">Focused</dt>
              <dd>{formatMinutes(arrival.minutes)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Travelled</dt>
              <dd>{formatDistance(arrival.distanceMkm)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Lifetime</dt>
              <dd>
                {formatHours(totalFocusMinutes)} · {formatDistance(totalDistanceMkm)}
              </dd>
            </div>
          </dl>
          {arrival.firstVisit && <p className="mt-4 text-xs tracking-wide text-accent-300">New world charted</p>}
          {unlockedNames && (
            <p className="mt-1 text-xs tracking-wide text-accent-300">New route unlocked: {unlockedNames}</p>
          )}
          <div className="mt-6 flex justify-end">
            <Button onClick={dismissArrival}>Return to base</Button>
          </div>
        </Panel>
      </motion.div>
    </div>
  );
}
