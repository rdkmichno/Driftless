import { test, expect } from '@playwright/test';
import { openApp } from './helpers';

test.describe('regressions', () => {
  test('a custom 30-minute session shows "30 min" and counts down from 30:00 (guards the ÷60 bug)', async ({ page }) => {
    await openApp(page);

    // enter 30 in the custom-duration number field and plot the transit
    await page.locator('input[type=number]').fill('30');
    await page.getByRole('button', { name: 'Plot custom transit' }).click();

    // the authorization manifest states the real duration
    await expect(page.getByText('TRANSIT TIME')).toBeVisible();
    await expect(page.getByText('30 min', { exact: true })).toBeVisible();

    // authorize (plain-confirm path), then jump to the map deterministically
    await page.getByRole('button', { name: 'authorize without holding' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__driftlessStore.getState().phase)).toBe('launching');
    await page.evaluate(() => (window as any).__driftlessStore.getState().beginTransit(Date.now()));

    // the map HUD shows a full 30:00 (never 0.5), and the route says 30 min
    await expect(page.getByText('30:00')).toBeVisible();
    await expect(page.getByText('30 min')).toBeVisible();

    // and the timer really is ~30 minutes, not 30 seconds
    const remainingMs = await page.evaluate(() => {
      const s = (window as any).__driftlessStore.getState().activeSession;
      return s.endAt - s.startedAt;
    });
    expect(remainingMs).toBe(30 * 60_000);
  });

  test('reloading mid-session resumes the timer and does NOT replay the launch animation', async ({ page }) => {
    await openApp(page);
    const T = Date.now();
    await page.evaluate((t) => {
      const store = (window as any).__driftlessStore;
      store.getState().openBriefing({ destinationId: 'mars', plannedMinutes: 25 });
      store.getState().launch(t);
      store.getState().beginTransit(t);
    }, T);
    await expect.poll(() => page.evaluate(() => (window as any).__driftlessStore.getState().phase)).toBe('transit');

    await page.reload();
    await page.waitForFunction(() => !!(window as unknown as { __driftlessStore?: unknown }).__driftlessStore);

    // resumes straight into the map — not launching/ascent, and no skip overlay
    await expect.poll(() => page.evaluate(() => (window as any).__driftlessStore.getState().phase)).toBe('transit');
    await expect(page.getByRole('button', { name: 'Skip launch animation' })).toHaveCount(0);
    await expect(page.getByText('IN PROGRESS')).toBeVisible();

    // and the session is intact (25-minute plan preserved)
    const planned = await page.evaluate(() => (window as any).__driftlessStore.getState().activeSession.plannedMinutes);
    expect(planned).toBe(25);
  });

  test('the top-down map renders with the ship at the trajectory origin after launch', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const store = (window as any).__driftlessStore;
      store.getState().openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
      store.getState().launch(Date.now());
      store.getState().beginTransit(Date.now());
    });

    // both endpoints and the in-progress card are present (map is up)
    await expect(page.getByText('EARTH', { exact: true })).toBeVisible();
    await expect(page.getByText('IN PROGRESS')).toBeVisible();
    // ship is at the origin: journey progress is 0 at the start of transit
    const bar = page.getByRole('progressbar', { name: 'Journey progress' });
    await expect(bar).toHaveAttribute('aria-valuenow', '0');
  });
});
