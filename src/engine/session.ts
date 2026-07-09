export type ActiveSession = {
  destinationId: string;
  startedAt: number;
  endAt: number;
  plannedMinutes: number;
  category?: string;
  classified?: boolean;
  test?: boolean;
};

export const ARRIVING_MS = 15_000;

export function createSession(
  destinationId: string,
  plannedMinutes: number,
  now: number,
  opts: { category?: string; classified?: boolean; test?: boolean; durationMs?: number } = {},
): ActiveSession {
  // durationMs (test mode) overrides the real duration for the *timer only*;
  // plannedMinutes is preserved for display/stats.
  const { durationMs, ...rest } = opts;
  return { destinationId, startedAt: now, endAt: now + (durationMs ?? plannedMinutes * 60_000), plannedMinutes, ...rest };
}

export function remainingMs(s: ActiveSession, now: number): number {
  return Math.max(0, s.endAt - now);
}

export function progress(s: ActiveSession, now: number): number {
  const total = s.endAt - s.startedAt;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (now - s.startedAt) / total));
}

export function isExpired(s: ActiveSession, now: number): boolean {
  return now >= s.endAt;
}

export function elapsedMinutes(s: ActiveSession, now: number): number {
  return Math.round((Math.min(now, s.endAt) - s.startedAt) / 60_000);
}

export function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
