import { describe, it, expect } from 'vitest';
import { clampCustomMinutes, CUSTOM_MIN, CUSTOM_MAX } from './customDuration';

describe('clampCustomMinutes', () => {
  it('passes valid values through, rounded to whole minutes', () => {
    expect(clampCustomMinutes(30)).toBe(30);
    expect(clampCustomMinutes(42.4)).toBe(42);
  });
  it('clamps to the 5–180 range', () => {
    expect(clampCustomMinutes(1)).toBe(CUSTOM_MIN);
    expect(clampCustomMinutes(999)).toBe(CUSTOM_MAX);
    expect(clampCustomMinutes(-30)).toBe(CUSTOM_MIN);
  });
  it('falls back to 25 on non-numeric input', () => {
    expect(clampCustomMinutes(Number('abc'))).toBe(25);
    expect(clampCustomMinutes(Infinity)).toBe(CUSTOM_MAX);
  });
});
