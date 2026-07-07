import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { getDestination, formatDistance } from '../data/destinations';
import { useStore } from '../state/store';
import { formatMinutes } from '../lib/format';
import { Button, Label, Panel } from './ui';

const CATEGORIES = ['Study', 'Work', 'Reading', 'Deep Work'];

export function BriefingCard() {
  const pending = useStore((s) => s.pending);
  const launch = useStore((s) => s.launch);
  const cancelBriefing = useStore((s) => s.cancelBriefing);
  const [category, setCategory] = useState<string | undefined>();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  if (!pending) return null;
  const dest = getDestination(pending.destinationId);
  if (!dest) return null;
  const classified = pending.classified;

  return (
    <div className="flex h-full items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm"
      >
        <Panel ref={panelRef} tabIndex={-1} className="outline-none">
          <Label>Mission briefing</Label>
          <h2 className="mt-2 text-2xl">{classified ? 'Classified destination' : dest.name}</h2>
          <dl className="mt-4 flex flex-col gap-1.5 font-mono text-sm text-ink-300">
            <div className="flex justify-between">
              <dt className="text-ink-500">Travel time</dt>
              <dd>{formatMinutes(pending.plannedMinutes)}</dd>
            </div>
            {!classified && (
              <div className="flex justify-between">
                <dt className="text-ink-500">Distance</dt>
                <dd>{formatDistance(dest.distanceMkm)}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-sm italic text-ink-300">
            {classified ? 'Coordinates sealed until arrival.' : dest.flavor}
          </p>

          <div className="mt-5">
            <Label className="mb-2">Focus</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(category === c ? undefined : c)}
                  aria-pressed={category === c}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    category === c
                      ? 'border-accent-600 bg-accent-400/10 text-accent-300'
                      : 'border-space-700 text-ink-500 hover:text-ink-300'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Button variant="quiet" onClick={cancelBriefing}>
              Stand down
            </Button>
            <Button onClick={() => launch(Date.now(), category)}>Confirm launch</Button>
          </div>
        </Panel>
      </motion.div>
    </div>
  );
}
