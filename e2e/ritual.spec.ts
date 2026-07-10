import { test, expect } from '@playwright/test';
import { openApp, audioSnapshot } from './helpers';

// Mission-authorization ritual + pre-launch sequence. The hold is driven by
// real mouse events against the wall-clock hold engine; assertions poll
// observable state (chip text, aria progress, store phase) — no blind waits.

const phase = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__driftlessStore.getState().phase);

async function openAuthorization(page: import('@playwright/test').Page, destinationId = 'moon', plannedMinutes = 10) {
  await page.evaluate(
    ([d, m]) => (window as any).__driftlessStore.getState().openBriefing({ destinationId: d, plannedMinutes: m }),
    [destinationId, plannedMinutes] as [string, number],
  );
  await page.getByRole('button', { name: 'Hold to authorize launch' }).waitFor();
}

async function holdPad(page: import('@playwright/test').Page) {
  const pad = page.getByRole('button', { name: 'Hold to authorize launch' });
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
}

test.describe('mission authorization ritual', () => {
  test('completing the hold flips to CLEARED FOR LAUNCH and proceeds to takeoff', async ({ page }) => {
    await openApp(page);
    await openAuthorization(page);
    await expect(page.getByText('AWAITING CLEARANCE')).toBeVisible();

    await holdPad(page);
    await expect(page.getByText('CLEARED FOR LAUNCH', { exact: true })).toBeVisible({ timeout: 6000 });
    await page.mouse.up();

    // stamp → launch → pre-launch sequence → takeoff
    await expect.poll(() => phase(page), { timeout: 4000 }).toBe('launching');
    await expect.poll(() => phase(page), { timeout: 8000 }).toBe('ascent');
  });

  test('releasing the hold early cancels — ring drains, no launch', async ({ page }) => {
    await openApp(page);
    await openAuthorization(page);
    const ring = page.getByRole('progressbar', { name: 'Authorization progress' });

    await holdPad(page);
    await expect.poll(async () => Number(await ring.getAttribute('aria-valuenow'))).toBeGreaterThan(15);
    await page.mouse.up();

    // drains back to zero, still awaiting clearance, never leaves briefing
    await expect.poll(async () => Number(await ring.getAttribute('aria-valuenow'))).toBe(0);
    await expect(page.getByText('AWAITING CLEARANCE')).toBeVisible();
    expect(await phase(page)).toBe('briefing');
  });

  test('the "Skip launch ritual" setting bypasses the card and the pre-launch sequence', async ({ page }) => {
    await openApp(page, { skipRitual: true });
    await page.evaluate(() =>
      (window as any).__driftlessStore.getState().openBriefing({ destinationId: 'moon', plannedMinutes: 10 }),
    );
    // no hold required — straight through to the takeoff animation
    await expect.poll(() => phase(page), { timeout: 5000 }).toBe('ascent');
  });

  test('the session timer starts when the map begins, not when the ritual starts', async ({ page }) => {
    await openApp(page);
    const ritualStart = Date.now();
    await openAuthorization(page, 'moon', 10);
    await holdPad(page);
    await expect(page.getByText('CLEARED FOR LAUNCH', { exact: true })).toBeVisible({ timeout: 6000 });
    await page.mouse.up();

    // ride the ritual + pre-launch + takeoff through to the map
    await expect.poll(() => phase(page), { timeout: 30_000 }).toBe('transit');
    const s = await page.evaluate(() => {
      const a = (window as any).__driftlessStore.getState().activeSession;
      return { startedAt: a.startedAt, dur: a.endAt - a.startedAt };
    });
    expect(s.dur).toBe(10 * 60_000); // full planned duration at the map
    expect(s.startedAt - ritualStart).toBeGreaterThan(5000); // ritual time not deducted
    expect(Date.now() - s.startedAt).toBeLessThan(4000); // seeded at map start
    await page.evaluate(() => (window as any).__driftlessStore.getState().abortMission(Date.now()));
  });

  test('reloading mid-session does not replay the ritual', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const s = (window as any).__driftlessStore.getState();
      s.openBriefing({ destinationId: 'mars', plannedMinutes: 25 });
      s.launch(Date.now());
      s.beginTransit(Date.now());
    });
    await page.reload();
    await page.waitForFunction(() => !!(window as unknown as { __driftlessStore?: unknown }).__driftlessStore);
    await expect.poll(() => phase(page)).toBe('transit');
    await expect(page.getByText('MISSION AUTHORIZATION')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Hold to authorize launch' })).toHaveCount(0);
  });

  test('cancelling mid-ritual leaves no running audio nodes or timers', async ({ page }) => {
    await openApp(page);
    await openAuthorization(page);
    const ring = page.getByRole('progressbar', { name: 'Authorization progress' });

    await holdPad(page);
    await expect.poll(async () => Number(await ring.getAttribute('aria-valuenow'))).toBeGreaterThan(10);
    expect((await audioSnapshot(page)).holdActive).toBe(true);
    await page.mouse.up();

    await page.getByRole('button', { name: 'Stand down' }).click();
    await expect.poll(() => phase(page)).toBe('idle');
    await expect.poll(async () => (await audioSnapshot(page)).holdActive).toBe(false);
    // still idle a beat later — no orphaned launch timer fired
    await expect.poll(() => phase(page), { timeout: 3000 }).toBe('idle');
  });
});
