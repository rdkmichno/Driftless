import type { Page } from '@playwright/test';

export const APP_URL = '/Driftless/';

/** Settings shape mirrored from the store for seeding persisted state. */
export type Settings = {
  volume: number;
  muted: boolean;
  ambience: 'drift' | 'cockpit' | 'silence';
  reducedMotion: boolean;
  skipRitual: boolean;
  halfwayPing: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  volume: 0.3,
  muted: false,
  ambience: 'drift',
  reducedMotion: false,
  skipRitual: false,
  halfwayPing: false,
};

/**
 * Load the app (each Playwright test gets an isolated, empty storage context),
 * optionally seeding persisted settings. Init scripts run on every navigation
 * including reloads, so: transitions/animations are killed for deterministic
 * geometry (the harness throttles the frame clock, freezing in-flight CSS
 * transitions), and seeding is only-if-absent so a reload preserves whatever
 * the app itself persisted (required by the persistence tests).
 */
export async function openApp(page: Page, settings?: Partial<Settings>, query = '') {
  await page.addInitScript(() => {
    const css = '*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }';
    const inject = () => {
      const s = document.createElement('style');
      s.textContent = css;
      document.head.appendChild(s);
    };
    if (document.head) inject();
    else document.addEventListener('DOMContentLoaded', inject);
  });
  if (settings) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    await page.addInitScript((s) => {
      if (!localStorage.getItem('driftless-v1')) {
        localStorage.setItem(
          'driftless-v1',
          JSON.stringify({ state: { visitedIds: [], totalFocusMinutes: 0, totalDistanceMkm: 0, log: [], settings: s }, version: 0 }),
        );
      }
    }, merged);
  }
  await page.goto(APP_URL + query);
  await page.waitForFunction(() => !!(window as unknown as { __driftlessStore?: unknown }).__driftlessStore);
}

/** Read the current store settings from the live app. */
export async function readSettings(page: Page): Promise<Settings> {
  return page.evaluate(() => (window as any).__driftlessStore.getState().settings);
}

/** Read an audio-graph snapshot from the test hook. */
export async function audioSnapshot(page: Page) {
  return page.evaluate(() => (window as any).__driftlessAudio());
}

/** Navigate the home view to the Settings panel and wait for the toggles. */
export async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: 'Mute' }).waitFor();
}

/** Geometry + state of a single toggle switch by its accessible name. */
export async function toggleState(page: Page, name: string) {
  return page.evaluate((label) => {
    const sw = [...document.querySelectorAll('[role="switch"]')].find(
      (s) => s.getAttribute('aria-label') === label,
    ) as HTMLElement | undefined;
    if (!sw) return null;
    const knob = sw.querySelector('span') as HTMLElement;
    const t = sw.getBoundingClientRect();
    const k = knob.getBoundingClientRect();
    return {
      ariaChecked: sw.getAttribute('aria-checked') === 'true',
      knobOffset: Math.round(k.left - t.left),
      overflowRight: Math.round(k.right - t.right), // >0 means the knob spills past the track
    };
  }, name);
}
