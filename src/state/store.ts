import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDestination, unlockedIdsFor } from '../data/destinations';
import { createSession, elapsedMinutes, isExpired, type ActiveSession } from '../engine/session';

export type Phase = 'idle' | 'briefing' | 'launching' | 'transit' | 'arriving' | 'arrived';
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
  settings: Settings;
  openBriefing: (p: PendingMission) => void;
  cancelBriefing: () => void;
  launch: (now: number, category?: string) => void;
  beginTransit: () => void;
  beginArriving: () => void;
  completeMission: (now: number) => void;
  dismissArrival: () => void;
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
      settings: { volume: 0.3, muted: false, ambience: 'drift', reducedMotion: false, skipRitual: false, halfwayPing: false },

      openBriefing: (pending) => set({ pending, phase: 'briefing' }),
      cancelBriefing: () => set({ pending: null, phase: 'idle' }),

      launch: (now, category) => {
        const { pending } = get();
        if (!pending) return;
        const session = createSession(pending.destinationId, pending.plannedMinutes, now, {
          category,
          classified: pending.classified,
        });
        set({ activeSession: session, pending: null, phase: 'launching' });
      },

      beginTransit: () => set({ phase: 'transit' }),
      beginArriving: () => set({ phase: 'arriving' }),

      completeMission: (now) => {
        const { activeSession: s, totalFocusMinutes, totalDistanceMkm, visitedIds, log } = get();
        if (!s) return;
        const dest = getDestination(s.destinationId);
        if (!dest) return;
        const before = unlockedIdsFor(totalFocusMinutes);
        const newTotal = totalFocusMinutes + s.plannedMinutes;
        const newlyUnlockedIds = unlockedIdsFor(newTotal).filter((id) => !before.includes(id));
        const firstVisit = !visitedIds.includes(dest.id);
        set({
          phase: 'arrived',
          activeSession: null,
          totalFocusMinutes: newTotal,
          totalDistanceMkm: totalDistanceMkm + dest.distanceMkm,
          visitedIds: firstVisit ? [...visitedIds, dest.id] : visitedIds,
          arrival: { destinationId: dest.id, minutes: s.plannedMinutes, distanceMkm: dest.distanceMkm, newlyUnlockedIds, firstVisit },
          log: [
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
          ],
        });
      },

      dismissArrival: () => set({ arrival: null, phase: 'idle' }),

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
        settings: st.settings,
      }),
    },
  ),
);
