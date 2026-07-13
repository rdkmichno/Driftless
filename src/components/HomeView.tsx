import { useState } from 'react';
import { motion } from 'motion/react';
import { DESTINATIONS, formatDistance, nearestUnlocked } from '../data/destinations';
import { useStore } from '../state/store';
import { formatHours, formatMinutes } from '../lib/format';
import { clampCustomMinutes, CUSTOM_MIN, CUSTOM_MAX } from '../lib/customDuration';
import { Button, Label } from './ui';

export type HomeNav = 'map' | 'log' | 'patches' | 'settings';

export function HomeView({ onNavigate }: { onNavigate: (view: HomeNav) => void }) {
  const totalFocusMinutes = useStore((s) => s.totalFocusMinutes);
  const totalDistanceMkm = useStore((s) => s.totalDistanceMkm);
  const visitedIds = useStore((s) => s.visitedIds);
  const openBriefing = useStore((s) => s.openBriefing);
  const [customMin, setCustomMin] = useState(40);

  const launchCustom = () => {
    const minutes = clampCustomMinutes(customMin);
    const dest = nearestUnlocked(minutes, totalFocusMinutes);
    openBriefing({ destinationId: dest.id, plannedMinutes: minutes, custom: true });
  };

  const launchRandom = () => {
    const unlocked = DESTINATIONS.filter((d) => d.unlockAtTotalMinutes <= totalFocusMinutes);
    const dest = unlocked[Math.floor(Math.random() * unlocked.length)];
    openBriefing({ destinationId: dest.id, plannedMinutes: dest.durationMinutes, classified: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex h-full flex-col items-center overflow-y-auto px-4 py-10"
    >
      <header className="mb-8 text-center">
        <h1 className="text-sm tracking-[0.35em] text-ink-300">DRIFTLESS</h1>
        {totalFocusMinutes > 0 && (
          <p className="mt-2 font-mono text-xs text-ink-500">
            {formatHours(totalFocusMinutes)} focused · {formatDistance(totalDistanceMkm)} travelled
          </p>
        )}
      </header>

      <main className="w-full max-w-md">
        <Label className="mb-3">Destinations</Label>
        <ul className="flex flex-col gap-1.5">
          {DESTINATIONS.map((d) => {
            const locked = d.unlockAtTotalMinutes > totalFocusMinutes;
            const visited = visitedIds.includes(d.id);
            return (
              <li key={d.id}>
                {locked ? (
                  <div className="flex w-full items-baseline justify-between rounded-xl border border-transparent px-4 py-3 opacity-40">
                    <div>
                      <div className="text-ink-100">{d.name}</div>
                      <div className="text-xs text-ink-500">
                        Unlocks after {formatHours(d.unlockAtTotalMinutes)} of focus
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openBriefing({ destinationId: d.id, plannedMinutes: d.durationMinutes })}
                    className="flex w-full items-baseline justify-between rounded-xl border border-transparent px-4 py-3 text-left transition-colors hover:border-space-700 hover:bg-space-800/40"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-ink-100">
                        {d.name}
                        {visited && (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-400" title="Visited">
                            <span className="sr-only">Visited</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-500">
                        <span className="capitalize">{d.type}</span> · {formatMinutes(d.durationMinutes)}
                      </div>
                    </div>
                    <div className="font-mono text-xs text-ink-300">{formatDistance(d.distanceMkm)}</div>
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-8 rounded-xl border border-space-700/60 px-4 py-4">
          <Label className="mb-3">Custom transit</Label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={CUSTOM_MIN}
              max={CUSTOM_MAX}
              step={5}
              value={customMin}
              onChange={(e) => setCustomMin(Number(e.target.value))}
              aria-label="Custom session length in minutes"
              className="flex-1 accent-[#e8b45a]"
            />
            <div className="flex items-baseline gap-1.5">
              <input
                type="number"
                inputMode="numeric"
                min={CUSTOM_MIN}
                max={CUSTOM_MAX}
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value === '' ? CUSTOM_MIN : Number(e.target.value))}
                onBlur={() => setCustomMin(clampCustomMinutes(customMin))}
                aria-label="Custom session length in minutes"
                className="w-16 rounded-lg border border-space-700 bg-transparent px-2 py-1 text-right font-mono text-sm text-ink-100 focus:border-ink-500 focus:outline-none"
              />
              <span className="font-mono text-xs text-ink-500">min</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" onClick={launchCustom} className="flex-1 text-sm">
              Plot custom transit
            </Button>
            <Button variant="ghost" onClick={launchRandom} className="flex-1 text-sm">
              Random destination
            </Button>
          </div>
        </div>
      </main>

      <nav className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 pb-4">
        <Button variant="quiet" onClick={() => onNavigate('map')}>Star map</Button>
        <Button variant="quiet" onClick={() => onNavigate('log')}>Mission log</Button>
        <Button variant="quiet" onClick={() => onNavigate('patches')}>Patches</Button>
        <Button variant="quiet" onClick={() => onNavigate('settings')}>Settings</Button>
      </nav>
    </motion.div>
  );
}
