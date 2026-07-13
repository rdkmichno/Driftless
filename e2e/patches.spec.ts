import { test, expect, type Page } from '@playwright/test';
import { openApp, audioSnapshot } from './helpers';

// A fixed local afternoon so completions never trip the night-watch / dawn-patrol
// feat patches, keeping each test's awarded set predictable.
const NOON = new Date(2026, 6, 10, 14, 0).getTime();

/** Fly a full mission through the store in real (non-test) mode so patches are
 *  actually evaluated and credited (test mode intentionally awards nothing). */
async function fly(page: Page, destinationId: string, plannedMinutes: number, startAt = NOON) {
  await page.evaluate(
    ({ destinationId, plannedMinutes, startAt }) => {
      const s = () => (window as any).__driftlessStore.getState();
      s().openBriefing({ destinationId, plannedMinutes });
      s().launch(startAt);
      s().beginTransit(startAt);
      s().completeMission(startAt + plannedMinutes * 60_000);
    },
    { destinationId, plannedMinutes, startAt },
  );
}

const earned = (page: Page) => page.evaluate(() => (window as any).__driftlessStore.getState().earnedPatches);
const setState = (page: Page, patch: Record<string, unknown>) =>
  page.evaluate((p) => (window as any).__driftlessStore.setState(p), patch);

test.describe('mission patches', () => {
  test('a first landing awards that destination patch and it persists across reload', async ({ page }) => {
    await openApp(page);
    await fly(page, 'moon', 10);

    const after = await earned(page);
    expect(after['dest-moon']).toBeTruthy();
    expect(after['hours-first']).toBeTruthy(); // first completed mission
    expect(after['dest-mars']).toBeUndefined();

    await page.reload();
    await page.waitForFunction(() => !!(window as any).__driftlessStore);
    const persisted = await earned(page);
    expect(persisted['dest-moon']).toBeTruthy();
    // the reveal queue is never persisted — no replay on reload
    expect(await page.evaluate(() => (window as any).__driftlessStore.getState().pendingReveals)).toEqual([]);
  });

  test('crossing a cumulative-hours threshold awards the correct hours patch', async ({ page }) => {
    await openApp(page);
    // 590 min banked; moon already visited AND its destination/first-flight
    // patches already earned, so the only new milestone this run is 10 hours.
    await setState(page, { totalFocusMinutes: 590, visitedIds: ['moon'], earnedPatches: { 'dest-moon': 1, 'hours-first': 1 } });
    await fly(page, 'moon', 10);

    const after = await earned(page);
    expect(after['hours-10']).toBeTruthy(); // 600 min crosses the 10 h threshold
    expect(after['hours-25']).toBeUndefined();
    expect(after['dest-moon']).toBe(1); // not re-awarded — original timestamp kept
  });

  test('locked patches render as silhouettes without revealing their detail', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Patches' }).click();

    // many locked ghosts on an empty collection, each announced as locked
    const lockedButtons = page.getByRole('button', { name: /^Locked patch/i });
    await expect(lockedButtons.first()).toBeVisible(); // wait for the wall to mount
    expect(await lockedButtons.count()).toBeGreaterThan(10);

    // a locked patch never shows its ring label or flavor text on the wall
    await expect(page.getByText('NEPTUNE · DEEP RANGE')).toHaveCount(0);
    await expect(page.getByText('Rust under the landing legs at last.')).toHaveCount(0);

    // opening a locked patch shows only the earn hint, not the reward flavor
    await page.getByRole('button', { name: /Reach orbit above Neptune/i }).click();
    await expect(page.getByText('Reach orbit above Neptune.')).toBeVisible();
    await expect(page.getByText('The wind here would strip a coastline in a minute.')).toHaveCount(0);
  });

  test('the reveal fires once, is skippable, and does not replay after reload', async ({ page }) => {
    await openApp(page);
    await fly(page, 'moon', 10);
    // reveal waits behind the arrival card; dismiss arrival to release it
    await page.evaluate(() => (window as any).__driftlessStore.getState().dismissArrival());

    const reveal = page.getByTestId('patch-reveal');
    await expect(reveal).toBeVisible();
    await expect(page.getByText('Mission patch earned')).toBeVisible();

    // skip through the whole queue
    const queued = await page.evaluate(() => (window as any).__driftlessStore.getState().pendingReveals.length);
    expect(queued).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < queued; i++) {
      await page.getByRole('dialog').getByRole('button').last().click();
    }
    await expect(reveal).toHaveCount(0);

    // earned state remains, but the reveal never fires again after a reload
    await page.reload();
    await page.waitForFunction(() => !!(window as any).__driftlessStore);
    await expect(page.getByTestId('patch-reveal')).toHaveCount(0);
    expect((await earned(page))['dest-moon']).toBeTruthy();
  });

  test('the reveal chime respects mute', async ({ page }) => {
    await openApp(page, { muted: true });
    await page.evaluate(() => (window as any).__driftlessAudioEngine.unlock());
    await fly(page, 'moon', 10);
    await page.evaluate(() => (window as any).__driftlessStore.getState().dismissArrival());
    await expect(page.getByTestId('patch-reveal')).toBeVisible();
    // the master bus is silenced, so the chime plays into a zero-gain output
    const snap = await audioSnapshot(page);
    expect(snap.muted).toBe(true);
    expect(snap.masterTarget).toBe(0);
  });

  test('the reveal presents under reduced motion', async ({ page }) => {
    await openApp(page, { reducedMotion: true });
    await fly(page, 'moon', 10);
    await page.evaluate(() => (window as any).__driftlessStore.getState().dismissArrival());
    // degraded to a fade, but the moment still shows and is dismissible
    await expect(page.getByTestId('patch-reveal')).toBeVisible();
    // drain the queue, reading fresh state each iteration
    await page.evaluate(() => {
      const store = (window as any).__driftlessStore;
      while (store.getState().pendingReveals.length) store.getState().dismissReveal();
    });
    await expect(page.getByTestId('patch-reveal')).toHaveCount(0);
  });

  test('collection progress count is correct', async ({ page }) => {
    await openApp(page);
    await setState(page, { earnedPatches: { 'dest-moon': 1, 'hours-first': 1, 'dest-mars': 1 } });
    await page.getByRole('button', { name: 'Patches' }).click();

    await expect(page.getByRole('heading', { name: /3\s*\/\s*33 patches/ })).toBeVisible();
    // per-category count for destinations (2 of 13 earned above)
    await expect(page.getByText('2/13')).toBeVisible();
  });

  test('premium-flagged patches and board customisation respect the hasPremium() stub', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Patches' }).click();

    // free user: the premium tag shows and the board framing controls are locked
    await expect(page.getByText('PREMIUM')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Board', exact: true })).toBeDisabled();
    // an unearned seasonal (premium) patch is flagged PRO
    expect(await page.getByText('PRO').count()).toBeGreaterThan(0);

    // flip the stub on and reload: framing unlocks, the premium tag is gone
    await page.evaluate(() => localStorage.setItem('driftless-premium', '1'));
    await page.reload();
    await page.waitForFunction(() => !!(window as any).__driftlessStore);
    await page.getByRole('button', { name: 'Patches' }).click();
    await expect(page.getByRole('button', { name: 'Board', exact: true })).toBeEnabled();
    await expect(page.getByText('PREMIUM')).toHaveCount(0);
  });
});
