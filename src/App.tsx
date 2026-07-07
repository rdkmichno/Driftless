import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { SceneCanvas, sceneState } from './canvas/SceneCanvas';
import { ARRIVING_MS, progress, remainingMs } from './engine/session';
import { useTicker } from './engine/useTicker';
import { useStore } from './state/store';
import { HomeView, type HomeNav } from './components/HomeView';
import { BriefingCard } from './components/BriefingCard';
import { LaunchSequence } from './components/LaunchSequence';
import { TransitHUD } from './components/TransitHUD';
import { ArrivalCard } from './components/ArrivalCard';

// Dev aid: ?t=<minutes> overrides every mission's planned duration (dev builds only)
const devMinutes = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('t')) || null : null;

export function App() {
  const phase = useStore((s) => s.phase);
  const [homeView, setHomeView] = useState<HomeNav | 'home'>('home');
  const now = useTicker();
  const prevProgress = useRef(0);

  // Resume a persisted in-flight session once on boot
  useEffect(() => {
    useStore.getState().resume(Date.now());
  }, []);

  // Dev duration override: shrink the pending mission right after briefing opens
  useEffect(() => {
    if (devMinutes && phase === 'briefing') {
      const { pending } = useStore.getState();
      if (pending && pending.plannedMinutes !== devMinutes) {
        useStore.setState({ pending: { ...pending, plannedMinutes: devMinutes } });
      }
    }
  }, [phase]);

  // Skip-ritual: jump straight from briefing to launch
  useEffect(() => {
    if (phase === 'briefing' && useStore.getState().settings.skipRitual) {
      useStore.getState().launch(Date.now());
    }
  }, [phase]);

  // Mission driver: feeds the scene and advances transit -> arriving -> arrived
  useEffect(() => {
    const st = useStore.getState();
    const s = st.activeSession;
    const inFlight = phase === 'transit' || phase === 'arriving' || phase === 'launching';
    sceneState.destinationId = inFlight || phase === 'arrived' ? (s?.destinationId ?? st.arrival?.destinationId ?? null) : null;
    if (!s || !inFlight) {
      if (phase === 'idle') sceneState.planetProgress = 0;
      prevProgress.current = 0;
      return;
    }
    const p = progress(s, now);
    sceneState.planetProgress = p;
    const remaining = remainingMs(s, now);
    if (phase === 'transit' || phase === 'arriving') {
      if (remaining <= 0) {
        sceneState.planetProgress = 1;
        st.completeMission(Date.now());
        return;
      }
      if (phase === 'transit' && remaining <= ARRIVING_MS) st.beginArriving();
    }
    prevProgress.current = p;
  }, [now, phase]);

  // Leaving idle resets sub-navigation
  useEffect(() => {
    if (phase !== 'idle') setHomeView('home');
  }, [phase]);

  return (
    <div className="relative h-full">
      <SceneCanvas />
      <div className="relative z-10 h-full">
        <AnimatePresence mode="wait">
          {phase === 'idle' && homeView === 'home' && (
            <HomeView key="home" onNavigate={setHomeView} />
          )}
          {phase === 'briefing' && <BriefingCard key="briefing" />}
          {phase === 'launching' && <LaunchSequence key="launch" />}
          {(phase === 'transit' || phase === 'arriving') && <TransitHUD key="hud" now={now} />}
          {phase === 'arrived' && <ArrivalCard key="arrival" />}
        </AnimatePresence>
      </div>
    </div>
  );
}
