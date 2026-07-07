import { describe, it, expect } from 'vitest';
import { createSession, remainingMs, progress, isExpired, elapsedMinutes, formatRemaining } from './session';

const T0 = 1_750_000_000_000;

describe('session engine', () => {
  const s = createSession('mars', 25, T0);

  it('computes remaining time from timestamps', () => {
    expect(remainingMs(s, T0)).toBe(25 * 60_000);
    expect(remainingMs(s, T0 + 60_000)).toBe(24 * 60_000);
    expect(remainingMs(s, T0 + 26 * 60_000)).toBe(0); // clamped, never negative
  });

  it('computes progress 0..1', () => {
    expect(progress(s, T0)).toBe(0);
    expect(progress(s, T0 + 12.5 * 60_000)).toBeCloseTo(0.5);
    expect(progress(s, T0 + 99 * 60_000)).toBe(1);
  });

  it('detects expiry (reload-after-end case)', () => {
    expect(isExpired(s, T0 + 24 * 60_000)).toBe(false);
    expect(isExpired(s, T0 + 25 * 60_000)).toBe(true);
  });

  it('reports elapsed minutes for aborts, capped at planned', () => {
    expect(elapsedMinutes(s, T0 + 10 * 60_000)).toBe(10);
    expect(elapsedMinutes(s, T0 + 999 * 60_000)).toBe(25);
  });

  it('formats remaining time', () => {
    expect(formatRemaining(24 * 60_000 + 59_000)).toBe('24:59');
    expect(formatRemaining(64 * 60_000 + 59_000)).toBe('1:04:59');
    expect(formatRemaining(0)).toBe('0:00');
  });
});
