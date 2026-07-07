import { motion } from 'motion/react';
import { getDestination } from '../data/destinations';
import { useStore } from '../state/store';
import { formatMinutes } from '../lib/format';
import { Button, Label } from './ui';

export function MissionLogView({ onBack }: { onBack: () => void }) {
  const log = useStore((s) => s.log);
  const entries = [...log].reverse();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex h-full flex-col items-center overflow-y-auto px-4 py-10"
    >
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="quiet" onClick={onBack}>← Back</Button>
          <Label>Mission log</Label>
        </div>
        {entries.length === 0 ? (
          <p className="mt-16 text-center text-sm text-ink-500">No missions yet. The system is waiting.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {entries.map((m) => {
              const dest = getDestination(m.destinationId);
              const date = new Date(m.startedAt);
              return (
                <li
                  key={m.id}
                  className={`flex items-baseline justify-between rounded-lg px-3 py-2.5 ${m.completed ? '' : 'opacity-60'}`}
                >
                  <div>
                    <div className={m.completed ? 'text-ink-100' : 'text-ink-500'}>{dest?.name ?? '—'}</div>
                    <div className="text-xs text-ink-500">
                      {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
                      {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      {m.category ? ` · ${m.category}` : ''}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-ink-300">
                    {m.completed ? formatMinutes(m.actualMinutes) : `cut short at ${m.actualMinutes} min`}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
