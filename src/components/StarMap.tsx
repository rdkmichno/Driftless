import { motion } from 'motion/react';
import { DESTINATIONS } from '../data/destinations';
import { useStore } from '../state/store';
import { formatHours } from '../lib/format';
import { Button, Label } from './ui';

const MAX_LOG = Math.log10(1 + 7500);

export function StarMap({ onBack }: { onBack: () => void }) {
  const visitedIds = useStore((s) => s.visitedIds);
  const totalFocusMinutes = useStore((s) => s.totalFocusMinutes);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex h-full flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="quiet" onClick={onBack}>← Back</Button>
          <Label>Charted worlds · {visitedIds.length} of {DESTINATIONS.length}</Label>
        </div>
        <svg viewBox="0 0 1000 220" className="w-full" role="img" aria-label="Star map of visited destinations">
          {/* trajectory line */}
          <line x1="40" y1="110" x2="960" y2="110" stroke="#1e2750" strokeWidth="1" />
          {/* sun */}
          <circle cx="30" cy="110" r="10" fill="#e8b45a" opacity="0.25" />
          <circle cx="30" cy="110" r="5" fill="#e8b45a" opacity="0.8" />
          {DESTINATIONS.map((d, i) => {
            const x = 80 + (840 * Math.log10(1 + d.distanceMkm)) / MAX_LOG;
            const y = i % 2 === 0 ? 92 : 128;
            const labelY = i % 2 === 0 ? y - 14 : y + 22;
            const visited = visitedIds.includes(d.id);
            const locked = d.unlockAtTotalMinutes > totalFocusMinutes;
            return (
              <g key={d.id}>
                <title>
                  {d.name}
                  {visited ? ' — visited' : locked ? ` — unlocks after ${formatHours(d.unlockAtTotalMinutes)} of focus` : ' — not yet visited'}
                </title>
                <line x1={x} y1="110" x2={x} y2={y} stroke="#1e2750" strokeWidth="0.75" />
                {visited ? (
                  <>
                    <circle cx={x} cy={y} r="10" fill={d.palette.accent} opacity="0.22" />
                    <circle cx={x} cy={y} r="5" fill={d.palette.accent} />
                  </>
                ) : locked ? (
                  <circle cx={x} cy={y} r="2" fill="#1e2750" />
                ) : (
                  <circle cx={x} cy={y} r="4.5" fill="none" stroke="#6a7189" strokeWidth="1" />
                )}
                {!locked && (
                  <text
                    x={x}
                    y={labelY}
                    textAnchor="middle"
                    fill={visited ? '#aab0c5' : '#6a7189'}
                    style={{ font: '11px "JetBrains Mono", monospace' }}
                  >
                    {d.name.replace('The ', '')}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="mt-2 text-center font-mono text-xs text-ink-500">
          {formatHours(totalFocusMinutes)} of focus logged across the system
        </p>
      </div>
    </motion.div>
  );
}
