import { useEffect } from 'react';
import { useStore, type Phase } from '../state/store';
import { audio } from './engine';
import { ASCENT_MS } from '../canvas/ascent';
import { LANDING_MS } from '../canvas/landing';
import { getLandingProfile } from '../canvas/landingProfiles';
import { TEST_MODE, TEST_ASCENT_MS, TEST_LANDING_MS } from '../lib/testMode';

const MISSION_PHASES: Phase[] = ['launching', 'ascent', 'transit', 'arriving', 'landing'];

/** Wires store settings and phase transitions to the audio engine. Call once in App. */
export function useAudio() {
  useEffect(() => {
    const { settings } = useStore.getState();
    audio.setVolume(settings.volume);
    audio.setMuted(settings.muted);
    audio.setAmbience(settings.ambience);
    audio.setHalfwayEnabled(settings.halfwayPing);

    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    let prev = useStore.getState();
    const unsub = useStore.subscribe((st) => {
      if (st.settings.volume !== prev.settings.volume) audio.setVolume(st.settings.volume);
      if (st.settings.muted !== prev.settings.muted) audio.setMuted(st.settings.muted);
      if (st.settings.ambience !== prev.settings.ambience) audio.setAmbience(st.settings.ambience);
      if (st.settings.halfwayPing !== prev.settings.halfwayPing) audio.setHalfwayEnabled(st.settings.halfwayPing);
      if (st.phase !== prev.phase) {
        // takeoff roar tracks the ascent animation; leaving ascent (arrival at
        // the map, or a skip) fades and tears it down cleanly
        if (st.phase === 'ascent') audio.startTakeoff(TEST_MODE ? TEST_ASCENT_MS : ASCENT_MS);
        else if (prev.phase === 'ascent') audio.stopTakeoff();

        // landing roar tracks the descent; leaving landing (arrival card, or a
        // skip) fades and tears it down
        if (st.phase === 'landing') {
          const destId = st.activeSession?.destinationId;
          const airless = destId ? getLandingProfile(destId).atmosphere === 'none' : false;
          audio.startLanding(airless, TEST_MODE ? TEST_LANDING_MS : LANDING_MS);
        } else if (prev.phase === 'landing') {
          audio.stopLanding();
        }

        if (st.phase === 'launching') {
          audio.startBed();
          audio.cueLaunch();
        } else if (st.phase === 'transit' && prev.phase === 'idle') {
          audio.startBed(); // resumed session after reload
        } else if (st.phase === 'arrived') {
          // completion (via landing, reduced-motion fade, or reload-after-expiry)
          audio.cueArrival();
        } else if (st.phase === 'idle' && MISSION_PHASES.includes(prev.phase)) {
          audio.stopBed(); // aborted
        } else if (st.phase === 'idle' && prev.phase === 'arrived') {
          audio.stopBed();
        }
      }
      prev = st;
    });

    return () => {
      unsub();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}
