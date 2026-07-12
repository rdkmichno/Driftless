import { describe, it, expect } from 'vitest';
import { evaluateNewPatches, currentStreakDays, PATCHES, type PatchContext } from './patches';
import { DESTINATIONS } from './destinations';

const PLANETS = DESTINATIONS.filter((d) => d.type === 'planet').map((d) => d.id);
const ALL = DESTINATIONS.map((d) => d.id);
const DAY = 86_400_000;
const T0 = new Date(2026, 6, 10, 14, 0).getTime(); // local 14:00

const rec = (endedAt: number, plannedMinutes = 25, destinationId = 'mars') => ({
  destinationId,
  startedAt: endedAt - plannedMinutes * 60_000,
  endedAt,
  plannedMinutes,
  completed: true,
});

const ctx = (over: Partial<PatchContext> = {}): PatchContext => ({
  earned: {},
  visitedIds: ['moon'],
  totalFocusMinutes: 10,
  log: [rec(T0, 10, 'moon')],
  justCompleted: { destinationId: 'moon', plannedMinutes: 10, startedAt: T0 - 600_000, endedAt: T0 },
  planetIds: PLANETS,
  allDestinationIds: ALL,
  ...over,
});

describe('patch evaluation', () => {
  it('awards the destination patch and first flight on a first landing', () => {
    const ids = evaluateNewPatches(ctx());
    expect(ids).toContain('dest-moon');
    expect(ids).toContain('hours-first');
    expect(ids).not.toContain('dest-mars');
  });

  it('never re-awards an already-earned patch', () => {
    const ids = evaluateNewPatches(ctx({ earned: { 'dest-moon': 1, 'hours-first': 1 } }));
    expect(ids).not.toContain('dest-moon');
    expect(ids).not.toContain('hours-first');
  });

  it('awards hours patches when the cumulative threshold is crossed', () => {
    expect(evaluateNewPatches(ctx({ totalFocusMinutes: 599 }))).not.toContain('hours-10');
    const ids = evaluateNewPatches(ctx({ totalFocusMinutes: 600 }));
    expect(ids).toContain('hours-10');
    expect(ids).not.toContain('hours-25');
  });

  it('computes day streaks from the completed log', () => {
    const log = [rec(T0), rec(T0 - DAY), rec(T0 - 2 * DAY)];
    expect(currentStreakDays(log, T0)).toBe(3);
    // a gap breaks the streak
    expect(currentStreakDays([rec(T0), rec(T0 - 2 * DAY)], T0)).toBe(1);
    const ids = evaluateNewPatches(ctx({ log }));
    expect(ids).toContain('streak-3');
    expect(ids).not.toContain('streak-7');
  });

  it('awards deep space for a single 180-minute session', () => {
    const jc = { destinationId: 'kuiper', plannedMinutes: 180, startedAt: T0 - 180 * 60_000, endedAt: T0 };
    expect(evaluateNewPatches(ctx({ justCompleted: jc }))).toContain('feat-deepspace');
    expect(evaluateNewPatches(ctx())).not.toContain('feat-deepspace');
  });

  it('awards marathon when a single day crosses 4 focused hours', () => {
    const log = [rec(T0, 120), rec(T0 - 3_600_000, 120)];
    expect(evaluateNewPatches(ctx({ log }))).toContain('feat-marathon');
  });

  it('awards night watch / dawn patrol from the local start hour', () => {
    const night = new Date(2026, 6, 10, 2, 30).getTime();
    const jcNight = { destinationId: 'moon', plannedMinutes: 10, startedAt: night, endedAt: night + 600_000 };
    expect(evaluateNewPatches(ctx({ justCompleted: jcNight }))).toContain('feat-nightwatch');
    const dawn = new Date(2026, 6, 10, 6, 0).getTime();
    const jcDawn = { destinationId: 'moon', plannedMinutes: 10, startedAt: dawn, endedAt: dawn + 600_000 };
    const ids = evaluateNewPatches(ctx({ justCompleted: jcDawn }));
    expect(ids).toContain('feat-dawnpatrol');
    expect(ids).not.toContain('feat-nightwatch');
  });

  it('awards grand tour for all planets and full system for all destinations', () => {
    expect(evaluateNewPatches(ctx({ visitedIds: PLANETS }))).toContain('feat-grandtour');
    const all = evaluateNewPatches(ctx({ visitedIds: ALL }));
    expect(all).toContain('feat-fullsystem');
  });

  it('awards the hidden patch for completing a classified mission, and never awards manual/seasonal', () => {
    const jc = { destinationId: 'mars', plannedMinutes: 25, startedAt: T0, endedAt: T0 + 1, classified: true };
    const ids = evaluateNewPatches(ctx({ justCompleted: jc }));
    expect(ids).toContain('hidden-classified');
    expect(ids.filter((id) => id.startsWith('seasonal-'))).toHaveLength(0);
  });

  it('patch data is coherent: unique ids, ring labels, hints, palettes of 3-5 colors', () => {
    const ids = new Set(PATCHES.map((p) => p.id));
    expect(ids.size).toBe(PATCHES.length);
    for (const p of PATCHES) {
      expect(p.ringLabel.length, p.id).toBeGreaterThan(4);
      expect(p.earnHint.length, p.id).toBeGreaterThan(2);
      expect(p.palette.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.palette.length, p.id).toBeLessThanOrEqual(5);
    }
  });
});
