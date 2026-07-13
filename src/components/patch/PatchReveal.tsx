/**
 * The reveal moment. When a mission is completed and new patches are earned,
 * the store queues their ids in `pendingReveals`; this overlay presents them one
 * at a time with a satisfying stamp-in, a warm chime, and a screenshot-worthy
 * card. It is driven entirely by the queue, so:
 *   - multiple simultaneous unlocks queue cleanly instead of overlapping;
 *   - the reveal fires once per award (the queue is never persisted, so a reload
 *     or resume never replays it);
 *   - dismissing pops the head; when the queue empties the overlay leaves.
 *
 * Respects mute (the chime routes through the muted master bus) and
 * `prefers-reduced-motion` (a plain fade instead of the stamp), and is skippable
 * (button, backdrop, Enter/Escape/Space).
 */
import { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useStore } from '../../state/store';
import { getPatch } from '../../data/patches';
import { audio } from '../../audio/engine';
import { Patch } from './Patch';
import { Button, Label } from '../ui';

const CATEGORY_LABEL: Record<string, string> = {
  destination: 'Destination',
  hours: 'Flight hours',
  streak: 'Streak',
  feat: 'Feat',
  seasonal: 'Seasonal',
};

export function PatchReveal() {
  const pendingReveals = useStore((s) => s.pendingReveals);
  const phase = useStore((s) => s.phase);
  const dismissReveal = useStore((s) => s.dismissReveal);
  const reducedSetting = useStore((s) => s.settings.reducedMotion);
  const prefersReduced = useReducedMotion();
  const reduced = reducedSetting || prefersReduced;

  // Hold reveals until the arrival card has been dismissed so the two moments
  // don't stack; milestone-only unlocks (no arrival) show as soon as they queue.
  const active = pendingReveals.length > 0 && phase !== 'arrived';
  const currentId = active ? pendingReveals[0] : undefined;
  const patch = currentId ? getPatch(currentId) : undefined;
  const remaining = pendingReveals.length;

  // One chime per patch shown (keyed on the id via the effect dependency).
  useEffect(() => {
    if (currentId) audio.cuePatch();
  }, [currentId]);

  // Keyboard: advance on Enter / Space / Escape.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        dismissReveal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, dismissReveal]);

  if (!active || !patch) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-space-950/80 px-6 backdrop-blur-sm"
      onClick={dismissReveal}
      data-testid="patch-reveal"
    >
      <motion.div
        key={patch.id}
        role="dialog"
        aria-modal="true"
        aria-label={`Mission patch earned: ${patch.name}`}
        onClick={(e) => e.stopPropagation()}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, rotate: -8, y: 10 }}
        animate={
          reduced
            ? { opacity: 1 }
            : { opacity: 1, scale: 1, rotate: 0, y: 0, transition: { type: 'spring', stiffness: 220, damping: 15, mass: 0.9 } }
        }
        transition={reduced ? { duration: 0.3 } : undefined}
        className="flex w-full max-w-xs flex-col items-center text-center"
      >
        <Label className="text-accent-300">Mission patch earned</Label>

        <motion.div
          className="mt-5"
          initial={reduced ? false : { filter: 'brightness(1.8)' }}
          animate={reduced ? undefined : { filter: 'brightness(1)', transition: { duration: 0.5, delay: 0.15 } }}
          style={{ filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.55))' }}
        >
          <Patch patch={patch} earned size={210} />
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={reduced ? undefined : { opacity: 1, y: 0, transition: { delay: 0.28, duration: 0.4 } }}
        >
          <h2 className="mt-6 text-2xl">{patch.name}</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
            {CATEGORY_LABEL[patch.category] ?? patch.category}
          </p>
          <p className="mt-3 text-sm italic text-ink-300">{patch.flavor}</p>

          <div className="mt-7 flex flex-col items-center gap-3">
            <Button onClick={dismissReveal}>{remaining > 1 ? 'Next patch' : 'Add to collection'}</Button>
            {remaining > 1 && (
              <p className="font-mono text-xs text-ink-500" aria-live="polite">
                {remaining} patches to reveal
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
