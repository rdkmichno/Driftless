import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DESTINATIONS, getDestination, unlockedIdsFor } from '../data/destinations';
import { evaluateNewPatches } from '../data/patches';
import { createSession, elapsedMinutes, isExpired, type ActiveSession } from '../engine/session';
import { TEST_MODE, sessionDurationMs } from '../lib/testMode';

export type Phase = 'idle' | 'briefing' | 'launching' | 'ascent' | 'transit' | 'arriving' | 'landing' | 'arrived';
export type AmbienceId = 'drift' | 'cockpit' | 'silence';

export type Settings = {
  volume: number;
  muted: boolean;
  ambience: AmbienceId;
  reducedMotion: boolean;
  skipRitual: boolean;
  halfwayPing: boolean;
};

export type MissionRecord = {
  id: string;
  destinationId: string;
  startedAt: number;
  endedAt: number;
  plannedMinutes: number;
  actualMinutes: number;
  completed: boolean;
  category?: string;
};

export type PendingMission = { destinationId: string; plannedMinutes: number; classified?: boolean; custom?: boolean };

export type ArrivalSummary = {
  destinationId: string;
  minutes: number;
  distanceMkm: number;
  newlyUnlockedIds: string[];
  firstVisit: boolean;
  test?: boolean;
};

type AppState = {
  phase: Phase;
  pending: PendingMission | null;
  activeSession: ActiveSession | null;
  arrival: ArrivalSummary | null;
  visitedIds: string[];
  totalFocusMinutes: number;
  totalDistanceMkm: number;
  log: MissionRecord[];
  /** Earned mission patches: id -> earnedAt timestamp. */
  earnedPatches: Record<string, number>;
  /** Patch ids awaiting their reveal moment, in award order. Not persisted:
   *  a reveal fires once per award, never again after a reload. */
  pendingReveals: string[];
  settings: Settings;
  openBriefing: (p: PendingMission) => void;
  cancelBriefing: () => void;
  launch: (now: number, category?: string) => void;
  beginAscent: () => void;
  beginTransit: (now?: number) => void;
  beginArriving: () => void;
  beginLanding: () => void;
  completeMission: (now: number) => void;
  dismissArrival: () => void;
  dismissReveal: () => void;
  abortMission: (now: number) => void;
  updateSettings: (p: Partial<Settings>) => void;
  resume: (now: number) => void;
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      phase: 'idle',
      pending: null,
      activeSession: null,
      arrival: null,
      visitedIds: [],
      totalFocusMinutes: 0,
      totalDistanceMkm: 0,
      log: [],
      earnedPatches: {},
      pendingReveals: [],
      settings: { volume: 0.3, muted: false, ambience: 'drift', reducedMotion: false, skipRitual: false, halfwayPing: false },

      openBriefing: (pending) => set({ pending, phase: 'briefing' }),
      cancelBriefing: () => set({ pending: null, phase: 'idle' }),

      launch: (now, category) => {
        const { pending } = get();
        if (!pending) return;
        const session = createSession(pending.destinationId, pending.plannedMinutes, now, {
          category,
          classified: pending.classified,
          durationMs: sessionDurationMs(pending.plannedMinutes), // 10s under test mode
          test: TEST_MODE,
        });
        set({ activeSession: session, pending: null, phase: 'launching' });
      },

      beginAscent: () => set({ phase: 'ascent' }),

      // Re-seed the session timestamps when the map appears: the ritual and
      // takeoff animation cost zero focus time, and the countdown starts at
      // its full length exactly when the calm view begins. The original
      // duration (real, or 10s under test mode) is preserved.
      beginTransit: (now = Date.now()) =>
        set((st) => {
          const s = st.activeSession;
          if (!s) return { phase: 'transit' };
          const dur = s.endAt - s.startedAt;
          return { phase: 'transit', activeSession: { ...s, startedAt: now, endAt: now + dur } };
        }),

      beginArriving: () => set({ phase: 'arriving' }),

      // Session timer has completed; play the landing animation before crediting.
      // The mission is only credited when the animation resolves (or is skipped),
      // so a reload mid-landing still completes correctly via resume().
      beginLanding: () => set({ phase: 'landing' }),

      completeMission: (now) => {
        const { activeSession: s, totalFocusMinutes, totalDistanceMkm, visitedIds, log } = get();
        if (!s) return;
        const dest = getDestination(s.destinationId);
        if (!dest) return;
        const firstVisit = !visitedIds.includes(dest.id);
        // Test-mode completions run the full loop (visited + arrival card) but
        // never pollute the real mission log or lifetime stats.
        if (s.test) {
          set({
            phase: 'arrived',
            activeSession: null,
            visitedIds: firstVisit ? [...visitedIds, dest.id] : visitedIds,
            arrival: { destinationId: dest.id, minutes: s.plannedMinutes, distanceMkm: dest.distanceMkm, newlyUnlockedIds: [], firstVisit, test: true },
          });
          return;
        }
        const before = unlockedIdsFor(totalFocusMinutes);
        const newTotal = totalFocusMinutes + s.plannedMinutes;
        const newlyUnlockedIds = unlockedIdsFor(newTotal).filter((id) => !before.includes(id));
        const newVisited = firstVisit ? [...visitedIds, dest.id] : visitedIds;
        const newLog = [
          ...log,
          {
            id: crypto.randomUUID(),
            destinationId: dest.id,
            startedAt: s.startedAt,
            endedAt: now,
            plannedMinutes: s.plannedMinutes,
            actualMinutes: s.plannedMinutes,
            completed: true,
            category: s.category,
          },
        ];
        // Mission patches: evaluate against the post-completion state; newly
        // earned ones queue for the reveal moment after the arrival card.
        const { earnedPatches, pendingReveals } = get();
        const newPatchIds = evaluateNewPatches({
          earned: earnedPatches,
          visitedIds: newVisited,
          totalFocusMinutes: newTotal,
          log: newLog,
          justCompleted: { destinationId: dest.id, plannedMinutes: s.plannedMinutes, startedAt: s.startedAt, endedAt: now, classified: s.classified },
          planetIds: DESTINATIONS.filter((d) => d.type === 'planet').map((d) => d.id),
          allDestinationIds: DESTINATIONS.map((d) => d.id),
        });
        set({
          phase: 'arrived',
          activeSession: null,
          totalFocusMinutes: newTotal,
          totalDistanceMkm: totalDistanceMkm + dest.distanceMkm,
          visitedIds: newVisited,
          arrival: { destinationId: dest.id, minutes: s.plannedMinutes, distanceMkm: dest.distanceMkm, newlyUnlockedIds, firstVisit },
          log: newLog,
          earnedPatches: newPatchIds.length
            ? { ...earnedPatches, ...Object.fromEntries(newPatchIds.map((id) => [id, now])) }
            : earnedPatches,
          pendingReveals: newPatchIds.length ? [...pendingReveals, ...newPatchIds] : pendingReveals,
        });
      },

      dismissArrival: () => set({ arrival: null, phase: 'idle' }),

      dismissReveal: () => set((st) => ({ pendingReveals: st.pendingReveals.slice(1) })),

      abortMission: (now) => {
        const { activeSession: s, log } = get();
        if (!s) return;
        set({
          phase: 'idle',
          activeSession: null,
          log: [
            ...log,
            {
              id: crypto.randomUUID(),
              destinationId: s.destinationId,
              startedAt: s.startedAt,
              endedAt: now,
              plannedMinutes: s.plannedMinutes,
              actualMinutes: elapsedMinutes(s, now),
              completed: false,
              category: s.category,
            },
          ],
        });
      },

      updateSettings: (p) => set((st) => ({ settings: { ...st.settings, ...p } })),

      resume: (now) => {
        const { activeSession: s } = get();
        if (!s) return;
        if (isExpired(s, now)) get().completeMission(now);
        else set({ phase: 'transit' });
      },
    }),
    {
      name: 'driftless-v1',
      partialize: (st) => ({
        activeSession: st.activeSession,
        visitedIds: st.visitedIds,
        totalFocusMinutes: st.totalFocusMinutes,
        totalDistanceMkm: st.totalDistanceMkm,
        log: st.log,
        earnedPatches: st.earnedPatches,
        settings: st.settings,
      }),
    },
  ),
);

// Test-only handle for deterministic control of app state from Playwright
// (phase transitions, seeded settings). Stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as { __driftlessStore?: typeof useStore }).__driftlessStore = useStore;
}
