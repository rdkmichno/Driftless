/**
 * Temporary test/dev mode: forces every journey to 10 seconds so the full loop
 * (ritual → takeoff → map → landing → arrival) can be exercised quickly.
 *
 * OFF by default. Enable with the `?test=1` query param or `VITE_TEST_MODE=true`.
 * It never touches the real destination-duration data, and completed test
 * sessions do not pollute the real mission log or lifetime stats (see the store).
 * Trivially removable: delete this file and its few call sites.
 */

export const TEST_MODE =
  import.meta.env.VITE_TEST_MODE === 'true' ||
  (typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1');

export const TEST_SESSION_MS = 10_000;

/** Effective session length in ms: the real duration, or 10s under test mode. */
export function sessionDurationMs(plannedMinutes: number): number {
  return TEST_MODE ? TEST_SESSION_MS : plannedMinutes * 60_000;
}
