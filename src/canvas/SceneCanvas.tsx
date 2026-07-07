import { useEffect, useRef } from 'react';
import { Starfield } from './starfield';
import { drawDestination } from './planets';
import { getDestination } from '../data/destinations';
import { useStore, type Phase } from '../state/store';

// Mutable scene inputs written by the mission driver each tick; read by the
// render loop without going through React state (no re-renders at 60fps).
export const sceneState = {
  planetProgress: 0,
  destinationId: null as string | null,
};

const PHASE_SPEED: Record<Phase, number> = {
  idle: 0.6,
  briefing: 0.6,
  launching: 7,
  transit: 1,
  arriving: 0.3,
  arrived: 0.15,
};

const easeInCubic = (x: number) => x * x * x;
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

    const drawPlanet = (t: number) => {
      if (!sceneState.destinationId) return;
      const dest = getDestination(sceneState.destinationId);
      if (!dest) return;
      const phase = useStore.getState().phase;
      const w = innerWidth;
      const h = innerHeight;
      const m = Math.min(w, h);
      const baseR = lerp(2, m * 0.34, easeInCubic(sceneState.planetProgress));
      const swellTarget = phase === 'arriving' || phase === 'arrived' ? 1 : 0;
      arrivalScale += (swellTarget - arrivalScale) * 0.02;
      const r = lerp(baseR, m * 0.46, arrivalScale);
      const fade = Math.min(1, sceneState.planetProgress / 0.06);
      ctx.save();
      ctx.globalAlpha = fade;
      drawDestination(ctx, dest, w * 0.5, h * 0.4, r, t / 1000);
      ctx.restore();
    };

    const frame = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      field.setSpeedTarget(PHASE_SPEED[useStore.getState().phase]);
      if (!isReduced()) field.step(dt);
      field.draw(ctx);
      drawPlanet(t);
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
