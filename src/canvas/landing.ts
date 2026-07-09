/**
 * Landing / arrival sequence — the mirror of the takeoff: same craft and
 * illustrated style, but descending, decelerating (ease-out), and themed to
 * the destination via its LandingProfile. Pure Canvas 2D. Handles four arrival
 * modes (land / orbit / dock / driftStop), a continuous space→surface sky morph
 * (reversed takeoff technique), directional light with per-body temperature,
 * secondary motion (retro plume, dust, sway/settle), signature features, and a
 * grain + vignette finishing pass. All transient resources are freed by
 * teardownLanding() once the arrival card is shown.
 */

import type { Destination } from '../data/destinations';
import type { LandingProfile, Rgb } from './landingProfiles';

export const LANDING_MS = 5200;

/* ---------- math ---------- */
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: Rgb, a = 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function skyAt(profile: LandingProfile, d: number): { top: Rgb; bottom: Rgb } {
  const s = profile.sky;
  let i = 0;
  while (i < s.length - 2 && d > s[i + 1][0]) i++;
  const [d0, t0, b0] = s[i];
  const [d1, t1, b1] = s[Math.min(i + 1, s.length - 1)];
  const f = d1 === d0 ? 0 : clamp01((d - d0) / (d1 - d0));
  return { top: mix(t0, t1, f), bottom: mix(b0, b1, f) };
}

/* ---------- sprites (freed on teardown) ---------- */
let puffSprite: HTMLCanvasElement | null = null;
let noiseSprite: HTMLCanvasElement | null = null;

function makePuff(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
function makeNoise(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d')!;
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() < 0.5 ? 13 : 0;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* ---------- particles ---------- */
type Puff = { x: number; y: number; vx: number; vy: number; r: number; vr: number; life: number; max: number; tint: Rgb };
const puffs: Puff[] = [];
const MAX_PUFFS = 70;
let lastT = 0;
let touchdownFired = false;

export function teardownLanding() {
  puffs.length = 0;
  puffSprite = null;
  noiseSprite = null;
  lastT = 0;
  touchdownFired = false;
}

/* ---------- craft ---------- */
function drawLander(ctx: CanvasRenderingContext2D, x: number, y: number, timeSec: number, thrust: number, sway: number, heat: number, light: Rgb) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);

  // retro-burn: plume fires DOWNWARD to decelerate
  if (thrust > 0.02) {
    const flick = 0.82 + 0.18 * Math.sin(timeSec * 30) * Math.cos(timeSec * 17 + 1);
    const wob = Math.sin(timeSec * 22) * 2;
    const len = (26 + thrust * 40) * flick;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 30, 2, 0, 30, 26 + thrust * 20);
    halo.addColorStop(0, `rgba(232,180,90,${0.3 * flick})`);
    halo.addColorStop(1, 'rgba(232,180,90,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 30, 26 + thrust * 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const sheath = ctx.createLinearGradient(0, 26, 0, 26 + len);
    sheath.addColorStop(0, 'rgba(245,206,130,0.9)');
    sheath.addColorStop(0.5, 'rgba(232,180,90,0.45)');
    sheath.addColorStop(1, 'rgba(150,110,90,0)');
    ctx.fillStyle = sheath;
    ctx.beginPath();
    ctx.moveTo(-6, 25);
    ctx.quadraticCurveTo(-9 - wob, 25 + len * 0.5, wob * 0.5, 25 + len);
    ctx.quadraticCurveTo(9 - wob, 25 + len * 0.5, 6, 25);
    ctx.closePath();
    ctx.fill();
    const core = ctx.createLinearGradient(0, 26, 0, 26 + len * 0.5);
    core.addColorStop(0, `rgba(255,246,220,${0.9 * flick})`);
    core.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(-3, 25);
    ctx.quadraticCurveTo(0, 25 + len * 0.4, 0, 25 + len * 0.5);
    ctx.quadraticCurveTo(0, 25 + len * 0.3, 3, 25);
    ctx.closePath();
    ctx.fill();
  }

  // atmospheric-entry heat glow on the leading (lower) hull
  if (heat > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 20, 2, 0, 20, 22);
    g.addColorStop(0, `rgba(255,150,90,${0.5 * heat})`);
    g.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 20, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // fins
  ctx.fillStyle = '#465579';
  ctx.beginPath();
  ctx.moveTo(-9, 8);
  ctx.quadraticCurveTo(-19, 22, -16, 28);
  ctx.lineTo(-7, 21);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9, 8);
  ctx.quadraticCurveTo(19, 22, 16, 28);
  ctx.lineTo(7, 21);
  ctx.closePath();
  ctx.fill();

  // hull lit from the key-light side
  const body = ctx.createLinearGradient(-10, -18, 11, 8);
  body.addColorStop(0, css(mix([210, 216, 230], light, 0.25)));
  body.addColorStop(0.5, '#9aa2ba');
  body.addColorStop(1, '#5f6780');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.quadraticCurveTo(10, -18, 10, 2);
  ctx.lineTo(10, 22);
  ctx.quadraticCurveTo(0, 27, -10, 22);
  ctx.lineTo(-10, 2);
  ctx.quadraticCurveTo(-10, -18, 0, -30);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1c2c55';
  ctx.beginPath();
  ctx.arc(0, -7, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8b45a';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // landing legs deploy near the ground
  ctx.strokeStyle = '#3a4665';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 22);
  ctx.lineTo(-14, 30);
  ctx.moveTo(8, 22);
  ctx.lineTo(14, 30);
  ctx.stroke();
  ctx.restore();
}

/* ---------- signatures ---------- */
function drawEarth(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const x = w * 0.76;
  const y = h * 0.2;
  const r = Math.min(w, h) * 0.07;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
  g.addColorStop(0, '#8fc4e0');
  g.addColorStop(0.5, '#3f7cb0');
  g.addColorStop(1, '#1d3f68');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,180,140,0.5)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.2, y + r * 0.1, r * 0.4, r * 0.25, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // thin atmosphere rim
  const rim = ctx.createRadialGradient(x, y, r, x, y, r * 1.15);
  rim.addColorStop(0, 'rgba(150,200,230,0.35)');
  rim.addColorStop(1, 'rgba(150,200,230,0)');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.15, 0, Math.PI * 2);
  ctx.fill();
}

function drawJupiterHorizon(ctx: CanvasRenderingContext2D, w: number, h: number, d: number) {
  // enormous banded disc looming on the horizon — the Europa signature shot
  const x = w * 0.66;
  const y = h * (0.05 + 0.12 * d);
  const r = Math.min(w, h) * 0.42;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const base = ctx.createLinearGradient(x - r, 0, x + r, 0);
  base.addColorStop(0, '#8a6a4a');
  base.addColorStop(0.5, '#c19a72');
  base.addColorStop(1, '#7a5c40');
  ctx.fillStyle = base;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  const bands = ['#d8b98e', '#a67c55', '#e0c9a4', '#946b48', '#cbab80'];
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = bands[i % bands.length];
    ctx.globalAlpha = 0.5;
    const by = y - r + ((i + 0.5) / 9) * 2 * r;
    ctx.beginPath();
    ctx.ellipse(x, by, r * 1.05, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // great red spot
  ctx.fillStyle = 'rgba(180,90,60,0.7)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.25, y + r * 0.3, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // terminator shading
  const term = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.2, x, y, r);
  term.addColorStop(0, 'rgba(0,0,0,0)');
  term.addColorStop(1, 'rgba(6,8,18,0.55)');
  ctx.fillStyle = term;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawRings(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number, at: number) {
  // sweep through Saturn's rings into orbit — the best-looking arrival
  ctx.save();
  ctx.translate(w * 0.5, h * 0.34);
  ctx.rotate(-0.32);
  const spread = lerp(0.7, 1, easeOut(at));
  const ringDefs = [
    { rx: 1.9, ry: 0.4, a: 0.5, c: '#e8d6ab' },
    { rx: 2.25, ry: 0.47, a: 0.32, c: '#cbb184' },
    { rx: 2.55, ry: 0.53, a: 0.2, c: '#efe1bd' },
    { rx: 2.85, ry: 0.6, a: 0.12, c: '#b89c6f' },
  ];
  const unit = Math.min(w, h) * 0.5 * spread;
  for (const r of ringDefs) {
    ctx.strokeStyle = css(hexToRgb(r.c), r.a);
    ctx.lineWidth = unit * 0.09;
    ctx.beginPath();
    ctx.ellipse(0, 0, unit * r.rx, unit * r.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // fine particle glints drifting along the ring plane
  const rng = mulberry(7);
  ctx.fillStyle = 'rgba(255,248,224,0.5)';
  for (let i = 0; i < 40; i++) {
    const ang = rng() * Math.PI * 2 + timeSec * 0.05;
    const rr = unit * (1.9 + rng() * 0.95);
    ctx.globalAlpha = 0.2 + rng() * 0.4;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * rr, Math.sin(ang) * rr * 0.28, 0.8 + rng(), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ---------- cloud tops (orbit mode) ---------- */
function drawCloudTops(ctx: CanvasRenderingContext2D, w: number, h: number, profile: LandingProfile, d: number, timeSec: number) {
  const bands = profile.cloudBands ?? [profile.surface.base, profile.surface.accent];
  const scroll = profile.scroll ?? 6;
  const topY = lerp(h * 1.1, h * 0.5, d); // cloud tops rise into the lower view
  if (topY >= h) return; // not yet in view
  const bandH = Math.max(4, (h - topY) / bands.length + 6);
  for (let i = 0; i < bands.length; i++) {
    const y = topY + i * ((h - topY) / bands.length);
    // atmospheric perspective: nearer (lower) bands more saturated/defined
    const near = i / bands.length;
    const col = mix([bands[i][0] * 0.85, bands[i][1] * 0.85, bands[i][2] * 0.85], bands[i], 0.4 + near * 0.6);
    ctx.fillStyle = css(col);
    ctx.fillRect(0, y, w, bandH);
    // rolling swirl texture, scrolling horizontally
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, w, bandH);
    ctx.clip();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = css(mix(col, [255, 255, 255], 0.4));
    const off = (timeSec * scroll * (0.5 + near)) % (w + 200);
    for (let k = -1; k < w / 160 + 1; k++) {
      const cx = k * 160 - off + (i % 2) * 80;
      ctx.beginPath();
      ctx.ellipse(cx, y + bandH * 0.5, 90, Math.max(1, bandH * 0.4), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/* ---------- surface (land mode) ---------- */
function drawSurface(ctx: CanvasRenderingContext2D, w: number, h: number, dest: Destination, profile: LandingProfile, d: number, timeSec: number) {
  const surfY = lerp(h * 1.2, h * 0.7, d);
  if (surfY > h) return surfY;
  const { base, accent, fracture } = profile.surface;
  // ground fill with a light gradient toward the key light
  const g = ctx.createLinearGradient(0, surfY, 0, h);
  g.addColorStop(0, css(mix(base, accent, 0.4 + profile.shadowHard * 0.1)));
  g.addColorStop(1, css(mix(base, [0, 0, 0], 0.35)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, surfY + 18);
  ctx.quadraticCurveTo(w * 0.3, surfY - 10, w * 0.6, surfY + 6);
  ctx.quadraticCurveTo(w * 0.85, surfY + 16, w, surfY - 2);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // signature surface features
  if (profile.signature === 'heart') {
    // Pluto's Tombaugh Regio — a pale heart on the plain
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = css(mix(accent, [255, 255, 255], 0.4));
    const hx = w * 0.5;
    const hy = surfY + (h - surfY) * 0.5;
    const s = Math.min(w, h) * 0.09;
    ctx.beginPath();
    ctx.moveTo(hx, hy + s * 0.7);
    ctx.bezierCurveTo(hx - s, hy - s * 0.2, hx - s * 0.5, hy - s, hx, hy - s * 0.35);
    ctx.bezierCurveTo(hx + s * 0.5, hy - s, hx + s, hy - s * 0.2, hx, hy + s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  if (fracture) {
    // Europa's cracked ice: rust-brown fracture lines
    const rng = mulberry(hash(dest.id) ^ 99);
    ctx.strokeStyle = css(fracture, 0.5);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      let px = rng() * w;
      let py = surfY + rng() * (h - surfY);
      ctx.moveTo(px, py);
      for (let k = 0; k < 4; k++) {
        px += (rng() - 0.5) * w * 0.3;
        py += (rng() - 0.3) * 30;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  // rocks with directional shadows (hardness from profile)
  const rng = mulberry(hash(dest.id));
  const lightDir = -1; // key light from upper-left → shadows to the right
  for (let i = 0; i < 16; i++) {
    const rx = rng() * w;
    const ry = surfY + 12 + rng() * (h - surfY - 12);
    const depth = (ry - surfY) / (h - surfY);
    const rr = (2 + rng() * 5) * (0.6 + depth);
    // shadow
    ctx.fillStyle = css(mix(base, [0, 0, 0], 0.5), 0.3 + profile.shadowHard * 0.5);
    ctx.beginPath();
    ctx.ellipse(rx - lightDir * rr * (0.6 + profile.shadowHard * 1.6), ry + rr * 0.3, rr * (0.8 + profile.shadowHard), rr * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // rock, lit
    ctx.fillStyle = css(mix(base, accent, 0.3 + rng() * 0.3));
    ctx.beginPath();
    ctx.ellipse(rx, ry, rr, rr * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(mix(accent, [255, 255, 255], 0.3), 0.5);
    ctx.beginPath();
    ctx.ellipse(rx - rr * 0.3, ry - rr * 0.3, rr * 0.4, rr * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  void timeSec;
  return surfY;
}

/* ---------- driftStop (belts) ---------- */
function drawDriftField(ctx: CanvasRenderingContext2D, w: number, h: number, dest: Destination, profile: LandingProfile, at: number, timeSec: number) {
  const rng = mulberry(hash(dest.id) ^ 55);
  const icy = dest.id === 'kuiper';
  for (let i = 0; i < 22; i++) {
    const depth = 0.3 + rng() * 0.9;
    const bx = (rng() * w * 1.4 - w * 0.2 + timeSec * 4 * (1 - at) * depth) % (w * 1.4);
    const by = rng() * h;
    const rr = (3 + rng() * 10) * depth;
    const rot = timeSec * (0.2 + rng() * 0.3) * (rng() > 0.5 ? 1 : -1);
    ctx.save();
    ctx.translate(bx < 0 ? bx + w * 1.2 : bx, by);
    ctx.rotate(rot);
    ctx.globalAlpha = 0.5 + depth * 0.4;
    const col = icy ? mix(profile.surface.base, [200, 220, 240], 0.4) : profile.surface.base;
    ctx.fillStyle = css(mix(col, [0, 0, 0], 0.2));
    ctx.beginPath();
    ctx.moveTo(-rr, 0);
    ctx.lineTo(-rr * 0.4, -rr * 0.7);
    ctx.lineTo(rr * 0.6, -rr * 0.5);
    ctx.lineTo(rr, rr * 0.2);
    ctx.lineTo(rr * 0.2, rr * 0.8);
    ctx.lineTo(-rr * 0.6, rr * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(mix(profile.surface.accent, [255, 255, 255], icy ? 0.4 : 0.1), 0.6);
    ctx.beginPath();
    ctx.ellipse(-rr * 0.3, -rr * 0.3, rr * 0.35, rr * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* ---------- station (dock) ---------- */
function drawStation(ctx: CanvasRenderingContext2D, w: number, h: number, at: number) {
  // Earth limb across the bottom with a bright atmosphere line
  const horizon = h * 0.72;
  const eg = ctx.createLinearGradient(0, horizon, 0, h);
  eg.addColorStop(0, '#2f6ea0');
  eg.addColorStop(1, '#12314f');
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h + w * 0.4, w * 0.9, w * 0.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,200,235,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h + w * 0.4, w * 0.9, w * 0.5, 0, Math.PI, 0);
  ctx.stroke();
  // station drifts in from the right, settling as we dock
  const sx = lerp(w * 0.9, w * 0.62, easeOut(at));
  const sy = h * 0.4;
  const u = Math.min(w, h) * 0.05;
  ctx.save();
  ctx.translate(sx, sy);
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#26314f';
    ctx.fillRect(side > 0 ? u * 0.9 : -u * 3.2, -u * 0.3, u * 2.3, u * 0.6);
  }
  ctx.fillStyle = '#c4cadb';
  ctx.beginPath();
  ctx.roundRect(-u, -u * 0.35, u * 2, u * 0.7, u * 0.3);
  ctx.fill();
  ctx.fillStyle = 'rgba(232,180,90,0.9)';
  ctx.beginPath();
  ctx.arc(u * 1.05, 0, Math.max(2, u * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- main ---------- */
export function drawLandingFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dest: Destination,
  profile: LandingProfile,
  at: number,
  timeSec: number,
  drawStars: (alpha: number) => void,
) {
  if (!puffSprite) puffSprite = makePuff();
  const dt = lastT > 0 ? Math.min(0.1, timeSec - lastT) : 0.016;
  lastT = timeSec;

  const airless = profile.atmosphere === 'none';
  const d = easeOut(at); // descent progress (ease-out deceleration)

  // ---- sky morph (continuous) ----
  const { top, bottom } = skyAt(profile, d);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, css(top));
  sky.addColorStop(1, css(bottom));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // ---- stars: to the surface on airless bodies; fade into atmosphere otherwise ----
  const starsAlpha = airless ? 1 : Math.max(0, 1 - profile.haze * smoothstep(0.1, 0.7, d));
  if (starsAlpha > 0.01) drawStars(starsAlpha);

  // ---- signature backdrop ----
  if (profile.signature === 'earth') drawEarth(ctx, w, h);
  if (profile.signature === 'jupiter') drawJupiterHorizon(ctx, w, h, d);
  if (profile.signature === 'rings') drawRings(ctx, w, h, timeSec, at);

  // ---- mode scene ----
  let groundY = h * 1.5;
  if (profile.mode === 'land') {
    groundY = drawSurface(ctx, w, h, dest, profile, d, timeSec);
  } else if (profile.mode === 'orbit') {
    drawCloudTops(ctx, w, h, profile, d, timeSec);
    if (profile.signature === 'darkSpot') {
      ctx.fillStyle = 'rgba(20,34,70,0.6)';
      ctx.beginPath();
      ctx.ellipse(w * 0.42 - (timeSec * 6) % (w * 1.2), h * 0.72, w * 0.09, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (profile.signature === 'faintRings') {
      ctx.strokeStyle = 'rgba(200,224,228,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.44, w * 0.6, h * 0.05, -0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (profile.mode === 'dock') {
    drawStation(ctx, w, h, at);
  } else if (profile.mode === 'driftStop') {
    drawDriftField(ctx, w, h, dest, profile, at, timeSec);
  }

  // ---- craft descent (ease-out), retro-burn, sway settling ----
  const restY = profile.mode === 'land' ? Math.min(groundY - 32, h * 0.62) : profile.mode === 'dock' ? h * 0.4 : h * 0.42;
  const startY = h * 0.14;
  const craftY = lerp(startY, restY, d);
  const settled = smoothstep(0.86, 1, at);
  const bob = profile.mode === 'orbit' ? Math.sin(timeSec * 1.1) * 3 * (1 - settled * 0.4) : 0;
  const swaySettle = 1 - smoothstep(0.6, 0.92, at);
  const sway = Math.sin(timeSec * 2.6) * 0.03 * swaySettle;
  // thrust: strong through the burn, cut at touchdown (land) or eased to hover (orbit)
  const burn = smoothstep(0.12, 0.32, at);
  const cut = profile.mode === 'land' ? 1 - smoothstep(0.82, 0.92, at) : 0.35 + 0.15 * Math.sin(timeSec * 3);
  const thrust = burn * cut;
  const heat = airless ? 0 : smoothstep(0.05, 0.2, at) * (1 - smoothstep(0.42, 0.62, at));
  const craftX = w * 0.5 + (profile.mode === 'dock' ? lerp(-w * 0.16, 0, easeOut(at)) : 0);

  // plasma wisps trailing up during atmospheric entry
  if (heat > 0.25) {
    ctx.strokeStyle = `rgba(255,150,90,${0.3 * heat})`;
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(craftX + s * 8, craftY + 20);
      ctx.quadraticCurveTo(craftX + s * 20, craftY - 20, craftX + s * 10, craftY - 60);
      ctx.stroke();
    }
  }

  drawLander(ctx, craftX, craftY + bob, timeSec, thrust, sway, heat, profile.lightTemp);

  // ---- touchdown dust ----
  if (profile.mode === 'land') {
    const nearGround = at > 0.8 && craftY > startY;
    if (nearGround && !touchdownFired) touchdownFired = true;
    if (touchdownFired && at < 0.98) {
      const spawn = profile.dustFall === 'fast' ? 3 : 4;
      for (let i = 0; i < spawn; i++) {
        if (puffs.length >= MAX_PUFFS) break;
        const dir = Math.random() > 0.5 ? 1 : -1;
        const fast = profile.dustFall === 'fast';
        puffs.push({
          x: craftX + dir * (6 + Math.random() * 14),
          y: craftY + 28,
          vx: dir * (fast ? 60 + Math.random() * 80 : 30 + Math.random() * 50),
          vy: fast ? -80 - Math.random() * 60 : -18 - Math.random() * 24,
          r: fast ? 2 + Math.random() * 3 : 6 + Math.random() * 8,
          vr: fast ? 2 : 16,
          life: 0,
          max: fast ? 0.9 : 1.8,
          tint: profile.dust,
        });
      }
    }
  }
  // integrate + draw dust (airless = fast, straight parabola; atmo = slow billow)
  const grav = profile.dustFall === 'fast' ? 320 : 60;
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    p.life += dt;
    if (p.life >= p.max) {
      puffs.splice(i, 1);
      continue;
    }
    p.vy += grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (profile.dustFall === 'slow') p.vx *= 1 - 0.9 * dt;
    p.r += p.vr * dt;
    const fade = 1 - p.life / p.max;
    ctx.globalAlpha = (profile.dustFall === 'fast' ? 0.5 : 0.4) * fade * fade;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    // tint the white puff sprite
    ctx.drawImage(tintPuff(p.tint), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ---- crushing-atmosphere haze veil (thick bodies), building as we descend ----
  if (profile.haze > 0.4) {
    const veil = profile.haze * smoothstep(0.3, 1, d) * 0.4;
    ctx.fillStyle = css(bottom, veil);
    ctx.fillRect(0, 0, w, h);
  }
}

// small tinted-puff cache keyed by colour
const tintCache = new Map<string, HTMLCanvasElement>();
function tintPuff(tint: Rgb): HTMLCanvasElement {
  const key = tint.join(',');
  let c = tintCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.drawImage(puffSprite!, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = css(tint);
  g.fillRect(0, 0, 64, 64);
  tintCache.set(key, c);
  return c;
}

/** Grain + vignette finishing pass; fades out as the arrival card takes over. */
export function drawLandingPost(ctx: CanvasRenderingContext2D, w: number, h: number, at: number) {
  if (!noiseSprite) noiseSprite = makeNoise();
  const fade = 1 - smoothstep(0.9, 1, at);
  if (fade < 0.02) return;
  ctx.save();
  ctx.globalAlpha = 0.5 * fade;
  const ox = (Math.random() * 160) | 0;
  const oy = (Math.random() * 160) | 0;
  const pat = ctx.createPattern(noiseSprite, 'repeat')!;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w + 160, h + 160);
  ctx.restore();
  // vignette
  const vg = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.42, w / 2, h * 0.5, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(4,6,14,0)');
  vg.addColorStop(1, `rgba(4,6,14,${0.3 * fade})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

export const clearTintCache = () => tintCache.clear();
