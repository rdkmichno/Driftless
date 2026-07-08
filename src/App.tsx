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
import { useAudio } from './audio/useAudio';
import { audio } from './audio/engine';
import { ArrivalCard } from './components/ArrivalCard';
import { StarMap } from './components/StarMap';
import { MissionLogView } from './components/MissionLogView';
import { SettingsView } from './components/SettingsView';

import { devMinutes } from './lib/devOverride';

export function App() {
  const phase = useStore((s) => s.phase);
  const [homeView, setHomeView] = useState<HomeNav | 'home'>('home');
  const now = useTicker();
  const prevProgress = useRef(0);
  useAudio();

  // Resume a persisted in-flight session once on boot
  useEffect(() => {
    useStore.getState().resume(Date.now());
  }, []);

  // Dev duration override (?t=minutes, dev builds only). Never touches custom
  // sessions — the user-entered duration is always honoured exactly.
  useEffect(() => {
    if (devMinutes && phase === 'briefing') {
      const { pending } = useStore.getState();
      if (pending && !pending.custom && pending.plannedMinutes !== devMinutes) {
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
    sceneState.classified = s?.classified ?? false;
    if (!s || !inFlight) {
      if (phase === 'idle') sceneState.planetProgress = 0;
      prevProgress.current = 0;
      return;
    }
    const p = progress(s, now);
    sceneState.planetProgress = p;
    if (st.settings.halfwayPing && prevProgress.current > 0 && prevProgress.current < 0.5 && p >= 0.5) {
      audio.cueHalfway();
    }
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
          {phase === 'idle' && homeView === 'map' && <StarMap key="map" onBack={() => setHomeView('home')} />}
          {phase === 'idle' && homeView === 'log' && (
            <MissionLogView key="log" onBack={() => setHomeView('home')} />
          )}
          {phase === 'idle' && homeView === 'settings' && (
            <SettingsView key="settings" onBack={() => setHomeView('home')} />
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
