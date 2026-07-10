import { useEffect, useRef } from 'react';
import { Starfield } from './starfield';
import { drawDestination } from './planets';
import { bezierPoint, computeLayout, drawFlightMap } from './flightmap';
import { drawAscentFrame, drawAscentPost, teardownAscent, padState, ASCENT_MS } from './ascent';
import { drawLandingFrame, drawLandingPost, teardownLanding, LANDING_MS } from './landing';
import { getLandingProfile } from './landingProfiles';
import { TEST_MODE, TEST_ASCENT_MS, TEST_LANDING_MS } from '../lib/testMode';
import { applyCamera, ensureCameraLoaded, getCamera, isZoomedIn, panBy, stepCamera, zoomBy, zoomHome } from './camera';
import { getDestination } from '../data/destinations';
import { useStore, type Phase } from '../state/store';

// Mutable scene inputs written by the mission driver each tick; read by the
// render loop without going through React state (no re-renders at 60fps).
export const sceneState = {
  planetProgress: 0,
  destinationId: null as string | null,
  classified: false,
};

const PHASE_SPEED: Record<Phase, number> = {
  idle: 0.6,
  briefing: 0.6,
  launching: 0.6,
  ascent: 1.5,
  transit: 1,
  arriving: 0.3,
  landing: 0.25,
  arrived: 0.15,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function SceneCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const field = new Starfield(innerWidth, innerHeight);
    let raf = 0;
    let last = performance.now();
    let running = false;
    let arrivalScale = 0; // eased extra swell during arriving/arrived
    let ascentStart: number | null = null; // takeoff animation clock
    let takeoffActive = false; // for freeing takeoff resources on exit/skip
    let landingStart: number | null = null; // landing animation clock
    let landingActive = false; // stays true through 'arrived' so the card sits on the final frame

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      field.resize(innerWidth, innerHeight);
    };
    resize();
    addEventListener('resize', resize);

    const onPointer = (e: PointerEvent) =>
      field.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    addEventListener('pointermove', onPointer);

    // --- map camera input: wheel zoom, drag pan, pinch (transit only) ---
    const inTransit = () => useStore.getState().phase === 'transit';
    const overUi = (el: EventTarget | null) => el instanceof Element && !!el.closest('button, input, a');
    const onWheel = (e: WheelEvent) => {
      if (!inTransit() || overUi(e.target)) return;
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0016), e.clientX, e.clientY, innerWidth, innerHeight);
    };
    addEventListener('wheel', onWheel, { passive: false });

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    const onDown = (e: PointerEvent) => {
      if (!inTransit() || overUi(e.target)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onDrag = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      if (pointers.size === 2) {
        p.x = e.clientX;
        p.y = e.clientY;
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0 && d > 0) zoomBy(d / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2, innerWidth, innerHeight);
        pinchDist = d;
        return;
      }
      if (isZoomedIn()) panBy(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX;
      p.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinchDist = 0;
    };
    addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onDrag);
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);

    const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)');
    const isReduced = () => prefersReduced.matches || useStore.getState().settings.reducedMotion;

    // Transit renders the top-down flight map through the user camera;
    // arrival eases the camera home and crossfades into the planet reveal.
    const drawMission = (t: number, dt: number) => {
      if (!sceneState.destinationId) return;
      const dest = getDestination(sceneState.destinationId);
      if (!dest) return;
      const phase = useStore.getState().phase;
      const w = innerWidth;
      const h = innerHeight;
      const m = Math.min(w, h);
      if (phase === 'idle' || phase === 'briefing' || phase === 'launching') arrivalScale = 0;
      const swellTarget = phase === 'arriving' || phase === 'arrived' ? 1 : 0;
      arrivalScale += (swellTarget - arrivalScale) * 0.014;

      if (phase === 'transit' || phase === 'arriving') {
        const layout = computeLayout(w, h);
        const margin = 150;
        const bounds = {
          minX: Math.min(layout.origin.x, layout.dest.x) - margin,
          maxX: Math.max(layout.origin.x, layout.dest.x) + margin,
          minY: Math.min(layout.origin.y, layout.dest.y) - margin,
          maxY: Math.max(layout.origin.y, layout.dest.y) + margin,
        };
        if (phase === 'transit') {
          ensureCameraLoaded();
          const ship = bezierPoint(layout, sceneState.planetProgress);
          stepCamera(dt, ship.x, ship.y, w, h, bounds);
        } else {
          zoomHome();
          stepCamera(dt, 0, 0, w, h, bounds);
        }
        ctx.save();
        applyCamera(ctx, w, h);
        drawFlightMap(ctx, layout, dest, sceneState.planetProgress, t / 1000, {
          classified: sceneState.classified,
          globalAlpha: 1 - arrivalScale,
          zoom: getCamera().zoom,
        });
        ctx.restore();
      }
      if (arrivalScale > 0.01 && (phase === 'arriving' || phase === 'arrived')) {
        const eased = 1 - (1 - arrivalScale) ** 3; // ease-out
        const r = lerp(m * 0.05, m * 0.46, eased);
        ctx.save();
        ctx.globalAlpha = Math.min(1, arrivalScale * 2.5);
        drawDestination(ctx, dest, w * 0.5, h * 0.4, r, t / 1000);
        ctx.restore();
      }
    };

    // Takeoff: pre-launch pad scene (gantry retract / glow / camera push fed
    // by padState during the countdown), then the animated ascent that
    // crossfades into the flight map. The camera push and pre-ignition glow
    // decay during the ascent so the handoff reads as one continuous shot.
    const drawTakeoff = (t: number, dt: number) => {
      const phase = useStore.getState().phase;
      let at = 0;
      if (phase === 'ascent') {
        if (ascentStart === null) ascentStart = t;
        at = Math.min(1, (t - ascentStart) / (TEST_MODE ? TEST_ASCENT_MS : ASCENT_MS));
        padState.camPush = Math.max(0, padState.camPush - dt * 1.1);
        padState.ignitionGlow = Math.max(0, padState.ignitionGlow - dt * 1.1);
      } else {
        ascentStart = null;
      }
      const push = padState.camPush;
      const zoomed = push > 0.002;
      if (zoomed) {
        // slow push-in anchored near the pad, tightening as the engines light
        ctx.save();
        const s = 1 + 0.055 * push;
        ctx.translate(innerWidth / 2, innerHeight * 0.75);
        ctx.scale(s, s);
        ctx.translate(-innerWidth / 2, -innerHeight * 0.75);
      }
      const { starsAlpha, mapAlpha } = drawAscentFrame(ctx, innerWidth, innerHeight, at, t / 1000);
      if (starsAlpha > 0.01) field.draw(ctx, { skipBackground: true, starsAlpha });
      if (mapAlpha > 0.01) {
        const dest = sceneState.destinationId ? getDestination(sceneState.destinationId) : null;
        if (dest) {
          drawFlightMap(ctx, computeLayout(innerWidth, innerHeight), dest, 0, t / 1000, {
            classified: sceneState.classified,
            globalAlpha: mapAlpha,
          });
        }
      }
      if (zoomed) ctx.restore();
      drawAscentPost(ctx, innerWidth, innerHeight, at);
      if (phase === 'ascent' && at >= 1) {
        ascentStart = null;
        teardownAscent();
        useStore.getState().beginTransit(Date.now());
      }
    };

    // Landing: descent sequence themed to the destination. Animated during the
    // 'landing' phase; its final frame is held (frozen) behind the arrival card.
    const drawLanding = (t: number, frozen: boolean) => {
      const destId = sceneState.destinationId;
      const dest = destId ? getDestination(destId) : null;
      if (!dest) return;
      const profile = getLandingProfile(dest.id);
      let at: number;
      if (frozen) {
        at = 1;
      } else {
        if (landingStart === null) landingStart = t;
        const dur = TEST_MODE ? TEST_LANDING_MS : LANDING_MS * (profile.descentScale ?? 1);
        at = Math.min(1, (t - landingStart) / dur);
      }
      drawLandingFrame(ctx, innerWidth, innerHeight, dest, profile, at, t / 1000, (a) =>
        field.draw(ctx, { skipBackground: true, starsAlpha: a }),
      );
      drawLandingPost(ctx, innerWidth, innerHeight, at);
      if (!frozen && at >= 1) {
        landingStart = null;
        useStore.getState().completeMission(Date.now());
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const phase = useStore.getState().phase;
      field.setSpeedTarget(PHASE_SPEED[phase]);
      if (!isReduced()) field.step(dt);

      const takeoff = phase === 'launching' || phase === 'ascent';
      const landing = phase === 'landing';
      const frozenLanding = phase === 'arrived' && landingActive;

      if (takeoff) {
        takeoffActive = true;
        drawTakeoff(t, dt);
      } else if (landing || frozenLanding) {
        landingActive = true;
        drawLanding(t, frozenLanding);
      } else {
        ascentStart = null;
        landingStart = null;
        if (takeoffActive) {
          takeoffActive = false;
          teardownAscent();
        }
        if (landingActive) {
          landingActive = false;
          teardownLanding();
        }
        field.draw(ctx);
        drawMission(t, dt);
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    start();

    return () => {
      stop();
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onPointer);
      removeEventListener('wheel', onWheel);
      removeEventListener('pointerdown', onDown);
      removeEventListener('pointermove', onDrag);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="fixed inset-0" />;
}
