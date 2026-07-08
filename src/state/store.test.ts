import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';

const T0 = 1_750_000_000_000;
const initial = useStore.getState();

beforeEach(() => {
  localStorage.clear();
  useStore.setState(
    { ...initial, phase: 'idle', pending: null, activeSession: null, arrival: null, visitedIds: [], totalFocusMinutes: 0, totalDistanceMkm: 0, log: [] },
    true,
  );
});

describe('mission lifecycle', () => {
  it('briefing -> launch -> transit -> complete credits totals, visit, and log', () => {
    useStore.getState().openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
    expect(useStore.getState().phase).toBe('briefing');
    useStore.getState().launch(T0);
    expect(useStore.getState().phase).toBe('launching');
    expect(useStore.getState().activeSession?.endAt).toBe(T0 + 10 * 60_000);
    useStore.getState().beginTransit(T0);
    useStore.getState().completeMission(T0 + 10 * 60_000);
    const st = useStore.getState();
    expect(st.phase).toBe('arrived');
    expect(st.totalFocusMinutes).toBe(10);
    expect(st.visitedIds).toContain('moon');
    expect(st.activeSession).toBeNull();
    expect(st.log).toHaveLength(1);
    expect(st.log[0].completed).toBe(true);
    expect(st.arrival?.firstVisit).toBe(true);
  });

  it('reports newly unlocked destinations on completion', () => {
    useStore.setState({ totalFocusMinutes: 25 }); // belt unlocks at 30
    useStore.getState().openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
    useStore.getState().launch(T0);
    useStore.getState().completeMission(T0 + 10 * 60_000);
    expect(useStore.getState().arrival?.newlyUnlockedIds).toContain('belt');
  });

  it('abort logs an incomplete mission and credits nothing', () => {
    useStore.getState().openBriefing({ destinationId: 'mars', plannedMinutes: 25 });
    useStore.getState().launch(T0);
    useStore.getState().abortMission(T0 + 5 * 60_000);
    const st = useStore.getState();
    expect(st.phase).toBe('idle');
    expect(st.totalFocusMinutes).toBe(0);
    expect(st.log[0]).toMatchObject({ completed: false, actualMinutes: 5 });
    expect(st.visitedIds).toHaveLength(0);
  });

  it('re-seeds the timer when transit begins so the map gets the full duration', () => {
    useStore.getState().openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
    useStore.getState().launch(T0);
    useStore.getState().beginAscent();
    expect(useStore.getState().phase).toBe('ascent');
    // ritual + ascent took 8 s; the countdown must still be a full 10 min from map start
    useStore.getState().beginTransit(T0 + 8_000);
    const s = useStore.getState().activeSession!;
    expect(s.startedAt).toBe(T0 + 8_000);
    expect(s.endAt).toBe(T0 + 8_000 + 10 * 60_000);
  });

  it('resume: running session goes to transit, expired session completes', () => {
    useStore.getState().openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
    useStore.getState().launch(T0);
    useStore.setState({ phase: 'idle' }); // simulate reload
    useStore.getState().resume(T0 + 60_000);
    expect(useStore.getState().phase).toBe('transit');
    useStore.getState().resume(T0 + 11 * 60_000);
    expect(useStore.getState().phase).toBe('arrived');
    expect(useStore.getState().totalFocusMinutes).toBe(10);
  });
});
