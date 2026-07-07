import type { Destination } from '../data/destinations';

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r}, ${g}, ${b})`;
}

function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// deterministic PRNG so region scatter is stable frame to frame
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawSphere(ctx: CanvasRenderingContext2D, dest: Destination, x: number, y: number, r: number) {
  // atmosphere halo
  const halo = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.16);
  halo.addColorStop(0, alpha(dest.palette.accent, 0.16));
  halo.addColorStop(1, alpha(dest.palette.accent, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.16, 0, Math.PI * 2);
  ctx.fill();

  // body with upper-left light
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  body.addColorStop(0, dest.palette.accent);
  body.addColorStop(0.45, dest.palette.base);
  body.addColorStop(1, shade(dest.palette.base, 0.45));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // rim highlight on the lit limb
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.99, Math.PI * 0.8, Math.PI * 1.55);
  ctx.stroke();
}

function drawBands(ctx: CanvasRenderingContext2D, dest: Destination, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const by = y - r + ((i + 0.5) / bands) * 2 * r;
    const bh = (2 * r) / bands / 2.2;
    ctx.fillStyle = i % 2 === 0 ? alpha(dest.palette.accent, 0.14) : 'rgba(0, 0, 0, 0.10)';
    ctx.beginPath();
    ctx.ellipse(x, by, r * 1.05, bh, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRings(ctx: CanvasRenderingContext2D, dest: Destination, x: number, y: number, r: number, half: 'back' | 'front') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-12 * Math.PI) / 180);
  if (half === 'back') {
    ctx.beginPath();
    ctx.rect(-r * 2.4, -r * 2.4, r * 4.8, r * 2.4);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(-r * 2.4, 0, r * 4.8, r * 2.4);
    ctx.clip();
  }
  const rings = [
    { rx: 1.7, a: 0.35, lw: 0.16 },
    { rx: 1.95, a: 0.22, lw: 0.1 },
    { rx: 2.12, a: 0.14, lw: 0.06 },
  ];
  for (const ring of rings) {
    ctx.strokeStyle = alpha(dest.palette.accent, ring.a);
    ctx.lineWidth = r * ring.lw;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * ring.rx, r * ring.rx * 0.26, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRegion(ctx: CanvasRenderingContext2D, dest: Destination, x: number, y: number, r: number) {
  const rng = mulberry32(hashString(dest.id));
  const icy = dest.id === 'kuiper';
  const count = icy ? 28 : 40;
  for (let i = 0; i < count; i++) {
    const px = x + (rng() - 0.5) * r * 3;
    const py = y + (rng() - 0.5) * r * 0.9 * (1 - Math.abs(rng() - 0.5));
    const pr = (0.5 + rng() * 1.5) * Math.max(1, r * 0.04);
    const tone = 0.5 + rng() * 0.5;
    ctx.fillStyle = alpha(rng() > 0.7 ? dest.palette.accent : dest.palette.base, 0.35 + tone * 0.45);
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    if (icy && rng() > 0.75) {
      ctx.fillStyle = 'rgba(233, 235, 244, 0.5)';
      ctx.beginPath();
      ctx.arc(px, py, pr * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawStation(ctx: CanvasRenderingContext2D, dest: Destination, x: number, y: number, r: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  const u = r / 2; // scale unit

  // solar panels
  for (const side of [-1, 1]) {
    const inner = side * u * 1.1;
    const outer = side * u * 3.5;
    ctx.fillStyle = '#26314f';
    ctx.fillRect(Math.min(inner, outer), -u * 0.35, Math.abs(outer - inner), u * 0.7);
    ctx.strokeStyle = alpha(dest.palette.accent, 0.3);
    ctx.lineWidth = Math.max(0.5, u * 0.03);
    for (let i = 1; i < 4; i++) {
      const gx = inner + (outer - inner) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(gx, -u * 0.35);
      ctx.lineTo(gx, u * 0.35);
      ctx.stroke();
    }
  }

  // hull
  ctx.fillStyle = dest.palette.base;
  ctx.beginPath();
  ctx.roundRect(-u * 1.1, -u * 0.35, u * 2.2, u * 0.7, u * 0.3);
  ctx.fill();
  ctx.fillStyle = alpha(dest.palette.accent, 0.5);
  ctx.fillRect(-u * 0.15, -u * 0.6, u * 0.3, u * 1.2);

  // blinking nav light
  ctx.fillStyle = alpha('#e8b45a', 0.5 + 0.5 * Math.sin(t * 2));
  ctx.beginPath();
  ctx.arc(u * 1.15, 0, Math.max(1.5, u * 0.09), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawDestination(
  ctx: CanvasRenderingContext2D,
  dest: Destination,
  x: number,
  y: number,
  r: number,
  t: number,
) {
  if (dest.type === 'region') {
    drawRegion(ctx, dest, x, y, r);
    return;
  }
  if (dest.type === 'station') {
    drawStation(ctx, dest, x, y, r, t);
    return;
  }
  if (dest.id === 'saturn') drawRings(ctx, dest, x, y, r, 'back');
  drawSphere(ctx, dest, x, y, r);
  if (dest.id === 'jupiter' || dest.id === 'titan' || dest.id === 'venus') drawBands(ctx, dest, x, y, r);
  if (dest.id === 'saturn') drawRings(ctx, dest, x, y, r, 'front');
}
