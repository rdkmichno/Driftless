import { test, expect } from '@playwright/test';
import { openApp, audioSnapshot } from './helpers';

// The full loop, exercised end-to-end under the 10-second test mode. Phase
// advances are driven through the store hook (deterministic) rather than
// waiting out real animations; the landing animation is allowed to resolve on
// its own via a condition poll (not an arbitrary timeout).

test.describe('10-second test mode', () => {
  test('forces 10s journeys, runs the full loop, marks visited, and never pollutes the real log', async ({ page }) => {
    await openApp(page, undefined, '?test=1');

    // obvious on-screen indicator so it can't ship enabled by accident
    await expect(page.getByTestId('test-mode-badge')).toBeVisible();

    await page.evaluate(() => (window as any).__driftlessAudioEngine.unlock());

    // launch a Moon mission (real preset is 10 min) through the store
    await page.evaluate(() => {
      const s = (window as any).__driftlessStore.getState();
      s.openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
      s.launch(Date.now());
    });

    // test mode forced the timer to 10s, while the real duration data is intact
    const TEST_SESSION_MS = 5_000; // mirrors src/lib/testMode.ts
    const durAfterLaunch = await page.evaluate(() => {
      const a = (window as any).__driftlessStore.getState().activeSession;
      return { dur: a.endAt - a.startedAt, planned: a.plannedMinutes, test: a.test };
    });
    expect(durAfterLaunch.dur).toBe(TEST_SESSION_MS); // short test timer, not the real 10 min
    expect(durAfterLaunch.planned).toBe(10); // real minutes preserved
    expect(durAfterLaunch.test).toBe(true);

    // through the takeoff into the map — duration is preserved (not jumped)
    await page.evaluate(() => {
      (window as any).__driftlessStore.getState().beginAscent();
      (window as any).__driftlessStore.getState().beginTransit(Date.now());
    });
    expect(await page.evaluate(() => { const a = (window as any).__driftlessStore.getState().activeSession; return a.endAt - a.startedAt; })).toBe(TEST_SESSION_MS);
    expect(await page.evaluate(() => (window as any).__driftlessStore.getState().phase)).toBe('transit');

    // timer completes → landing animation fires (phase + landing audio nodes)
    await page.evaluate(() => (window as any).__driftlessStore.getState().beginLanding());
    expect(await page.evaluate(() => (window as any).__driftlessStore.getState().phase)).toBe('landing');
    await expect.poll(async () => (await audioSnapshot(page)).landingActive).toBe(true);

    // the landing resolves on its own into the arrival card
    await expect.poll(() => page.evaluate(() => (window as any).__driftlessStore.getState().phase), { timeout: 12_000 }).toBe('arrived');
    await expect(page.getByText(/Arrived at The Moon/)).toBeVisible();

    // destination marked visited; real mission log + lifetime stats untouched
    const after = await page.evaluate(() => {
      const s = (window as any).__driftlessStore.getState();
      return { visited: s.visitedIds, log: s.log.length, minutes: s.totalFocusMinutes, distance: s.totalDistanceMkm };
    });
    expect(after.visited).toContain('moon');
    expect(after.log).toBe(0);
    expect(after.minutes).toBe(0);
    expect(after.distance).toBe(0);

    // landing audio is torn down once the card is shown
    await expect.poll(async () => (await audioSnapshot(page)).landingActive).toBe(false);
    await expect.poll(async () => (await audioSnapshot(page)).landingNodes).toBe(0);
  });

  test('is OFF by default (no test badge, real durations)', async ({ page }) => {
    await openApp(page); // no ?test=1
    await expect(page.getByTestId('test-mode-badge')).toHaveCount(0);
    await page.evaluate(() => {
      const s = (window as any).__driftlessStore.getState();
      s.openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
      s.launch(Date.now());
    });
    const dur = await page.evaluate(() => { const a = (window as any).__driftlessStore.getState().activeSession; return a.endAt - a.startedAt; });
    expect(dur).toBe(10 * 60_000); // real 10 minutes, not 10 seconds
  });
});
