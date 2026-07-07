# Driftless — Design Spec

**Date:** 2026-07-07
**Status:** Approved by user

A browser-based deep-focus timer where each focus session is a spacecraft journey to a
planet or moon. Pick a destination (sets the session length), launch, stay on course while
you work. Reference structure: Focus Flight (ritual entry → narrative middle → rewarding
arrival), reskinned as calm, premium space travel. The UI must recede during focus; all
expressiveness lives in the pre-launch ritual and the arrival moment.

## 1. Mission phase machine (app spine)

A single top-level `phase` drives everything:

```
idle → briefing → launching → transit → arriving → arrived → idle
                                  └→ abort-confirm → idle
```

- **idle** — home view: destination select, star map, mission log, settings access.
- **briefing** — mission briefing card: destination, travel time, distance, flavor text,
  optional focus category (Study / Work / Reading / Deep Work). Skippable via settings.
- **launching** — 3-2-1 ignition; starfield briefly accelerates; soft rising launch tone.
- **transit** — the calm state. Slow star drift, destination slowly growing, understated
  HUD (small low-contrast time remaining, thin progress indicator, one quiet abort
  affordance). No popups, badges, or notifications, ever.
- **arriving** — final ~15 s: deceleration, planet fills the view, warm resolving chord.
- **arrived** — arrival card: "Arrived at Mars" + minutes focused, distance travelled,
  lifetime totals, and any newly unlocked destination. Then back to idle.

One persistent full-screen canvas reads the phase and eases its animation parameters
(drift speed, planet scale) between states — no scene reloads, seamless transitions.

## 2. Timer engine (timestamp-based, crash-proof)

- `startedAt` / `endAt` timestamps are the source of truth; every tick recomputes
  remaining time from `Date.now()`. Never accumulate interval increments.
- The active session (`destinationId, startedAt, endAt, plannedMinutes, category`,
  plus hidden-destination flag for random mode) persists to localStorage the moment
  the mission launches.
- On app boot:
  - Active session exists and `now < endAt` → resume directly into **transit**.
  - Active session exists and `now ≥ endAt` → go straight to **arrival** and credit it
    (never punish — the time was served).
- Abort asks for a gentle confirm, logs the mission with `completed: false`, adds nothing
  to totals, and uses no shame copy.
- `visibilitychange` pauses the canvas and throttles ticks in background tabs; displayed
  time stays correct because it is timestamp-derived.

## 3. State & persistence

- **Zustand + persist middleware** (localStorage) for: unlocked destination ids, visited
  set, lifetime focus minutes, lifetime distance, settings, mission log. Log records are
  ~150 bytes each — localStorage suffices, no IndexedDB.
- No backend, no accounts. Everything local.

### Data model

```ts
type Destination = {
  id: string; name: string;
  type: 'planet' | 'moon' | 'station' | 'region' | 'dwarf';
  durationMinutes: number; distance: number; // flavour/stats only
  palette: { base: string; accent: string };
  flavor: string; unlockAtTotalMinutes?: number;
};

type MissionLog = {
  id: string; destinationId: string;
  startedAt: number; endedAt: number;
  plannedMinutes: number; actualMinutes: number;
  completed: boolean; category?: string;
};

type UserState = {
  homeBaseId: string; unlockedDestinationIds: string[];
  totalFocusMinutes: number; totalDistance: number;
  settings: { volume: number; muted: boolean; ambience: string;
              reducedMotion: boolean; skipRitual: boolean; halfwayPing: boolean };
};
```

## 4. Destinations & progression (gentle gating)

| Destination | Type | Minutes | Unlock at lifetime minutes |
|---|---|---|---|
| Low Earth Orbit / ISS | station | 5 | 0 |
| The Moon | moon | 10 | 0 |
| Venus | planet | 15 | 0 |
| **Mars (default)** | planet | **25** | 0 |
| The Asteroid Belt | region | 30 | 30 |
| Jupiter | planet | 45 | 120 |
| Europa | moon | 50 | 180 |
| Saturn | planet | 60 | 240 |
| Titan | moon | 75 | 360 |
| Uranus | planet | 90 | 480 |
| Neptune | planet | 105 | 600 |
| Pluto | dwarf | 120 | 720 |
| The Kuiper Belt | region | 150 | 900 |

- Distances are approximate relative values for flavour/stats only, not real physics.
- Completing a mission marks the world visited and adds its distance to lifetime totals.
- Unlocks are announced only on the arrival card — never mid-session.
- **Custom duration** (5–180 min) maps to the nearest *unlocked* destination and is framed
  as e.g. an "extended transit to Jupiter"; it counts toward that body's visited status.
- **Random mode** picks a random unlocked destination and keeps it "classified" until
  arrival.

## 5. Visual layer

- **One Canvas 2D starfield component:** 3+ parallax depth layers; most stars tiny and
  dim, a few brighter; very slow twinkle; rare subtle shooting star; gentle pointer
  parallax; DPR-aware; density throttled on low-end devices; paused when the tab is
  hidden. `prefers-reduced-motion` (or the settings toggle) swaps to a static field.
- **Planets rendered procedurally on canvas:** one parameterized renderer (base radial
  gradient + soft atmospheric rim light per body palette), special cases for Saturn's
  rings and Jupiter's bands. No image assets — keeps the PWA tiny and offline-clean.
- **Ship:** inline SVG silhouette, subtle engine-glow gradient, slow idle drift/bob.
  Not a cartoon.
- **Design tokens first:** Tailwind config with deep navy/indigo base (`#0B1026`, never
  pure black), a single warm amber accent, muted nebula tints (dusty teal, faded rose)
  used sparingly, Space Grotesk for UI + JetBrains Mono for numeric readouts, restrained
  type scale, generous spacing.
- **Banned:** purple→pink gradients, neon-on-everything, glassmorphism everywhere, emoji
  icons, pure black, clip-art planets, warp streaks during focus (speed flourishes only
  at launch/arrival).

## 6. Audio engine (fully procedural, Web Audio API)

- No audio files. Base layer: filtered brown noise + low sine drone, very subtle,
  seamless by construction.
- Three selectable ambiences: **Cosmic Drift** (slow evolving detuned pad), **Cockpit**
  (sparse filtered mechanical tones), **Deep Silence** (near-silent, rare distant tones).
- Milestone cues: soft rising tone at launch; warm resolving chord at arrival; optional
  very-subtle halfway ping (off by default). Never startling, no volume jumps.
- Master volume slider + mute, persisted, modest default. Engine initializes on first
  user gesture (autoplay policy). The app works fully muted.

## 7. Technical stack

- Vite + React + TypeScript; Tailwind CSS with custom design tokens; Framer Motion for
  UI transitions; Zustand for state; Canvas 2D for all scene rendering (no Three.js).
- **PWA:** vite-plugin-pwa, manifest + icons, offline core loop after first load.
- **Accessibility:** keyboard-navigable, focus management across phases, `aria-live` for
  arrival, screen-reader labels, sufficient contrast, never colour-only meaning,
  `prefers-reduced-motion` honoured.
- **Performance/battery:** `requestAnimationFrame` with pause/throttle when hidden,
  starfield density scaling, no layout thrash. Sessions run for hours — treat as a
  feature.
- **Responsive:** desktop and installed-on-phone layouts.

## 8. Build order

1. Scaffold (Vite + React + TS + Tailwind + tokens), git init, commit per milestone.
2. Starfield + core design system (colours, type, buttons, cards).
3. **Vertical slice:** the Moon, 10 min — full ritual → transit → arrival, end to end.
4. Breadth: all destinations, progression, star map, mission log, audio, settings.
5. PWA, accessibility pass, reduced motion, polish.
6. Deploy: GitHub repo + Actions workflow → GitHub Pages (base path `/Driftless/`).

## 9. Testing

- Vitest on pure logic: timer engine (resume / expiry / abort), unlock thresholds,
  custom-duration mapping.
- Visual/audio layers verified by driving the real app end-to-end (short session).

## Definition of done

Ritual → resilient timer (survives backgrounding and reload) → calm in-transit view →
gentle rewarding arrival with stats + unlock. All starter destinations, custom duration +
random mode. Polished visuals per art direction with reduced-motion fallback. Procedural
ambient audio with volume/mute. Mission log + star map. Functional settings. Installable
offline-capable PWA deployed to GitHub Pages. Responsive + accessible.
