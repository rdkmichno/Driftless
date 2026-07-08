# Driftless

A deep-focus timer themed as interplanetary travel. Pick a destination — the
farther the body, the longer the session — run through a short launch ritual,
and stay on course while you work. The screen stays calm during focus: a
top-down orbital map with your craft inching along its trajectory from Earth,
a slow parallax starfield behind it, and an ambient spacecraft hum. Arrive to
a warm chord and a close-up planet reveal, log the journey, and chart the
world on your personal star map.

- **Destinations** from Low Earth Orbit (5 min) to the Kuiper Belt (150 min);
  Mars is the classic 25-minute run. Farther worlds unlock as your lifetime
  focus grows. Custom durations and a "random destination" mode included.
- **Resilient timer** — driven by timestamps, it survives tab backgrounding,
  reloads, and even closing the app mid-mission.
- **Procedural everything** — starfield, planets, and audio (Web Audio API)
  are generated in code; no heavy assets, works fully offline as an
  installable PWA.
- **Gentle by design** — aborting a mission is never punished, and nothing
  interrupts you during a session.

## Development

```bash
npm install
npm run dev      # dev server (append ?t=0.5 to any launch for 30-second test sessions)
npm run test     # vitest suite
npm run build    # typecheck + production build
```

Everything is stored locally (localStorage) — no backend, no account.
