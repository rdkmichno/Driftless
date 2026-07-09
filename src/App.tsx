import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SceneCanvas, sceneState } from './canvas/SceneCanvas';
import { resetCamera } from './canvas/camera';
import { progress, remainingMs } from './engine/session';
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
import { TEST_MODE } from './lib/testMode';

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

  // Dev-only phase timeline for debugging/verification
  useEffect(() => {
    if (import.meta.env.DEV) {
      const w = window as unknown as { __phases?: [number, string][] };
      (w.__phases ??= []).push([Date.now(), phase]);
    }
  }, [phase]);

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

  // Mission driver: feeds the scene and, at completion, hands off to the
  // landing animation (or a calm fade under reduced motion) before crediting.
  useEffect(() => {
    const st = useStore.getState();
    const s = st.activeSession;
    const inFlight =
      phase === 'transit' || phase === 'arriving' || phase === 'launching' || phase === 'ascent' || phase === 'landing';
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
    if (phase === 'transit' && remainingMs(s, now) <= 0) {
      sceneState.planetProgress = 1;
      const reduced =
        st.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) st.completeMission(Date.now()); // calm fade straight to the arrival card
      else st.beginLanding(); // play the descent, which credits on completion
      return;
    }
    prevProgress.current = p;
  }, [now, phase]);

  // Leaving idle resets sub-navigation
  useEffect(() => {
    if (phase !== 'idle') setHomeView('home');
  }, [phase]);

  // Map camera only persists across reloads of an in-progress session
  useEffect(() => {
    if (phase === 'idle' || phase === 'arrived') resetCamera(true);
  }, [phase]);

  return (
    <div className="relative h-full">
      <SceneCanvas />
      {TEST_MODE && (
        <div
          data-testid="test-mode-badge"
          className="pointer-events-none fixed left-3 top-3 z-50 rounded border border-accent-400 bg-space-950/85 px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-accent-300"
        >
          ⚠ TEST MODE · ~10s LOOP
        </div>
      )}
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
          {phase === 'ascent' && (
            <motion.button
              key="ascent-skip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              aria-label="Skip launch animation"
              onClick={() => useStore.getState().beginTransit(Date.now())}
              className="absolute inset-0 h-full w-full cursor-default"
            >
              <span className="absolute inset-x-0 bottom-8 text-center text-xs text-ink-500">tap to skip</span>
            </motion.button>
          )}
          {(phase === 'transit' || phase === 'arriving') && <TransitHUD key="hud" now={now} />}
          {phase === 'landing' && (
            <motion.button
              key="landing-skip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              aria-label="Skip landing animation"
              onClick={() => useStore.getState().completeMission(Date.now())}
              className="absolute inset-0 h-full w-full cursor-default"
            >
              <span className="absolute inset-x-0 bottom-8 text-center text-xs text-ink-500">tap to skip</span>
            </motion.button>
          )}
          {phase === 'arrived' && <ArrivalCard key="arrival" />}
        </AnimatePresence>
      </div>
    </div>
  );
}
