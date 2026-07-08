import type { Destination } from '../data/destinations';

export type Pt = { x: number; y: number };

export type MapLayout = {
  origin: Pt; // Earth / launch base
  dest: Pt;
  ctrl: Pt; // quadratic bezier control point
  sun: Pt;
};

/** Shared by the canvas layer and the HTML endpoint pills. Pure fn of viewport. */
export function computeLayout(w: number, h: number): MapLayout {
  const portrait = h > w;
  const origin = portrait ? { x: w * 0.28, y: h * 0.72 } : { x: w * 0.26, y: h * 0.66 };
  const dest = portrait ? { x: w * 0.72, y: h * 0.26 } : { x: w * 0.74, y: h * 0.32 };
  const sun = { x: w * 0.04, y: h * 0.96 };

  // bow the arc away from the sun so it reads as an outbound transfer orbit
  const mx = (origin.x + dest.x) / 2;
  const my = (origin.y + dest.y) / 2;
  const dx = dest.x - origin.x;
  const dy = dest.y - origin.y;
  const len = Math.hypot(dx, dy) || 1;
  let px = dy / len;
  let py = -dx / len;
  if ((mx + px - sun.x) ** 2 + (my + py - sun.y) ** 2 < (mx - px - sun.x) ** 2 + (my - py - sun.y) ** 2) {
    px = -px;
    py = -py;
  }
  const bow = len * 0.16;
  return { origin, dest, ctrl: { x: mx + px * bow, y: my + py * bow }, sun };
}

export function bezierPoint(l: MapLayout, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * l.origin.x + 2 * u * t * l.ctrl.x + t * t * l.dest.x,
    y: u * u * l.origin.y + 2 * u * t * l.ctrl.y + t * t * l.dest.y,
  };
}

function bezierTangent(l: MapLayout, t: number): Pt {
  const u = 1 - t;
  return {
    x: 2 * u * (l.ctrl.x - l.origin.x) + 2 * t * (l.dest.x - l.ctrl.x),
    y: 2 * u * (l.ctrl.y - l.origin.y) + 2 * t * (l.dest.y - l.ctrl.y),
  };
}

function strokeArcSegment(ctx: CanvasRenderingContext2D, l: MapLayout, from: number, to: number, samples = 48) {
  ctx.beginPath();
  const p0 = bezierPoint(l, from);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i <= samples; i++) {
    const p = bezierPoint(l, from + ((to - from) * i) / samples);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Top-down orbital map: sun context, faint orbit rings through both endpoints,
 * trajectory arc (solid glowing trail behind the craft, dashed ahead), origin
 * and destination bodies, and the craft itself pointed along the arc.
 */
export function drawFlightMap(
  ctx: CanvasRenderingContext2D,
  l: MapLayout,
  dest: Destination,
  progress: number,
  t: number,
  opts: { classified?: boolean; globalAlpha?: number; zoom?: number } = {},
) {
  const ga = opts.globalAlpha ?? 1;
  if (ga <= 0.01) return;
  const zoom = opts.zoom ?? 1;
  const hairline = 1 / Math.sqrt(zoom); // keep context lines from thickening under the camera
  ctx.save();
  ctx.globalAlpha = ga;

  // sun glow (context only, mostly off-canvas)
  const sunGlow = ctx.createRadialGradient(l.sun.x, l.sun.y, 0, l.sun.x, l.sun.y, 180);
  sunGlow.addColorStop(0, 'rgba(232, 180, 90, 0.20)');
  sunGlow.addColorStop(1, 'rgba(232, 180, 90, 0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(l.sun.x, l.sun.y, 180, 0, Math.PI * 2);
  ctx.fill();

  // faint orbital rings through origin and destination
  ctx.strokeStyle = 'rgba(30, 39, 80, 0.65)';
  ctx.lineWidth = hairline;
  for (const p of [l.origin, l.dest]) {
    const r = Math.hypot(p.x - l.sun.x, p.y - l.sun.y);
    ctx.beginPath();
    ctx.arc(l.sun.x, l.sun.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const destAccent = opts.classified ? '#8a94a8' : dest.palette.accent;
  const destBase = opts.classified ? '#4a5268' : dest.palette.base;

  // route ahead: faint dashed
  ctx.save();
  ctx.strokeStyle = 'rgba(170, 176, 197, 0.30)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 7]);
  strokeArcSegment(ctx, l, progress, 1);
  ctx.restore();

  // trail behind: soft glow + solid amber line
  if (progress > 0.001) {
    ctx.strokeStyle = 'rgba(232, 180, 90, 0.14)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    strokeArcSegment(ctx, l, 0, progress);
    ctx.strokeStyle = 'rgba(232, 180, 90, 0.75)';
    ctx.lineWidth = 1.5;
    strokeArcSegment(ctx, l, 0, progress);
  }

  // origin: Earth
  const earth = ctx.createRadialGradient(l.origin.x - 2.5, l.origin.y - 2.5, 1, l.origin.x, l.origin.y, 8);
  earth.addColorStop(0, '#9fc4d8');
  earth.addColorStop(0.55, '#4a7fa8');
  earth.addColorStop(1, '#27476b');
  ctx.fillStyle = earth;
  ctx.beginPath();
  ctx.arc(l.origin.x, l.origin.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(159, 196, 216, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(l.origin.x, l.origin.y, 11, 0, Math.PI * 2);
  ctx.stroke();

  // destination body
  const db = ctx.createRadialGradient(l.dest.x - 3, l.dest.y - 3, 1, l.dest.x, l.dest.y, 9);
  db.addColorStop(0, destAccent);
  db.addColorStop(0.55, destBase);
  db.addColorStop(1, alpha(destBase, 0.4));
  ctx.fillStyle = db;
  ctx.beginPath();
  ctx.arc(l.dest.x, l.dest.y, 9, 0, Math.PI * 2);
  ctx.fill();
  // soft destination halo, breathing very slowly
  ctx.strokeStyle = alpha(destAccent, 0.18 + 0.06 * Math.sin(t * 0.5));
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(l.dest.x, l.dest.y, 13, 0, Math.PI * 2);
  ctx.stroke();

  // craft: small top-down dart pointed along the trajectory
  const pos = bezierPoint(l, progress);
  const tan = bezierTangent(l, progress);
  const angle = Math.atan2(tan.y, tan.x);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);
  // engine glow trailing the craft (brighter when the camera is close)
  const glowR = zoom >= 1.6 ? 13 : 10;
  const glow = ctx.createRadialGradient(-8, 0, 0, -8, 0, glowR);
  glow.addColorStop(0, `rgba(245, 206, 130, ${zoom >= 1.6 ? 0.65 : 0.5})`);
  glow.addColorStop(1, 'rgba(232, 180, 90, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(-8, 0, glowR, 0, Math.PI * 2);
  ctx.fill();
  // hull
  ctx.fillStyle = '#e9ebf4';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, 4.2);
  ctx.lineTo(-3.5, 0);
  ctx.lineTo(-6, -4.2);
  ctx.closePath();
  ctx.fill();
  if (zoom >= 1.6) {
    // close-up detail: hull shading, canopy, exhaust core
    ctx.fillStyle = 'rgba(106, 113, 137, 0.55)';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, 4.2);
    ctx.lineTo(-3.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1c2c55';
    ctx.beginPath();
    ctx.ellipse(2.5, 0, 2.4, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 206, 130, 0.85)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4.6, 0);
    ctx.lineTo(-9.5, 0);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}
