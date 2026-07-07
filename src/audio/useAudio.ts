import { useEffect } from 'react';
import { useStore, type Phase } from '../state/store';
import { audio } from './engine';

const MISSION_PHASES: Phase[] = ['launching', 'transit', 'arriving'];

/** Wires store settings and phase transitions to the audio engine. Call once in App. */
export function useAudio() {
  useEffect(() => {
    const { settings } = useStore.getState();
    audio.setVolume(settings.volume);
    audio.setMuted(settings.muted);
    audio.setAmbience(settings.ambience);

    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    let prev = useStore.getState();
    const unsub = useStore.subscribe((st) => {
      if (st.settings.volume !== prev.settings.volume) audio.setVolume(st.settings.volume);
      if (st.settings.muted !== prev.settings.muted) audio.setMuted(st.settings.muted);
      if (st.settings.ambience !== prev.settings.ambience) audio.setAmbience(st.settings.ambience);
      if (st.phase !== prev.phase) {
        if (st.phase === 'launching') {
          audio.startBed();
          audio.cueLaunch();
        } else if (st.phase === 'transit' && prev.phase === 'idle') {
          audio.startBed(); // resumed session after reload
        } else if (st.phase === 'arriving') {
          audio.cueArrival();
        } else if (st.phase === 'arrived' && prev.phase !== 'arriving') {
          // reload-after-expiry lands directly on arrived — still play the chord
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
