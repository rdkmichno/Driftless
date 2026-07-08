export const CUSTOM_MIN = 5;
export const CUSTOM_MAX = 180;

/** Sanitize a user-entered custom duration in minutes. */
export function clampCustomMinutes(v: number): number {
  if (Number.isNaN(v)) return 25;
  return Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, Math.round(v)));
}
