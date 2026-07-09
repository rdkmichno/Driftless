import { test, expect } from '@playwright/test';
import { openApp, audioSnapshot } from './helpers';

// Playwright cannot hear audio — every assertion is on Web Audio graph state
// (node counts, gains, pan values) read through the DEV-only test hook.

async function unlock(page: import('@playwright/test').Page) {
  await page.evaluate(() => (window as any).__driftlessAudioEngine.unlock());
}

test.describe('audio panning', () => {
  test('every cue plays centered (pan === 0)', async ({ page }) => {
    await openApp(page);
    await unlock(page);
    // fire every milestone cue, then confirm the graph is still centred
    await page.evaluate(() => {
      const eng = (window as any).__driftlessAudioEngine;
      eng.setHalfwayEnabled(true);
      eng.cueLaunch();
      eng.cueArrival();
      eng.cueHalfway();
    });
    const snap = await audioSnapshot(page);
    expect(snap.pans.length).toBeGreaterThan(0);
    for (const p of snap.pans) expect(p).toBe(0);
  });
});

test.describe('mute', () => {
  test('mute drives master gain to 0 and unmute restores the prior volume', async ({ page }) => {
    await openApp(page);
    await unlock(page);
    await page.evaluate(() => (window as any).__driftlessAudioEngine.setVolume(0.5));
    expect((await audioSnapshot(page)).masterTarget).toBeCloseTo(0.25, 5); // 0.5^2

    await page.evaluate(() => (window as any).__driftlessAudioEngine.setMuted(true));
    expect((await audioSnapshot(page)).masterTarget).toBe(0);

    await page.evaluate(() => (window as any).__driftlessAudioEngine.setMuted(false));
    expect((await audioSnapshot(page)).masterTarget).toBeCloseTo(0.25, 5);
  });
});

test.describe('halfway ping', () => {
  test('disabled → no midpoint cue node is created; enabled → it fires', async ({ page }) => {
    await openApp(page);
    await unlock(page);
    const counts = await page.evaluate(() => {
      const eng = (window as any).__driftlessAudioEngine;
      eng.setHalfwayEnabled(false);
      eng.cueHalfway();
      const off = eng.snapshot().halfwayCueCount;
      eng.setHalfwayEnabled(true);
      eng.cueHalfway();
      const on = eng.snapshot().halfwayCueCount;
      return { off, on };
    });
    expect(counts.off).toBe(0);
    expect(counts.on).toBe(1);
  });
});

test.describe('takeoff audio lifecycle', () => {
  test('launching an ascent creates takeoff nodes, and they are torn down after the map loads', async ({ page }) => {
    await openApp(page);
    await unlock(page);

    // real code path: briefing → launch → ascent
    await page.evaluate(() => {
      const store = (window as any).__driftlessStore;
      store.getState().openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
      store.getState().launch(Date.now());
      store.getState().beginAscent();
    });
    await expect.poll(async () => (await audioSnapshot(page)).takeoffActive).toBe(true);
    expect((await audioSnapshot(page)).takeoffNodes).toBeGreaterThan(0);

    // reaching the map (or skipping) stops the takeoff sound and frees its nodes
    await page.evaluate(() => (window as any).__driftlessStore.getState().beginTransit(Date.now()));
    await expect.poll(async () => (await audioSnapshot(page)).takeoffActive).toBe(false);
    expect((await audioSnapshot(page)).takeoffNodes).toBe(0);
  });

  test('muted → takeoff produces no audible output (master gain 0)', async ({ page }) => {
    await openApp(page, { muted: true });
    await unlock(page);
    await page.evaluate(() => {
      const store = (window as any).__driftlessStore;
      store.getState().openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
      store.getState().launch(Date.now());
      store.getState().beginAscent();
    });
    await expect.poll(async () => (await audioSnapshot(page)).takeoffActive).toBe(true);
    // takeoff is running but the master bus is silenced
    expect((await audioSnapshot(page)).masterTarget).toBe(0);
    await page.evaluate(() => (window as any).__driftlessStore.getState().beginTransit(Date.now()));
  });
});
