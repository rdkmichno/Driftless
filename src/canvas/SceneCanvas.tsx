import { useEffect, useRef } from 'react';
import { Starfield } from './starfield';
import { drawDestination } from './planets';
import { computeLayout, drawFlightMap } from './flightmap';
import { drawAscentFrame, ASCENT_MS } from './ascent';
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

    const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)');
    const isReduced = () => prefersReduced.matches || useStore.getState().settings.reducedMotion;

    // Transit renders the top-down flight map; arrival crossfades the map out
    // while the destination planet zooms in for the reveal.
    const drawMission = (t: number) => {
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
        drawFlightMap(ctx, layout, dest, sceneState.planetProgress, t / 1000, {
          classified: sceneState.classified,
          globalAlpha: 1 - arrivalScale,
        });
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

    // Takeoff: ground scene (static during the countdown), then the animated
    // ascent that crossfades into the flight map at the top.
    const drawTakeoff = (t: number) => {
      const phase = useStore.getState().phase;
      let at = 0;
      if (phase === 'ascent') {
        if (ascentStart === null) ascentStart = t;
        at = Math.min(1, (t - ascentStart) / ASCENT_MS);
      } else {
        ascentStart = null;
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
      if (phase === 'ascent' && at >= 1) {
        ascentStart = null;
        useStore.getState().beginTransit(Date.now());
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const phase = useStore.getState().phase;
      field.setSpeedTarget(PHASE_SPEED[phase]);
      if (!isReduced()) field.step(dt);
      if (phase === 'launching' || phase === 'ascent') {
        drawTakeoff(t);
      } else {
        ascentStart = null;
        field.draw(ctx);
        drawMission(t);
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
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="fixed inset-0" />;
}
