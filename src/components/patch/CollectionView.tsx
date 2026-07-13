/**
 * The patch wall — the trophy case and the app's strongest share asset. All
 * patches are laid out on a display board grouped by category: earned ones in
 * full embroidered colour, locked ones as dark silhouettes with a hint. Tapping
 * a patch opens its detail. The core wall is free; board framing is a premium,
 * forward-compatible customisation gated behind hasPremium().
 *
 * Performance: every patch is a static SVG. Nothing animates on the wall except
 * a cheap transform on hover/focus — the reveal is where motion lives.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { PATCHES, collectionProgress, type Patch as PatchData, type PatchCategory } from '../../data/patches';
import { hasPremium } from '../../lib/premium';
import { useStore } from '../../state/store';
import { Button, Label } from '../ui';
import { Patch } from './Patch';

const CATEGORY_ORDER: PatchCategory[] = ['destination', 'hours', 'streak', 'feat', 'seasonal'];
const CATEGORY_TITLE: Record<PatchCategory, string> = {
  destination: 'Destinations',
  hours: "Pilot's logbook",
  streak: 'Streaks',
  feat: 'Feats',
  seasonal: 'Seasonal & rare',
};

type BoardTheme = 'jacket' | 'board';
const BOARD_CLASS: Record<BoardTheme, string> = {
  jacket: 'bg-[#0c1024] shadow-[inset_0_0_0_1px_rgba(232,180,90,0.10),inset_0_2px_30px_rgba(0,0,0,0.5)]',
  board: 'bg-[#161d38] shadow-[inset_0_0_0_1px_rgba(170,176,197,0.12),inset_0_2px_30px_rgba(0,0,0,0.45)] [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:14px_14px]',
};

export function CollectionView({ onBack }: { onBack: () => void }) {
  const earnedPatches = useStore((s) => s.earnedPatches);
  const [selected, setSelected] = useState<PatchData | null>(null);
  const [board, setBoard] = useState<BoardTheme>('jacket');
  const premium = hasPremium();

  const progress = useMemo(() => collectionProgress(earnedPatches), [earnedPatches]);
  const pct = progress.total ? Math.round((progress.earned / progress.total) * 100) : 0;

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
          <Label>Patch collection</Label>
        </div>

        {/* progress */}
        <div className="mb-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl">
              {progress.earned} <span className="text-ink-500">/ {progress.total}</span> patches
            </h2>
            <span className="font-mono text-xs text-ink-500">{pct}%</span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-space-800">
            <div className="h-full rounded-full bg-accent-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* premium: board framing */}
        <div className="mb-6 flex items-center justify-between rounded-xl border border-space-700/60 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-300">Display board</span>
            {!premium && (
              <span className="rounded bg-accent-400/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-300">
                Premium
              </span>
            )}
          </div>
          <div className="flex gap-1" role="group" aria-label="Board framing">
            {(['jacket', 'board'] as BoardTheme[]).map((t) => (
              <button
                key={t}
                onClick={() => premium && setBoard(t)}
                disabled={!premium}
                aria-pressed={board === t}
                title={premium ? undefined : 'Board framing is a premium feature'}
                className={`rounded-md px-2.5 py-1 text-xs capitalize transition-colors ${
                  board === t ? 'bg-space-700 text-ink-100' : 'text-ink-500'
                } ${premium ? 'hover:text-ink-300' : 'cursor-not-allowed opacity-50'}`}
              >
                {t === 'jacket' ? 'Jacket' : 'Board'}
              </button>
            ))}
          </div>
        </div>

        {/* the wall */}
        <div className={`rounded-2xl p-4 ${BOARD_CLASS[board]}`}>
          {CATEGORY_ORDER.map((cat) => {
            const patches = PATCHES.filter((p) => p.category === cat);
            if (patches.length === 0) return null;
            const c = progress.byCategory[cat];
            return (
              <section key={cat} className="mb-5 last:mb-0">
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h3 className="text-xs uppercase tracking-[0.18em] text-ink-300">{CATEGORY_TITLE[cat]}</h3>
                  <span className="font-mono text-[10px] text-ink-500">
                    {c.earned}/{c.total}
                  </span>
                </div>
                <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4">
                  {patches.map((p) => {
                    const earned = p.id in earnedPatches;
                    const gatedPremium = p.isPremium && !earned && !premium;
                    return (
                      <li key={p.id} className="flex justify-center">
                        <button
                          onClick={() => setSelected(p)}
                          aria-label={earned ? p.name : `Locked patch. ${p.hidden ? 'Classified.' : p.earnHint}`}
                          className="group relative rounded-lg p-1 outline-none transition-transform duration-200 hover:scale-[1.06] focus-visible:scale-[1.06]"
                        >
                          <Patch patch={p} earned={earned} size={84} />
                          {gatedPremium && (
                            <span className="pointer-events-none absolute -right-0.5 -top-0.5 rounded bg-accent-400/20 px-1 font-mono text-[8px] uppercase tracking-wide text-accent-300">
                              PRO
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {selected && (
        <PatchDetail
          patch={selected}
          earnedAt={earnedPatches[selected.id]}
          premium={premium}
          onClose={() => setSelected(null)}
        />
      )}
    </motion.div>
  );
}

function PatchDetail({
  patch,
  earnedAt,
  premium,
  onClose,
}: {
  patch: PatchData;
  earnedAt?: number;
  premium: boolean;
  onClose: () => void;
}) {
  const earned = earnedAt !== undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-space-950/80 px-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={earned ? patch.name : 'Locked mission patch'}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-xs rounded-2xl border border-space-700 bg-space-950/95 p-6 text-center shadow-xl"
      >
        <div className="mx-auto w-fit" style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))' }}>
          <Patch patch={patch} earned={earned} size={168} />
        </div>

        {earned ? (
          <>
            <h2 className="mt-5 text-xl">{patch.name}</h2>
            <p className="mt-3 text-sm italic text-ink-300">{patch.flavor}</p>
            <p className="mt-4 font-mono text-xs text-ink-500">
              Earned {new Date(earnedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-5 text-xl text-ink-300">{patch.hidden ? 'Classified patch' : patch.name}</h2>
            <p className="mt-3 text-sm text-ink-300">{patch.hidden ? 'A hidden patch. Earn it to reveal.' : patch.earnHint}</p>
            {patch.isPremium && !premium && (
              <p className="mt-4 font-mono text-xs text-accent-300">Premium collection patch</p>
            )}
          </>
        )}

        <div className="mt-6 flex justify-center">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </div>
  );
}
