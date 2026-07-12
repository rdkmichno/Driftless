/**
 * Forward-compatible premium gate. Core earn-and-display is free; only the
 * seasonal/rare collection depth checks this. Single stubbed check so wiring
 * a real paywall later is a one-line change (today it reads a local flag,
 * which also lets tests exercise both sides of the gate).
 */
export function hasPremium(): boolean {
  try {
    return localStorage.getItem('driftless-premium') === '1';
  } catch {
    return false;
  }
}
