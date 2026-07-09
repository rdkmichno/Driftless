import { test, expect } from '@playwright/test';
import { openApp, openSettings, readSettings, toggleState } from './helpers';

const TOGGLES = [
  { label: 'Mute', key: 'muted' },
  { label: 'Reduce motion', key: 'reducedMotion' },
  { label: 'Skip launch ritual', key: 'skipRitual' },
  { label: 'Halfway ping', key: 'halfwayPing' },
] as const;

test.describe('settings toggles — the regression for the state-binding bug', () => {
  test('each knob position and aria-checked match the underlying state', async ({ page }) => {
    // seed a mixed state so on/off are both exercised
    await openApp(page, { muted: true, skipRitual: true, reducedMotion: false, halfwayPing: false });
    await openSettings(page);

    for (const { label, key } of TOGGLES) {
      const st = await toggleState(page, label);
      const settings = await readSettings(page);
      expect(st, label).not.toBeNull();
      // aria matches the store value
      expect(st!.ariaChecked, `${label} aria`).toBe(settings[key]);
      // knob position matches: on → right (offset large), off → left (offset small)
      if (settings[key]) expect(st!.knobOffset, `${label} on-offset`).toBeGreaterThan(16);
      else expect(st!.knobOffset, `${label} off-offset`).toBeLessThan(12);
    }
  });

  test('on renders visibly different from off, and nothing overflows the track', async ({ page }) => {
    await openApp(page, { muted: true, reducedMotion: false });
    await openSettings(page);
    const on = await toggleState(page, 'Mute'); // seeded on
    const off = await toggleState(page, 'Reduce motion'); // off
    expect(on!.knobOffset).toBeGreaterThan(off!.knobOffset + 8); // clearly distinct
    for (const { label } of TOGGLES) {
      const st = await toggleState(page, label);
      expect(st!.overflowRight, `${label} overflow`).toBeLessThanOrEqual(0);
    }
  });

  test('clicking one toggle flips its visual + stored value and leaves others unchanged', async ({ page }) => {
    await openApp(page); // all defaults off
    await openSettings(page);

    const before = await readSettings(page);
    expect(before.muted).toBe(false);

    await page.getByRole('switch', { name: 'Mute' }).click();

    const muteAfter = await toggleState(page, 'Mute');
    expect(muteAfter!.ariaChecked).toBe(true);
    expect(muteAfter!.knobOffset).toBeGreaterThan(16);
    expect((await readSettings(page)).muted).toBe(true);

    // the other three are untouched
    for (const { label, key } of TOGGLES.filter((t) => t.key !== 'muted')) {
      const st = await toggleState(page, label);
      expect(st!.ariaChecked, label).toBe(false);
      expect((await readSettings(page))[key], label).toBe(false);
    }
  });

  test('toggles are keyboard operable (focus + Space)', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    const halfway = page.getByRole('switch', { name: 'Halfway ping' });
    await halfway.focus();
    await expect(halfway).toBeFocused();
    await page.keyboard.press('Space');
    await expect(halfway).toHaveAttribute('aria-checked', 'true');
    expect((await readSettings(page)).halfwayPing).toBe(true);
  });
});

test.describe('settings persistence', () => {
  test('every setting applies immediately, persists across reload, and re-renders as current', async ({ page }) => {
    await openApp(page); // clean defaults
    await openSettings(page);

    // change each setting through the UI
    await page.getByRole('switch', { name: 'Mute' }).click();
    await page.getByRole('switch', { name: 'Reduce motion' }).click();
    await page.getByRole('switch', { name: 'Skip launch ritual' }).click();
    await page.getByRole('switch', { name: 'Halfway ping' }).click();
    await page.getByRole('radio', { name: /Cockpit/ }).click();
    // volume via the range input (native setter + input event)
    await page.locator('#volume').evaluate((el: HTMLInputElement) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(el, '0.6');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // applied immediately in the store
    const applied = await readSettings(page);
    expect(applied).toMatchObject({
      muted: true, reducedMotion: true, skipRitual: true, halfwayPing: true, ambience: 'cockpit',
    });
    expect(applied.volume).toBeCloseTo(0.6, 5);

    // reload → survives
    await page.reload();
    await page.waitForFunction(() => !!(window as unknown as { __driftlessStore?: unknown }).__driftlessStore);
    const persisted = await readSettings(page);
    expect(persisted).toMatchObject({
      muted: true, reducedMotion: true, skipRitual: true, halfwayPing: true, ambience: 'cockpit',
    });
    expect(persisted.volume).toBeCloseTo(0.6, 5);

    // reopening the panel shows current values, not defaults
    await openSettings(page);
    expect((await toggleState(page, 'Mute'))!.ariaChecked).toBe(true);
    expect((await toggleState(page, 'Skip launch ritual'))!.ariaChecked).toBe(true);
    await expect(page.getByText('60%')).toBeVisible();
    await expect(page.getByRole('radio', { name: /Cockpit/ })).toHaveAttribute('aria-checked', 'true');
  });
});
