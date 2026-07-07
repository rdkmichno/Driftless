# Driftless Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Driftless — a calm, premium deep-focus timer PWA where each session is a spacecraft journey to a solar-system destination.

**Architecture:** Single-page app driven by a mission phase machine (`idle → briefing → launching → transit → arriving → arrived`), with one persistent full-screen Canvas 2D starfield that eases its animation parameters between phases. Timestamp-based timer (never interval accumulation) with the active session persisted so reload/crash resumes mid-mission. All state local (Zustand + localStorage persist), fully procedural visuals and audio (no binary assets).

**Tech Stack:** Vite + React + TypeScript, Tailwind CSS v4 (`@theme` tokens), Zustand v5, `motion` (Framer Motion successor) for UI transitions, Web Audio API, vite-plugin-pwa, Vitest + jsdom, self-hosted fonts via Fontsource.

## Global Constraints

- Base background is `#0B1026` deep navy — **never pure black `#000`**.
- One warm amber accent family; **no purple→pink gradients, no neon-on-everything, no glassmorphism, no emoji as UI icons**.
- UI font: Space Grotesk (variable). Numeric readouts: JetBrains Mono. Self-hosted (offline PWA requirement).
- No popups/badges/notifications during transit. Abort copy is gentle, never shaming.
- Timer derives remaining time from `Date.now()` vs stored timestamps on every tick.
- All rAF animation pauses when `document.hidden`; honour `prefers-reduced-motion` and the settings toggle.
- Vite `base: '/Driftless/'` (GitHub Pages).
- No backend, no accounts, no external network calls at runtime.
- Commit at the end of every task.

---

### Task 1: Scaffold + design tokens + base styles

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json` (+ vite scaffold files), `index.html`, `src/main.tsx`, `src/App.tsx` (placeholder), `src/styles/index.css`, `.gitignore`

**Interfaces:**
- Produces: Tailwind token classes used by every later task: `bg-space-950/900/800/700`, `text-ink-100/300/500`, `text-accent-300/400`, `bg-accent-400`, `border-space-700`, `font-sans`, `font-mono`, plus fonts loaded globally.

- [ ] **Step 1: Scaffold Vite react-ts in place**

```powershell
npm create vite@latest . -- --template react-ts
npm install
npm install zustand motion @fontsource-variable/space-grotesk @fontsource/jetbrains-mono
npm install -D tailwindcss @tailwindcss/vite vitest jsdom vite-plugin-pwa
```

Delete scaffold noise: `src/App.css`, `src/assets/react.svg`, `public/vite.svg`, `src/index.css` (replaced by `src/styles/index.css`).

- [ ] **Step 2: Configure Vite**

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/Driftless/',
  plugins: [react(), tailwindcss()],
  test: { environment: 'jsdom' },
});
```

- [ ] **Step 3: Design tokens**

`src/styles/index.css`:

```css
@import 'tailwindcss';

@theme {
  --color-space-950: #070b1a;
  --color-space-900: #0b1026;
  --color-space-800: #141b3c;
  --color-space-700: #1e2750;
  --color-ink-100: #e9ebf4;
  --color-ink-300: #aab0c5;
  --color-ink-500: #6a7189;
  --color-accent-300: #f5ce82;
  --color-accent-400: #e8b45a;
  --color-accent-600: #8a6a35;
  --color-teal-mist: #3a5f6b;
  --color-rose-mist: #6b4a55;
  --font-sans: 'Space Grotesk Variable', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', monospace;
}

html, body, #root { height: 100%; }
body {
  background: var(--color-space-900);
  color: var(--color-ink-100);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
```

`src/main.tsx` imports: `'@fontsource-variable/space-grotesk'`, `'@fontsource/jetbrains-mono/400.css'`, `'@fontsource/jetbrains-mono/500.css'`, `'./styles/index.css'`.

`index.html`: `<html lang="en">`, `<title>Driftless</title>`, `<meta name="theme-color" content="#0b1026">`, `<meta name="description" content="A deep-focus timer. Pick a destination, launch, and stay on course.">`.

`src/App.tsx` placeholder: full-screen div `bg-space-900` with centered `<h1 class="font-sans text-2xl tracking-widest">DRIFTLESS</h1>` and a `font-mono text-accent-400` sample readout to prove both fonts + tokens render.

- [ ] **Step 4: Verify** — `npm run dev`, open browser: navy (not black) background, Space Grotesk heading, JetBrains Mono amber readout. `npm run build` succeeds.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: scaffold Vite+React+TS with Tailwind v4 design tokens"`

---

### Task 2: Destination data + duration mapping (TDD)

**Files:**
- Create: `src/data/destinations.ts`
- Test: `src/data/destinations.test.ts`

**Interfaces:**
- Produces:
  - `type Destination = { id: string; name: string; type: 'planet'|'moon'|'station'|'region'|'dwarf'; durationMinutes: number; distanceMkm: number; palette: { base: string; accent: string }; flavor: string; unlockAtTotalMinutes: number }`
  - `DESTINATIONS: Destination[]` (13 entries, ordered by distance)
  - `getDestination(id: string): Destination | undefined`
  - `unlockedIdsFor(totalMinutes: number): string[]`
  - `nearestUnlocked(minutes: number, totalFocusMinutes: number): Destination` (closest by `|durationMinutes − minutes|`, tie → nearer body)
  - `formatDistance(mkm: number): string` (`0.0004 → "400 km"`, `78 → "78 million km"`)

- [ ] **Step 1: Write failing tests** — `src/data/destinations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DESTINATIONS, getDestination, unlockedIdsFor, nearestUnlocked, formatDistance } from './destinations';

describe('destinations', () => {
  it('has 13 destinations with mars defaulting to 25 min', () => {
    expect(DESTINATIONS).toHaveLength(13);
    expect(getDestination('mars')?.durationMinutes).toBe(25);
  });
  it('unlocks iss/moon/venus/mars at zero minutes', () => {
    expect(unlockedIdsFor(0)).toEqual(['iss', 'moon', 'venus', 'mars']);
  });
  it('unlocks the belt at 30 lifetime minutes and jupiter at 120', () => {
    expect(unlockedIdsFor(30)).toContain('belt');
    expect(unlockedIdsFor(119)).not.toContain('jupiter');
    expect(unlockedIdsFor(120)).toContain('jupiter');
  });
  it('maps custom durations to the nearest unlocked destination', () => {
    expect(nearestUnlocked(40, 0).id).toBe('mars');       // jupiter locked at 0 min
    expect(nearestUnlocked(40, 10_000).id).toBe('jupiter'); // everything unlocked
    expect(nearestUnlocked(5, 0).id).toBe('iss');
    expect(nearestUnlocked(180, 10_000).id).toBe('kuiper');
  });
  it('formats distances', () => {
    expect(formatDistance(0.0004)).toBe('400 km');
    expect(formatDistance(78)).toBe('78 million km');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/data/destinations.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — `src/data/destinations.ts`:

```ts
export type DestinationType = 'planet' | 'moon' | 'station' | 'region' | 'dwarf';

export type Destination = {
  id: string;
  name: string;
  type: DestinationType;
  durationMinutes: number;
  distanceMkm: number; // millions of km — flavour/stats only
  palette: { base: string; accent: string };
  flavor: string;
  unlockAtTotalMinutes: number;
};

export const DESTINATIONS: Destination[] = [
  { id: 'iss',     name: 'Low Earth Orbit', type: 'station', durationMinutes: 5,   distanceMkm: 0.0004, palette: { base: '#8c97ad', accent: '#c9d2e0' }, flavor: 'A quick loop above the clouds. Back before the coffee cools.', unlockAtTotalMinutes: 0 },
  { id: 'moon',    name: 'The Moon',        type: 'moon',    durationMinutes: 10,  distanceMkm: 0.384,  palette: { base: '#9a9aa5', accent: '#cfcfd8' }, flavor: 'Silver seas of dust, and the Earth hanging quiet behind you.', unlockAtTotalMinutes: 0 },
  { id: 'venus',   name: 'Venus',           type: 'planet',  durationMinutes: 15,  distanceMkm: 41,     palette: { base: '#c9a876', accent: '#e8d5a8' }, flavor: 'The morning star, wrapped in slow golden storms.', unlockAtTotalMinutes: 0 },
  { id: 'mars',    name: 'Mars',            type: 'planet',  durationMinutes: 25,  distanceMkm: 78,     palette: { base: '#b5623b', accent: '#d98e62' }, flavor: 'Rust-red plains and the tallest mountain in the system.', unlockAtTotalMinutes: 0 },
  { id: 'belt',    name: 'The Asteroid Belt', type: 'region', durationMinutes: 30, distanceMkm: 330,    palette: { base: '#7a6e62', accent: '#a89a88' }, flavor: 'A slow drift through ancient rubble, older than any world.', unlockAtTotalMinutes: 30 },
  { id: 'jupiter', name: 'Jupiter',         type: 'planet',  durationMinutes: 45,  distanceMkm: 628,    palette: { base: '#c4956a', accent: '#e0b98a' }, flavor: 'A storm larger than Earth has raged here for centuries.', unlockAtTotalMinutes: 120 },
  { id: 'europa',  name: 'Europa',          type: 'moon',    durationMinutes: 50,  distanceMkm: 629,    palette: { base: '#b8c4ce', accent: '#dce6ee' }, flavor: 'Cracked ice over a hidden ocean. Something waits beneath.', unlockAtTotalMinutes: 180 },
  { id: 'saturn',  name: 'Saturn',          type: 'planet',  durationMinutes: 60,  distanceMkm: 1275,   palette: { base: '#d6b478', accent: '#eed9a6' }, flavor: 'The rings resolve slowly — a billion shards of drifting ice.', unlockAtTotalMinutes: 240 },
  { id: 'titan',   name: 'Titan',           type: 'moon',    durationMinutes: 75,  distanceMkm: 1276,   palette: { base: '#c29a4e', accent: '#e0be7e' }, flavor: 'Amber haze and methane rain on the only moon with weather.', unlockAtTotalMinutes: 360 },
  { id: 'uranus',  name: 'Uranus',          type: 'planet',  durationMinutes: 90,  distanceMkm: 2724,   palette: { base: '#7fb4bc', accent: '#a8d4da' }, flavor: 'A pale, sideways world, rolling through the dark.', unlockAtTotalMinutes: 480 },
  { id: 'neptune', name: 'Neptune',         type: 'planet',  durationMinutes: 105, distanceMkm: 4351,   palette: { base: '#4a6fa8', accent: '#7a9cd0' }, flavor: 'The last giant. Winds here outrun the speed of sound.', unlockAtTotalMinutes: 600 },
  { id: 'pluto',   name: 'Pluto',           type: 'dwarf',   durationMinutes: 120, distanceMkm: 5900,   palette: { base: '#a89a8e', accent: '#cbbfb2' }, flavor: 'A small heart of ice at the edge of the map.', unlockAtTotalMinutes: 720 },
  { id: 'kuiper',  name: 'The Kuiper Belt', type: 'region',  durationMinutes: 150, distanceMkm: 7500,   palette: { base: '#5a6478', accent: '#8a94a8' }, flavor: 'Past every chart. Just you, the hum, and the long dark.', unlockAtTotalMinutes: 900 },
];

export function getDestination(id: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}

export function unlockedIdsFor(totalMinutes: number): string[] {
  return DESTINATIONS.filter((d) => d.unlockAtTotalMinutes <= totalMinutes).map((d) => d.id);
}

export function nearestUnlocked(minutes: number, totalFocusMinutes: number): Destination {
  const unlocked = DESTINATIONS.filter((d) => d.unlockAtTotalMinutes <= totalFocusMinutes);
  return unlocked.reduce((best, d) =>
    Math.abs(d.durationMinutes - minutes) < Math.abs(best.durationMinutes - minutes) ? d : best,
  );
}

export function formatDistance(mkm: number): string {
  if (mkm < 1) return `${Math.round(mkm * 1_000_000).toLocaleString()} km`;
  return `${mkm.toLocaleString()} million km`;
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/data/destinations.test.ts` → PASS (5 tests).

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: destination data, unlock thresholds, custom-duration mapping"`

---

### Task 3: Session engine (TDD)

**Files:**
- Create: `src/engine/session.ts`
- Test: `src/engine/session.test.ts`

**Interfaces:**
- Produces:
  - `type ActiveSession = { destinationId: string; startedAt: number; endAt: number; plannedMinutes: number; category?: string; classified?: boolean }`
  - `ARRIVING_MS = 15_000`
  - `createSession(destinationId, plannedMinutes, now, opts?): ActiveSession`
  - `remainingMs(s, now): number` · `progress(s, now): number` (0–1) · `isExpired(s, now): boolean` · `elapsedMinutes(s, now): number`
  - `formatRemaining(ms: number): string` (`"24:59"`, `"1:04:59"` above an hour)

- [ ] **Step 1: Write failing tests** — `src/engine/session.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/engine/session.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `src/engine/session.ts`:

```ts
export type ActiveSession = {
  destinationId: string;
  startedAt: number;
  endAt: number;
  plannedMinutes: number;
  category?: string;
  classified?: boolean;
};

export const ARRIVING_MS = 15_000;

export function createSession(
  destinationId: string,
  plannedMinutes: number,
  now: number,
  opts: { category?: string; classified?: boolean } = {},
): ActiveSession {
  return { destinationId, startedAt: now, endAt: now + plannedMinutes * 60_000, plannedMinutes, ...opts };
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
```

- [ ] **Step 4: Run tests** — `npx vitest run src/engine/session.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: timestamp-based session engine"`

---

### Task 4: App store (TDD)

**Files:**
- Create: `src/state/store.ts`
- Test: `src/state/store.test.ts`

**Interfaces:**
- Consumes: `DESTINATIONS`, `getDestination`, `unlockedIdsFor` (Task 2); `createSession`, `elapsedMinutes` (Task 3).
- Produces (all via `useStore` — Zustand v5 with `persist`, storage key `driftless-v1`):
  - `type Phase = 'idle'|'briefing'|'launching'|'transit'|'arriving'|'arrived'`
  - `type AmbienceId = 'drift'|'cockpit'|'silence'`
  - `type Settings = { volume: number; muted: boolean; ambience: AmbienceId; reducedMotion: boolean; skipRitual: boolean; halfwayPing: boolean }`
  - `type MissionRecord = { id: string; destinationId: string; startedAt: number; endedAt: number; plannedMinutes: number; actualMinutes: number; completed: boolean; category?: string }`
  - `type PendingMission = { destinationId: string; plannedMinutes: number; classified?: boolean }`
  - `type ArrivalSummary = { destinationId: string; minutes: number; distanceMkm: number; newlyUnlockedIds: string[]; firstVisit: boolean }`
  - State: `phase`, `pending: PendingMission | null`, `activeSession: ActiveSession | null`, `arrival: ArrivalSummary | null`, `visitedIds: string[]`, `totalFocusMinutes: number`, `totalDistanceMkm: number`, `log: MissionRecord[]`, `settings: Settings`
  - Actions: `openBriefing(pending)`, `launch(now, category?)`, `beginTransit()`, `beginArriving()`, `completeMission(now)`, `dismissArrival()`, `abortMission(now)`, `cancelBriefing()`, `updateSettings(partial)`, `resume(now)`
  - `resume(now)`: no active session → no-op; active & expired → `completeMission(now)`; active & running → `phase = 'transit'`.
  - Persisted subset (partialize): `activeSession, visitedIds, totalFocusMinutes, totalDistanceMkm, log, settings`.

- [ ] **Step 1: Write failing tests** — `src/state/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';

const T0 = 1_750_000_000_000;
const initial = useStore.getState();

beforeEach(() => {
  localStorage.clear();
  useStore.setState({ ...initial, phase: 'idle', pending: null, activeSession: null, arrival: null, visitedIds: [], totalFocusMinutes: 0, totalDistanceMkm: 0, log: [] }, true);
});

describe('mission lifecycle', () => {
  it('briefing -> launch -> transit -> complete credits totals, visit, and log', () => {
    const s = useStore.getState();
    s.openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
    expect(useStore.getState().phase).toBe('briefing');
    useStore.getState().launch(T0);
    expect(useStore.getState().phase).toBe('launching');
    expect(useStore.getState().activeSession?.endAt).toBe(T0 + 10 * 60_000);
    useStore.getState().beginTransit();
    useStore.getState().completeMission(T0 + 10 * 60_000);
    const st = useStore.getState();
    expect(st.phase).toBe('arrived');
    expect(st.totalFocusMinutes).toBe(10);
    expect(st.visitedIds).toContain('moon');
    expect(st.activeSession).toBeNull();
    expect(st.log).toHaveLength(1);
    expect(st.log[0].completed).toBe(true);
    expect(st.arrival?.firstVisit).toBe(true);
  });

  it('reports newly unlocked destinations on completion', () => {
    useStore.setState({ totalFocusMinutes: 25 }); // belt unlocks at 30
    useStore.getState().openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
    useStore.getState().launch(T0);
    useStore.getState().completeMission(T0 + 10 * 60_000);
    expect(useStore.getState().arrival?.newlyUnlockedIds).toContain('belt');
  });

  it('abort logs an incomplete mission and credits nothing', () => {
    useStore.getState().openBriefing({ destinationId: 'mars', plannedMinutes: 25 });
    useStore.getState().launch(T0);
    useStore.getState().abortMission(T0 + 5 * 60_000);
    const st = useStore.getState();
    expect(st.phase).toBe('idle');
    expect(st.totalFocusMinutes).toBe(0);
    expect(st.log[0]).toMatchObject({ completed: false, actualMinutes: 5 });
    expect(st.visitedIds).toHaveLength(0);
  });

  it('resume: running session goes to transit, expired session completes', () => {
    useStore.getState().openBriefing({ destinationId: 'moon', plannedMinutes: 10 });
    useStore.getState().launch(T0);
    useStore.setState({ phase: 'idle' }); // simulate reload
    useStore.getState().resume(T0 + 60_000);
    expect(useStore.getState().phase).toBe('transit');
    useStore.getState().resume(T0 + 11 * 60_000);
    expect(useStore.getState().phase).toBe('arrived');
    expect(useStore.getState().totalFocusMinutes).toBe(10);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/state/store.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `src/state/store.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDestination, unlockedIdsFor } from '../data/destinations';
import { createSession, elapsedMinutes, isExpired, type ActiveSession } from '../engine/session';

export type Phase = 'idle' | 'briefing' | 'launching' | 'transit' | 'arriving' | 'arrived';
export type AmbienceId = 'drift' | 'cockpit' | 'silence';

export type Settings = {
  volume: number; muted: boolean; ambience: AmbienceId;
  reducedMotion: boolean; skipRitual: boolean; halfwayPing: boolean;
};

export type MissionRecord = {
  id: string; destinationId: string; startedAt: number; endedAt: number;
  plannedMinutes: number; actualMinutes: number; completed: boolean; category?: string;
};

export type PendingMission = { destinationId: string; plannedMinutes: number; classified?: boolean };

export type ArrivalSummary = {
  destinationId: string; minutes: number; distanceMkm: number;
  newlyUnlockedIds: string[]; firstVisit: boolean;
};

type AppState = {
  phase: Phase;
  pending: PendingMission | null;
  activeSession: ActiveSession | null;
  arrival: ArrivalSummary | null;
  visitedIds: string[];
  totalFocusMinutes: number;
  totalDistanceMkm: number;
  log: MissionRecord[];
  settings: Settings;
  openBriefing: (p: PendingMission) => void;
  cancelBriefing: () => void;
  launch: (now: number, category?: string) => void;
  beginTransit: () => void;
  beginArriving: () => void;
  completeMission: (now: number) => void;
  dismissArrival: () => void;
  abortMission: (now: number) => void;
  updateSettings: (p: Partial<Settings>) => void;
  resume: (now: number) => void;
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      phase: 'idle',
      pending: null,
      activeSession: null,
      arrival: null,
      visitedIds: [],
      totalFocusMinutes: 0,
      totalDistanceMkm: 0,
      log: [],
      settings: { volume: 0.5, muted: false, ambience: 'drift', reducedMotion: false, skipRitual: false, halfwayPing: false },

      openBriefing: (pending) => set({ pending, phase: 'briefing' }),
      cancelBriefing: () => set({ pending: null, phase: 'idle' }),

      launch: (now, category) => {
        const { pending } = get();
        if (!pending) return;
        const session = createSession(pending.destinationId, pending.plannedMinutes, now, {
          category, classified: pending.classified,
        });
        set({ activeSession: session, pending: null, phase: 'launching' });
      },

      beginTransit: () => set({ phase: 'transit' }),
      beginArriving: () => set({ phase: 'arriving' }),

      completeMission: (now) => {
        const { activeSession: s, totalFocusMinutes, totalDistanceMkm, visitedIds, log } = get();
        if (!s) return;
        const dest = getDestination(s.destinationId);
        if (!dest) return;
        const before = unlockedIdsFor(totalFocusMinutes);
        const newTotal = totalFocusMinutes + s.plannedMinutes;
        const newlyUnlockedIds = unlockedIdsFor(newTotal).filter((id) => !before.includes(id));
        const firstVisit = !visitedIds.includes(dest.id);
        set({
          phase: 'arrived',
          activeSession: null,
          totalFocusMinutes: newTotal,
          totalDistanceMkm: totalDistanceMkm + dest.distanceMkm,
          visitedIds: firstVisit ? [...visitedIds, dest.id] : visitedIds,
          arrival: { destinationId: dest.id, minutes: s.plannedMinutes, distanceMkm: dest.distanceMkm, newlyUnlockedIds, firstVisit },
          log: [...log, {
            id: crypto.randomUUID(), destinationId: dest.id,
            startedAt: s.startedAt, endedAt: now,
            plannedMinutes: s.plannedMinutes, actualMinutes: s.plannedMinutes,
            completed: true, category: s.category,
          }],
        });
      },

      dismissArrival: () => set({ arrival: null, phase: 'idle' }),

      abortMission: (now) => {
        const { activeSession: s, log } = get();
        if (!s) return;
        set({
          phase: 'idle',
          activeSession: null,
          log: [...log, {
            id: crypto.randomUUID(), destinationId: s.destinationId,
            startedAt: s.startedAt, endedAt: now,
            plannedMinutes: s.plannedMinutes, actualMinutes: elapsedMinutes(s, now),
            completed: false, category: s.category,
          }],
        });
      },

      updateSettings: (p) => set((st) => ({ settings: { ...st.settings, ...p } })),

      resume: (now) => {
        const { activeSession: s } = get();
        if (!s) return;
        if (isExpired(s, now)) get().completeMission(now);
        else set({ phase: 'transit' });
      },
    }),
    {
      name: 'driftless-v1',
      partialize: (st) => ({
        activeSession: st.activeSession, visitedIds: st.visitedIds,
        totalFocusMinutes: st.totalFocusMinutes, totalDistanceMkm: st.totalDistanceMkm,
        log: st.log, settings: st.settings,
      }),
    },
  ),
);
```

- [ ] **Step 4: Run all tests** — `npx vitest run` → PASS (all suites).

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: zustand store with mission lifecycle, progression, persistence"`

---

### Task 5: Starfield engine + persistent scene canvas

**Files:**
- Create: `src/canvas/starfield.ts`, `src/canvas/SceneCanvas.tsx`
- Modify: `src/App.tsx` (mount SceneCanvas behind UI)

**Interfaces:**
- Consumes: `useStore` phase + settings.
- Produces:
  - `class Starfield { constructor(seedW: number, seedH: number); resize(w, h): void; setSpeedTarget(mult: number): void; setPointer(nx: number, ny: number): void; step(dt: number): void; draw(ctx: CanvasRenderingContext2D): void }` — `draw` paints background gradient + nebula tints + all star layers. Speed eases toward target internally (`speed += (target − speed) * min(1, dt * 1.5)`).
  - `SceneCanvas` React component: full-screen fixed canvas (`aria-hidden`), DPR-aware, rAF loop that pauses on `document.hidden`, static single render when reduced motion is on, phase→speed mapping: idle/briefing `0.6`, launching `7`, transit `1`, arriving `0.3`, arrived `0.15`.
  - `SceneCanvas` also exposes a module-level mutable `sceneState = { planetProgress: 0, destinationId: null as string | null }` imported and set by App (Task 8+) — canvas reads it each frame (planet drawing lands in Task 6).

**Starfield implementation requirements (complete behavior spec):**
- 3 layers: `[{ density 90, depth 0.25, size 0.5–1.1, alpha 0.2–0.45 }, { density 50, depth 0.55, size 0.8–1.5, alpha 0.35–0.65 }, { density 22, depth 1.0, size 1.2–2.2, alpha 0.55–0.9 }]` — density is per 1,000,000 px², capped at 3× base, floor 12 stars/layer.
- Motion: radial outward from vanishing point `(0.5w, 0.42h)`; velocity = `dirFromCenter * (10 + 24 * distFrac) * depth * speed` px/s. Stars leaving bounds respawn at a random angle 20–120 px from center with fresh size/alpha.
- Twinkle: per-star phase/speed; drawn alpha = `alpha * (0.82 + 0.18 * sin(t * twinkleSpeed + phase))`. Skip twinkle when reduced motion.
- Shooting star: Poisson-ish — chance `dt / 90` per frame; 0.7 s life; a 90–160 px streak with linear-gradient fade, alpha peaks mid-life. Never during reduced motion.
- Pointer parallax: layers offset by `(pointer.nx * 14, pointer.ny * 10) * depth`, pointer value eased at `dt * 3`.
- Background per frame: vertical linear gradient `#070b1a → #0b1026 → #0d1230`; then two large radial tints at ~4% alpha: teal-mist centered (0.22w, 0.30h) radius 0.7w; rose-mist centered (0.80w, 0.72h) radius 0.6w.

**SceneCanvas skeleton:**

```tsx
import { useEffect, useRef } from 'react';
import { Starfield } from './starfield';
import { useStore, type Phase } from '../state/store';

export const sceneState = { planetProgress: 0, destinationId: null as string | null };

const PHASE_SPEED: Record<Phase, number> = {
  idle: 0.6, briefing: 0.6, launching: 7, transit: 1, arriving: 0.3, arrived: 0.15,
};

export function SceneCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const field = new Starfield(innerWidth, innerHeight);
    let raf = 0; let last = performance.now(); let running = true;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      field.resize(innerWidth, innerHeight);
    };
    resize();
    addEventListener('resize', resize);

    const onPointer = (e: PointerEvent) =>
      field.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    addEventListener('pointermove', onPointer);

    const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)');
    const isReduced = () => prefersReduced.matches || useStore.getState().settings.reducedMotion;

    const frame = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      field.setSpeedTarget(PHASE_SPEED[useStore.getState().phase]);
      if (!isReduced()) field.step(dt);
      field.draw(ctx);
      // planet layer drawn here from Task 6 on, using sceneState
      raf = requestAnimationFrame(frame);
    };

    const start = () => { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(frame);

    return () => { stop(); removeEventListener('resize', resize); removeEventListener('pointermove', onPointer); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="fixed inset-0" />;
}
```

(Reduced motion still calls `field.draw` — a static field — but skips `step`, so nothing moves; this is the required fallback, and battery-free.)

- [ ] **Step 1:** Implement `starfield.ts` per the behavior spec above (plain TS class, no React imports).
- [ ] **Step 2:** Implement `SceneCanvas.tsx`; mount in `App.tsx` behind a temporary heading.
- [ ] **Step 3: Verify in browser** — slow radial drift, layered parallax on mouse move, occasional twinkle, background navy gradient with faint tints (not black, no banding). Toggle OS reduced motion → static field. Hide tab 10 s, return → no jump, animation resumes.
- [ ] **Step 4: Commit** — `git add -A; git commit -m "feat: parallax starfield with phase-driven speed and reduced-motion fallback"`

---

### Task 6: Procedural planet renderer

**Files:**
- Create: `src/canvas/planets.ts`
- Modify: `src/canvas/SceneCanvas.tsx` (draw destination each frame from `sceneState`)

**Interfaces:**
- Consumes: `Destination` (Task 2), `sceneState` (Task 5).
- Produces: `drawDestination(ctx, dest: Destination, x: number, y: number, r: number, t: number): void`

**Rendering spec (all procedural, no assets):**
- **Sphere (default, all planets/moons/dwarf):** radial gradient with light source upper-left: inner stop = `palette.accent`, mid = `palette.base`, outer = base darkened 55% (helper `shade(hex, factor)`); then an atmosphere halo: radial gradient from `r` to `1.16r`, `palette.accent` at 16% alpha fading to 0; then a rim highlight arc on the lit limb at 12% white alpha.
- **Jupiter/Titan/Venus (banded):** sphere + 4–6 horizontal bands inside a circular clip — alternating `shade(base, 0.9)` / `shade(accent, 0.85)` rounded stripes at 25% alpha, slight vertical curvature (bands are wide flat ellipses).
- **Saturn:** rings first behind (ellipse stroke set, rx `2.1r`, ry `0.55r`, 3 concentric strokes in `accent` at 35/22/14% alpha, rotated −12°), then sphere, then re-draw the front half of rings clipped to below the equator.
- **Regions (belt, kuiper):** no sphere — a loose horizontal band of 40 small rocks (irregular gray-brown circles, r 1–4, seeded positions from dest.id so it's stable frame to frame) spanning `3r` wide, denser near center; kuiper uses bluer `palette`, sparser, with faint white ice glints.
- **Station (iss):** small geometric silhouette — central cylinder (rounded rect `1.6r × 0.5r`) + two solar panel pairs (thin rects `1.2r × 0.35r` each side, `#26314f` fill with `accent` 30% alpha grid lines) + one blinking nav light (accent dot, alpha `0.5 + 0.5 sin(t*2)`).
- Growth curve in SceneCanvas: planet radius `= lerp(2, min(w,h) * 0.34, easeInCubic(planetProgress))`, drawn at `(0.5w, 0.40h)`; fade in over progress 0→0.06. During `arriving`/`arrived` phases, scale multiplies up to `min(w,h) * 0.46` with an eased approach.

- [ ] **Step 1:** Implement `planets.ts` with `drawDestination` + `shade` helper + seeded PRNG (mulberry32 from string hash) for regions.
- [ ] **Step 2:** Wire into SceneCanvas frame loop: if `sceneState.destinationId`, look up destination, compute radius from `sceneState.planetProgress`, call `drawDestination`.
- [ ] **Step 3: Verify** — temporarily set `sceneState = { planetProgress: 0.9, destinationId: 'saturn' }` in App; check Saturn's rings, then `'jupiter'` (bands), `'belt'` (rock field), `'iss'` (station). Remove temp code.
- [ ] **Step 4: Commit** — `git add -A; git commit -m "feat: procedural planet/station/region renderer"`

---

### Task 7: UI primitives + ship

**Files:**
- Create: `src/components/ui.tsx`, `src/components/Ship.tsx`

**Interfaces:**
- Produces:
  - `Button({ variant?: 'primary'|'ghost'|'quiet', ...buttonProps })` — primary: `bg-accent-400 text-space-950 hover:bg-accent-300` rounded, med padding; ghost: `border border-space-700 text-ink-300 hover:text-ink-100 hover:border-ink-500`; quiet: `text-ink-500 hover:text-ink-300 text-sm` (no border — used for abort).
  - `Panel({ children, className? })` — `bg-space-950/80 border border-space-700 rounded-2xl p-6 backdrop-blur-none shadow-xl` (solid dark panel — deliberately NOT glassmorphism).
  - `Label({ children })` — `text-xs uppercase tracking-[0.2em] text-ink-500`.
  - `Ship({ className?, thrusting?: boolean })` — inline SVG, ~120×48 viewBox: clean elongated hull silhouette (`#aab0c5` body with `#e9ebf4` canopy line), engine glow = radial-gradient ellipse in accent, larger/brighter when `thrusting`. Wrapped in a div with CSS animation `drift 7s ease-in-out infinite alternate` (translateY ±6px, rotate ±0.8°); animation disabled under reduced motion via `motion-reduce:animate-none`.
- Add to `index.css`: `@keyframes drift { from { transform: translateY(-6px) rotate(-0.8deg); } to { transform: translateY(6px) rotate(0.8deg); } }` and `--animate-drift: drift 7s ease-in-out infinite alternate;` inside `@theme`.

- [ ] **Step 1:** Implement both files.
- [ ] **Step 2: Verify** — render a sample row of buttons, a Panel, and the Ship in App temporarily; check hover states, ship bob, engine glow. Remove sample.
- [ ] **Step 3: Commit** — `git add -A; git commit -m "feat: UI primitives and ship silhouette"`

---

### Task 8: Home view (mission select)

**Files:**
- Create: `src/components/HomeView.tsx`, `src/lib/format.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: store (`totalFocusMinutes`, `totalDistanceMkm`, `visitedIds`, `openBriefing`), `DESTINATIONS`, `unlockedIdsFor`, `nearestUnlocked`, `formatDistance`, UI primitives.
- Produces: `HomeView({ onNavigate: (view: 'map'|'log'|'settings') => void })`. `format.ts`: `formatMinutes(min: number): string` (`45 → "45 min"`, `90 → "1 h 30 min"`), `formatHours(min: number): string` (`"12.5 h"`).

**Layout spec:**
- Top: wordmark `DRIFTLESS` (tracking-widest, text-sm, ink-500) + one-line lifetime stats in mono (`{formatHours(total)} focused · {formatDistance(dist)} travelled`) — hidden if total is 0.
- Middle: scrollable destination list (single column, max-w-md centered). Each unlocked row (button): name (ink-100), type + duration (`Planet · 25 min`, ink-500 text-xs), distance in mono (ink-300 text-xs right-aligned), a small filled accent dot if visited (with `title="Visited"` and sr-only text). Locked row (non-interactive, 40% opacity): name + `Unlocks after {formatHours(unlockAt)} of focus` in text-xs.
- Below list: **Custom transit** — a `<input type="range" min=5 max=180 step=5>` + mono readout + "Plot custom transit" ghost button → `openBriefing({ destinationId: nearestUnlocked(v, total).id, plannedMinutes: v })`. **Random** — "Random destination" ghost button → picks a random unlocked destination, `openBriefing({ destinationId, plannedMinutes: dest.durationMinutes, classified: true })`.
- Bottom nav: three quiet text buttons — `Star map · Mission log · Settings` → `onNavigate`.
- Wrap view in `motion.div` fade (`initial opacity 0 → 1`, 0.4 s).

- [ ] **Step 1:** Implement `format.ts` + `HomeView.tsx`; in App render HomeView when `phase === 'idle'` (nav views arrive in Task 12 — for now `onNavigate` can no-op).
- [ ] **Step 2: Verify** — 4 unlocked rows + 9 locked rows with thresholds; slider maps 40 min → Mars label shown on briefing (next task shows it); keyboard-tab reaches every interactive element.
- [ ] **Step 3: Commit** — `git add -A; git commit -m "feat: home mission-select view with custom and random transits"`

---

### Task 9: Briefing card + launch sequence

**Files:**
- Create: `src/components/BriefingCard.tsx`, `src/components/LaunchSequence.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: store (`pending`, `launch`, `cancelBriefing`, `beginTransit`, `settings.skipRitual`), Task 7 primitives, `formatDistance`, `formatMinutes`.
- Produces: `BriefingCard()` (rendered at `phase === 'briefing'`), `LaunchSequence()` (rendered at `phase === 'launching'`).

**BriefingCard spec:** centered Panel (max-w-sm), content: `Label` "Mission briefing"; destination name text-2xl (or `Classified destination` + "Coordinates sealed until arrival." when `pending.classified`); rows in mono text-sm — `Travel time {formatMinutes(plannedMinutes)}`, `Distance {formatDistance(dest.distanceMkm)}` (distance hidden when classified); flavor text (ink-300 italic, hidden when classified); category chips (`Study / Work / Reading / Deep Work` — single-select toggle buttons, optional, stored in local state); actions: primary `Confirm launch` → `launch(Date.now(), category)`, quiet `Stand down` → `cancelBriefing()`. Panel enters with motion scale 0.96→1 + fade.
**Skip-ritual behavior (in App, not the card):** when `phase === 'briefing'` and `settings.skipRitual`, immediately `launch(Date.now())` in an effect (no countdown either — launching phase duration 0.6 s instead of full count).
**LaunchSequence spec:** full-screen centered overlay: mono digits `3`, `2`, `1` each 0.9 s (motion scale/fade per digit, key on digit), then `Ignition` 0.7 s, then call `beginTransit()`. Ship visible below digits with `thrusting`. Under `skipRitual` or reduced motion: show single `Ignition` frame 0.6 s → `beginTransit()`. Drive with `setTimeout` chain in an effect (cleanup on unmount).

- [ ] **Step 1:** Implement both components; wire phases in App.
- [ ] **Step 2: Verify** — select Moon → briefing shows 10 min / 384,000 km / flavor; confirm → 3-2-1 → starfield accelerates (Task 5 speed map) → transit phase reached. `Stand down` returns home. Random mission shows classified briefing.
- [ ] **Step 3: Commit** — `git add -A; git commit -m "feat: mission briefing and launch countdown ritual"`

---

### Task 10: Transit HUD + ticker + abort

**Files:**
- Create: `src/components/TransitHUD.tsx`, `src/engine/useTicker.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: store, session helpers (`remainingMs`, `progress`, `formatRemaining`, `ARRIVING_MS`), `sceneState` (Task 5).
- Produces:
  - `useTicker(intervalMs = 500): number` — hook returning `now`, updated by `setInterval`; interval switches to 5000 ms while `document.hidden` (listener on `visibilitychange`). Display correctness never depends on tick cadence (timestamps).
  - `TransitHUD()` rendered at `phase === 'transit' || phase === 'arriving'`.
  - **App-level mission driver effect** (this task): on each tick while transit/arriving — update `sceneState.planetProgress` and `sceneState.destinationId` (empty/0 when idle); if `phase === 'transit'` and `remaining <= ARRIVING_MS` → `beginArriving()`; if `remaining <= 0` → `completeMission(Date.now())`.

**TransitHUD spec:**
- Bottom-center column, pointer-events-none except controls: destination name (or `Classified`) as `Label`; time remaining in mono text-3xl — wrapped in a div at `opacity-40 hover:opacity-90 focus-within:opacity-90 transition-opacity duration-700`; a 200 px, 2 px-tall progress track (`bg-space-700`) with accent fill at `progress * 100%` (`role="progressbar"` with `aria-valuenow`).
- Top-right: quiet `Abort mission` button. Clicking swaps it (local state) for a small inline Panel: "End this mission early? This journey won't be logged as complete." + ghost `Stay on course` / quiet `Abort` → `abortMission(Date.now())`. No shame copy.
- Whole HUD fades in 1.2 s after transit begins.

- [ ] **Step 1:** Implement `useTicker`, `TransitHUD`, and the App mission-driver effect.
- [ ] **Step 2: Verify with a dev-short session** — add DEV-only query override in App: `const devMin = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('t')) || null : null;` — when set, App passes `plannedMinutes: devMin` into `openBriefing` calls (thread via HomeView prop `durationOverride`). Open `http://localhost:5173/Driftless/?t=0.5` → Moon → full loop in 30 s: HUD dims, hover reveals timer, progress fills, planet grows, at T−15 s phase flips to arriving (starfield decelerates, planet swells). Abort path: confirm dialog, land on home, nothing credited.
- [ ] **Step 3: Reload resilience check** — mid-transit, hard-reload the tab → returns to transit with correct remaining (resume logic lands fully in Task 11's App wiring if not already; ensure `useStore.getState().resume(Date.now())` runs once on App mount **in this task**).
- [ ] **Step 4: Commit** — `git add -A; git commit -m "feat: transit HUD, mission driver, abort flow, session resume"`

---

### Task 11: Arrival card

**Files:**
- Create: `src/components/ArrivalCard.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: store (`arrival`, `dismissArrival`, `totalFocusMinutes`, `totalDistanceMkm`), `getDestination`, `formatDistance`, `formatMinutes`, `formatHours`.
- Produces: `ArrivalCard()` rendered at `phase === 'arrived'`.

**Spec:** centered Panel (max-w-sm) over the now-huge planet, `role="status" aria-live="polite"`, motion fade+rise (0.8 s, delay 0.6 s so the planet lands first): `Label` "Mission complete"; `Arrived at {name}` text-2xl; flavor line (ink-300); stat rows in mono text-sm — `{formatMinutes(minutes)} focused`, `{formatDistance(distanceMkm)} travelled`, `Lifetime · {formatHours(totalFocusMinutes)} · {formatDistance(totalDistanceMkm)}`; if `firstVisit`: accent text-xs `New world charted`; if `newlyUnlockedIds.length`: accent text-xs `New route unlocked: {names}`; primary button `Return to base` → `dismissArrival()`.

- [ ] **Step 1:** Implement + wire.
- [ ] **Step 2: Verify** — `?t=0.2` Moon run: planet fills view, card rises, stats correct, `New world charted` on first landing; second run omits it. Complete enough short runs to cross 30 lifetime minutes is impractical — instead temporarily set `totalFocusMinutes: 29` via devtools `localStorage` edit and complete a run → `New route unlocked: The Asteroid Belt` appears; home now shows belt unlocked.
- [ ] **Step 3: Full-suite check** — `npx vitest run` → PASS.
- [ ] **Step 4: Commit** — `git add -A; git commit -m "feat: arrival card with stats, first-visit and unlock announcements"`

---

### Task 12: Star map + mission log views

**Files:**
- Create: `src/components/StarMap.tsx`, `src/components/MissionLogView.tsx`
- Modify: `src/App.tsx`, `src/components/HomeView.tsx` (wire `onNavigate`)

**Interfaces:**
- Consumes: store (`visitedIds`, `totalFocusMinutes`, `log`), `DESTINATIONS`, `getDestination`, formatters.
- Produces: `StarMap({ onBack: () => void })`, `MissionLogView({ onBack: () => void })`. App holds `homeView: 'home'|'map'|'log'|'settings'` local state, rendered only during `phase === 'idle'`.

**StarMap spec:** full-width SVG (viewBox `0 0 1000 220`), destinations positioned along x by `80 + 840 * log10(1 + distanceMkm) / log10(1 + 7500)`, y alternating 90/130 to avoid label collisions; a faint horizontal trajectory line (space-700); sun glyph at x=30 (accent, blurred circle). Visited: filled circle r=5 in the body's `palette.accent` with a soft glow (same fill at 25% alpha, r=10) + name label (text-xs ink-300). Unlocked-unvisited: stroked circle, ink-500, label ink-500. Locked: 2 px dot, space-700, no label. `<title>` per node for hover/AT. Back button (ghost) top-left.
**MissionLogView spec:** max-w-md centered scrollable list, newest first: each row — destination name (or `—` if unknown id), date (`new Date(startedAt).toLocaleDateString(undefined, { month:'short', day:'numeric' })` + time), mono minutes; completed rows normal; aborted rows ink-500 with text `cut short at {actualMinutes} min` (neutral tone, no red). Empty state: "No missions yet. The system is waiting." Back button.

- [ ] **Step 1:** Implement both views + App/HomeView navigation wiring.
- [ ] **Step 2: Verify** — map shows Moon visited/glowing after earlier runs, near bodies unlocked-outline, far bodies dim; log lists completed + aborted runs neutrally; back buttons and keyboard nav work.
- [ ] **Step 3: Commit** — `git add -A; git commit -m "feat: star map and mission log views"`

---

### Task 13: Audio engine

**Files:**
- Create: `src/audio/engine.ts`, `src/audio/useAudio.ts`
- Modify: `src/App.tsx` (call `useAudio()`)

**Interfaces:**
- Consumes: store settings + phase.
- Produces:
  - `class AudioEngine { unlock(): void; setVolume(v: number): void; setMuted(m: boolean): void; setAmbience(id: 'drift'|'cockpit'|'silence'): void; startBed(): void; stopBed(): void; cueLaunch(): void; cueArrival(): void; cueHalfway(): void }` — singleton export `audio`.
  - `useAudio(): void` hook — wires everything; called once in App.

**Engine spec (all Web Audio, no files):**
- `unlock()` lazily creates `AudioContext` + master `GainNode` (gain = `muted ? 0 : volume²`, ramped with `setTargetAtTime` τ=0.1); safe to call repeatedly; resumes suspended context.
- **Base hum (always part of bed):** 4 s loop `AudioBuffer` of brown noise (`last = (last + 0.02 * white) / 1.02`, output `last * 3.5`) → lowpass 200 Hz → gain 0.10; plus sine 55 Hz gain 0.035 and sine 55.4 Hz gain 0.03 (slow beat).
- **Ambiences (exclusive, layered over hum):**
  - `drift`: three detuned triangle oscs (110, 164.8, 220.5 Hz) → shared lowpass whose frequency is LFO-modulated (0.05 Hz sine, 300–900 Hz) → gain 0.05; plus a feedback delay (0.9 s, feedback 0.45, wet 0.4) for space.
  - `cockpit`: sawtooth 50 Hz → lowpass 120 Hz → gain 0.04 (machinery); plus a JS `setInterval`-scheduled soft blip every 8–20 s (random): sine 620–900 Hz through bandpass, 60 ms, peak gain 0.02.
  - `silence`: only a scheduled distant tone every 35–70 s: sine 330 Hz, 2.5 s swell attack/release, peak gain 0.015.
- **Cues:** launch — sine sweep 180→320 Hz over 1.8 s, gain envelope 0→0.12→0; arrival — three triangle oscs (F3 174.6, A3 220, C4 261.6), 0.4 s stagger, slow 0.3 s attacks, 3 s releases, peak 0.09 each; halfway — single sine ping C5 523 Hz, 50 ms attack / 1.2 s release, peak 0.04. All through master gain — volume/mute always applies.
- **`useAudio` hook:** one-time `pointerdown`/`keydown` listener on window → `audio.unlock()`; store subscriptions: volume/muted → setters; ambience → `setAmbience`; phase transitions (compare prev via ref): `→ launching` = `startBed()` + `cueLaunch()`; `→ arriving` = `cueArrival()`; `→ idle` (from mission phases) = `stopBed()` (gain ramp down 1 s then stop nodes). Halfway ping: in the Task 10 mission driver, when `settings.halfwayPing` and progress crosses 0.5 (prev < 0.5 ≤ curr) → `audio.cueHalfway()`.

- [ ] **Step 1:** Implement engine + hook, wire halfway ping into the mission driver.
- [ ] **Step 2: Verify by ear** (`?t=1`, volume up): gentle hum after first click, launch sweep on ignition, chosen ambience audible but unobtrusive, warm chord at arrival, silence after returning home. Toggle mute mid-transit → immediate silence; unmute → returns at set volume. Switch all three ambiences.
- [ ] **Step 3: Commit** — `git add -A; git commit -m "feat: procedural web-audio engine with ambiences and milestone cues"`

---

### Task 14: Settings view

**Files:**
- Create: `src/components/SettingsView.tsx`
- Modify: `src/App.tsx` (route `homeView === 'settings'`)

**Interfaces:**
- Consumes: store (`settings`, `updateSettings`), UI primitives, `audio` (test-blip on volume release optional — skip; keep YAGNI).
- Produces: `SettingsView({ onBack: () => void })`.

**Spec:** max-w-sm centered Panel list. Controls (each a labelled row, `<label>` associated):
- Volume: `<input type="range" min=0 max=1 step=0.05>` + mono % readout.
- Mute: toggle button (`aria-pressed`).
- Ambience: 3 radio buttons — `Cosmic Drift / Cockpit / Deep Silence`.
- Reduce motion: toggle (`aria-pressed`) — note under it: "Also follows your system preference."
- Skip launch ritual: toggle.
- Halfway ping: toggle.
All write `updateSettings` immediately (persisted by store). Back button.

- [ ] **Step 1:** Implement + wire.
- [ ] **Step 2: Verify** — every control changes behavior live (volume audible, reduce-motion freezes field, skip-ritual launches instantly next mission); settings survive reload.
- [ ] **Step 3: Commit** — `git add -A; git commit -m "feat: settings view"`

---

### Task 15: PWA + icons

**Files:**
- Create: `scripts/make-icons.mjs`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `public/favicon.svg`
- Modify: `vite.config.ts`, `index.html`, `package.json` (icons script)

**Interfaces:**
- Consumes: nothing new. Produces: installable offline PWA.

- [ ] **Step 1: Icon generation** — `favicon.svg`: 64×64 — space-900 rounded square, one accent circle (planet) with a thin elliptical orbit line and a 2 px ship dot on the orbit. `scripts/make-icons.mjs`: `npm i -D sharp`, render the same SVG (inline string, sized variants; maskable = same art at 70% scale centered on full-bleed `#0b1026`) to the three PNGs via sharp. Run once: `node scripts/make-icons.mjs`; commit the PNGs.
- [ ] **Step 2: vite-plugin-pwa** — add to `vite.config.ts` plugins:

```ts
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg'],
  manifest: {
    name: 'Driftless', short_name: 'Driftless',
    description: 'A deep-focus timer. Pick a destination, launch, and stay on course.',
    theme_color: '#0b1026', background_color: '#0b1026',
    display: 'standalone', start_url: '/Driftless/', scope: '/Driftless/',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
})
```

Add `<link rel="icon" href="/Driftless/favicon.svg">` to `index.html`.

- [ ] **Step 3: Verify** — `npm run build; npm run preview` → DevTools Application tab: manifest valid, SW active; set Network→Offline, reload → app loads and a full (short) mission works offline.
- [ ] **Step 4: Commit** — `git add -A; git commit -m "feat: installable offline PWA with generated icons"`

---

### Task 16: Accessibility + polish pass

**Files:**
- Modify: components as found; `src/styles/index.css`

**Checklist (fix anything failing):**
- [ ] Keyboard-only walkthrough of the entire loop (home → briefing → launch → transit → abort/arrive → views). Focus visible everywhere: add global `:focus-visible { outline: 2px solid var(--color-accent-400); outline-offset: 2px; }`.
- [ ] Focus management: when briefing opens, focus the panel (`tabIndex={-1}` + `ref.focus()`); same for abort confirm and arrival card.
- [ ] Contrast: ink-300 on space-900 ≥ 4.5:1 (it is, ~7:1); verify accent-400 on space-950 for primary buttons (~8:1 as dark text on amber).
- [ ] `aria-hidden` canvas, `role="progressbar"` values update, arrival `aria-live` announces.
- [ ] Reduced motion: OS setting AND toggle both freeze starfield, disable ship bob, collapse countdown, and swap motion transitions to fades ≤ 0.2 s (pass a `reduced` flag to motion `transition` props).
- [ ] Mobile (responsive-mode spot check at 390×844): home list scrolls, HUD not clipped by safe areas (`padding: env(safe-area-inset-*)` on HUD container), tap targets ≥ 40 px.
- [ ] `npx vitest run` and `npm run build` green.
- [ ] Commit — `git add -A; git commit -m "polish: accessibility, focus management, mobile safe areas"`

---

### Task 17: Deploy to GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1: Workflow** — `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push: { branches: [master] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx vitest run
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README** — short: what it is, screenshot placeholder-free description, `npm install / npm run dev`, live URL.
- [ ] **Step 3: Create repo + push** — `gh repo create Driftless --public --source . --push`; enable Pages via `gh api repos/{owner}/Driftless/pages -X POST -f build_type=workflow` (or note for user to enable in settings if API call fails).
- [ ] **Step 4: Verify** — workflow green; visit `https://<user>.github.io/Driftless/`; run a 5-min ISS mission on the live site; install prompt available.
- [ ] **Step 5: Commit & push any fixes** — `git add -A; git commit -m "feat: GitHub Pages deployment"; git push`
