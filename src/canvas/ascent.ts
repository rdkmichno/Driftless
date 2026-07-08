/**
 * Takeoff sequence: ignition anticipation → liftoff → parallax cloud ascent →
 * edge of space, resolving into the flight map. Pure Canvas 2D, flat-vector
 * style in the app palette, but with depth: 6 parallax layers, directionally
 * lit clouds (sun upper-left), a living exhaust plume with smoke particles,
 * god rays, speed streaks, a horizon curve at altitude, and a grain +
 * vignette + bloom finishing pass.
 *
 * Everything transient (particles, sprites, offscreen buffers) is released
 * via teardownAscent() once the session view takes over.
 */

export const ASCENT_MS = 5000;

/* ---------- small math helpers ---------- */

type Rgb = [number, number, number];
const hex = (s: string): Rgb => {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const css = (c: Rgb, a = 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
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

/* ---------- sky ---------- */

// gradient stops interpolated per frame — a continuous morph, never a swap
const SKY: [number, Rgb, Rgb][] = [
  [0.0, hex('#4f7fae'), hex('#a3c3dd')],
  [0.38, hex('#2a4676'), hex('#537099')],
  [0.7, hex('#101838'), hex('#1c2c55')],
  [1.0, hex('#070b1a'), hex('#0d1230')],
];

function skyColors(alt: number): { top: Rgb; bottom: Rgb } {
  let i = 0;
  while (i < SKY.length - 2 && alt > SKY[i + 1][0]) i++;
  const [a0, t0, b0] = SKY[i];
  const [a1, t1, b1] = SKY[i + 1];
  const t = clamp01((alt - a0) / (a1 - a0));
  return { top: mix(t0, t1, t), bottom: mix(b0, b1, t) };
}

/* ---------- prerendered sprites (built lazily, freed on teardown) ---------- */

type Sprites = {
  clouds: HTMLCanvasElement[];
  puffCool: HTMLCanvasElement;
  puffWarm: HTMLCanvasElement;
  noise: HTMLCanvasElement;
  vignette: HTMLCanvasElement | null;
  vignetteW: number;
  vignetteH: number;
};

let sprites: Sprites | null = null;

function makeCloudSprite(rnd: () => number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 280;
  c.height = 140;
  const g = c.getContext('2d')!;
  const blobs: [number, number, number, number][] = [];
  const n = 6 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const bx = 40 + (200 / n) * i + (rnd() - 0.5) * 26;
    const by = 86 + (rnd() - 0.5) * 18;
    const brx = 26 + rnd() * 34;
    blobs.push([bx, by, brx, brx * (0.5 + rnd() * 0.2)]);
  }
  const silhouette = () => {
    g.beginPath();
    for (const [bx, by, brx, bry] of blobs) g.ellipse(bx, by, brx, bry, 0, 0, Math.PI * 2);
  };
  // lit body
  g.fillStyle = '#e9edf4';
  silhouette();
  g.fill();
  // directional shading: soft dark pool along the underside, clipped inside
  g.save();
  silhouette();
  g.clip();
  const shade = g.createLinearGradient(0, 30, 0, 140);
  shade.addColorStop(0, 'rgba(90, 110, 150, 0)');
  shade.addColorStop(0.55, 'rgba(90, 110, 150, 0.28)');
  shade.addColorStop(1, 'rgba(70, 88, 126, 0.5)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 280, 140);
  // sun-side rim (upper-left): light sweep
  const rim = g.createLinearGradient(40, 30, 180, 120);
  rim.addColorStop(0, 'rgba(255, 250, 238, 0.5)');
  rim.addColorStop(0.4, 'rgba(255, 250, 238, 0)');
  g.fillStyle = rim;
  g.fillRect(0, 0, 280, 140);
  g.restore();
  return c;
}

function makePuff(warm: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  if (warm) {
    grad.addColorStop(0, 'rgba(245, 214, 160, 0.9)');
    grad.addColorStop(0.4, 'rgba(214, 178, 140, 0.5)');
    grad.addColorStop(1, 'rgba(180, 160, 150, 0)');
  } else {
    grad.addColorStop(0, 'rgba(226, 230, 238, 0.8)');
    grad.addColorStop(0.5, 'rgba(200, 206, 218, 0.35)');
    grad.addColorStop(1, 'rgba(190, 196, 210, 0)');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

function makeNoise(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const g = c.getContext('2d')!;
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() < 0.5 ? 14 : 0;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function ensureSprites(): Sprites {
  if (sprites) return sprites;
  const rnd = mulberry(1337);
  sprites = {
    clouds: [makeCloudSprite(rnd), makeCloudSprite(rnd), makeCloudSprite(rnd), makeCloudSprite(rnd)],
    puffCool: makePuff(false),
    puffWarm: makePuff(true),
    noise: makeNoise(),
    vignette: null,
    vignetteW: 0,
    vignetteH: 0,
  };
  return sprites;
}

function vignetteFor(w: number, h: number): HTMLCanvasElement {
  const s = ensureSprites();
  if (s.vignette && s.vignetteW === w && s.vignetteH === h) return s.vignette;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.42, w / 2, h * 0.5, Math.hypot(w, h) * 0.62);
  grad.addColorStop(0, 'rgba(4, 6, 14, 0)');
  grad.addColorStop(1, 'rgba(4, 6, 14, 0.30)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  s.vignette = c;
  s.vignetteW = w;
  s.vignetteH = h;
  return c;
}

/* ---------- cloud field (hand-varied, organic — not a grid) ---------- */

type CloudSpec = { sprite: number; x: number; alt: number; scale: number; alpha: number; depth: number; flip: boolean };

let cloudField: CloudSpec[] | null = null;

function ensureClouds(): CloudSpec[] {
  if (cloudField) return cloudField;
  const rnd = mulberry(9042);
  const field: CloudSpec[] = [];
  // distant, hazy, slow (atmospheric perspective: faint, low contrast)
  for (let i = 0; i < 5; i++) {
    field.push({ sprite: i % 4, x: rnd(), alt: 0.16 + rnd() * 0.42, scale: 0.35 + rnd() * 0.3, alpha: 0.1 + rnd() * 0.08, depth: 0.35, flip: rnd() > 0.5 });
  }
  // mid layer
  for (let i = 0; i < 6; i++) {
    field.push({ sprite: (i + 1) % 4, x: rnd(), alt: 0.18 + rnd() * 0.4, scale: 0.7 + rnd() * 0.5, alpha: 0.3 + rnd() * 0.2, depth: 0.65, flip: rnd() > 0.5 });
  }
  // near layer — defined, saturated, quick
  for (let i = 0; i < 5; i++) {
    field.push({ sprite: (i + 2) % 4, x: 0.08 + rnd() * 0.84, alt: 0.2 + rnd() * 0.36, scale: 1.2 + rnd() * 0.8, alpha: 0.5 + rnd() * 0.25, depth: 1.0, flip: rnd() > 0.5 });
  }
  // foreground wisps that whip past the camera (drawn huge + soft)
  for (let i = 0; i < 4; i++) {
    field.push({ sprite: i % 4, x: rnd(), alt: 0.22 + rnd() * 0.3, scale: 3.4 + rnd() * 1.6, alpha: 0.1 + rnd() * 0.05, depth: 1.7, flip: rnd() > 0.5 });
  }
  cloudField = field;
  return field;
}

/* ---------- particles ---------- */

type Puff = { x: number; y: number; vx: number; vy: number; r: number; vr: number; life: number; maxLife: number; warm: boolean; grounded: boolean };
type Streak = { x: number; y: number; len: number; depth: number };
type Wisp = { born: number; side: number };

const puffs: Puff[] = [];
let streaks: Streak[] | null = null;
let wisps: Wisp[] = [];
let lastFrameT = 0;
let lastGroundTop = 0;
let lastWispT = 0;

const MAX_PUFFS = 56;

function spawnPuff(p: Puff) {
  if (puffs.length >= MAX_PUFFS) puffs.shift();
  puffs.push(p);
}

export function teardownAscent() {
  puffs.length = 0;
  streaks = null;
  wisps = [];
  cloudField = null;
  sprites = null; // sprites are cheap to rebuild on the next launch
  lastFrameT = 0;
}

/* ---------- rocket ---------- */

function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, timeSec: number, thrust: number, sway: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);

  // exhaust plume: layered, flickering, alive
  if (thrust > 0.02) {
    const flick = 0.82 + 0.18 * Math.sin(timeSec * 33) * Math.cos(timeSec * 19 + 1.3);
    const wob = Math.sin(timeSec * 21) * 2.2;
    const len = (30 + thrust * 58) * flick;
    // soft outer glow (bloom)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 34, 2, 0, 34, 30 + thrust * 26);
    halo.addColorStop(0, `rgba(232, 180, 90, ${0.34 * flick})`);
    halo.addColorStop(1, 'rgba(232, 180, 90, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 34, 30 + thrust * 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // warm sheath — billowing edges via wobbling control points
    const sheath = ctx.createLinearGradient(0, 28, 0, 28 + len);
    sheath.addColorStop(0, 'rgba(245, 206, 130, 0.9)');
    sheath.addColorStop(0.5, 'rgba(232, 180, 90, 0.45)');
    sheath.addColorStop(1, 'rgba(150, 110, 90, 0)');
    ctx.fillStyle = sheath;
    ctx.beginPath();
    ctx.moveTo(-7, 27);
    ctx.quadraticCurveTo(-10 - wob, 27 + len * 0.5, wob * 0.6, 27 + len);
    ctx.quadraticCurveTo(10 - wob, 27 + len * 0.5, 7, 27);
    ctx.closePath();
    ctx.fill();
    // hot core
    const coreLen = len * 0.5;
    const core = ctx.createLinearGradient(0, 28, 0, 28 + coreLen);
    core.addColorStop(0, `rgba(255, 246, 220, ${0.95 * flick})`);
    core.addColorStop(1, 'rgba(255, 236, 190, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(-3.4, 27);
    ctx.quadraticCurveTo(wob * 0.4, 27 + coreLen * 0.7, 0, 27 + coreLen);
    ctx.quadraticCurveTo(-wob * 0.4 + 3.4, 27 + coreLen * 0.5, 3.4, 27);
    ctx.closePath();
    ctx.fill();
  }

  // fins
  ctx.fillStyle = '#465579';
  ctx.beginPath();
  ctx.moveTo(-9, 8);
  ctx.quadraticCurveTo(-20, 24, -17, 31);
  ctx.lineTo(-7, 23);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9, 8);
  ctx.quadraticCurveTo(20, 24, 17, 31);
  ctx.lineTo(7, 23);
  ctx.closePath();
  ctx.fill();

  // hull, lit from upper-left
  const body = ctx.createLinearGradient(-11, -20, 12, 10);
  body.addColorStop(0, '#d3d8e6');
  body.addColorStop(0.5, '#9aa2ba');
  body.addColorStop(1, '#5f6780');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.quadraticCurveTo(11, -20, 11, 2);
  ctx.lineTo(11, 24);
  ctx.quadraticCurveTo(0, 30, -11, 24);
  ctx.lineTo(-11, 2);
  ctx.quadraticCurveTo(-11, -20, 0, -34);
  ctx.closePath();
  ctx.fill();
  // engine light reflecting on the underside
  if (thrust > 0.05) {
    const under = ctx.createLinearGradient(0, 27, 0, 12);
    under.addColorStop(0, `rgba(232, 180, 90, ${0.4 * thrust})`);
    under.addColorStop(1, 'rgba(232, 180, 90, 0)');
    ctx.fillStyle = under;
    ctx.beginPath();
    ctx.moveTo(-10.5, 25);
    ctx.quadraticCurveTo(0, 30, 10.5, 25);
    ctx.lineTo(10.5, 12);
    ctx.lineTo(-10.5, 12);
    ctx.closePath();
    ctx.fill();
  }
  // porthole
  ctx.fillStyle = '#1c2c55';
  ctx.beginPath();
  ctx.arc(0, -8, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8b45a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(233, 235, 244, 0.4)';
  ctx.beginPath();
  ctx.arc(-1.8, -9.6, 1.7, 0, Math.PI * 2);
  ctx.fill();
  // nozzle
  ctx.fillStyle = '#3a4665';
  ctx.beginPath();
  ctx.moveTo(-6, 25);
  ctx.lineTo(6, 25);
  ctx.lineTo(8, 31);
  ctx.lineTo(-8, 31);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/* ---------- main frame ---------- */

export function drawAscentFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  at: number,
  timeSec: number,
): { starsAlpha: number; mapAlpha: number } {
  const s = ensureSprites();
  const dt = lastFrameT > 0 ? Math.min(0.1, timeSec - lastFrameT) : 0.016;
  lastFrameT = timeSec;

  // ---- timing: anticipation (0–0.1) → climb (ease-in) ----
  const ignition = smoothstep(0.02, 0.07, at); // engine builds during the hold
  const release = smoothstep(0.1, 0.14, at); // the moment it lets go
  const climb = clamp01((at - 0.1) / 0.9);
  const alt = climb ** 1.85; // slow, weighty, then building
  const speed = 1.85 * Math.max(0.001, climb) ** 0.85; // d(alt)/d(climb), for motion cues
  const mapAlpha = smoothstep(0.87, 1, at);

  // ---- ignition screen shake, damping quickly ----
  const shakeAmp = ignition * (1 - smoothstep(0.12, 0.24, at)) * 3.5;
  const shakeX = shakeAmp * Math.sin(timeSec * 71);
  const shakeY = shakeAmp * 0.6 * Math.sin(timeSec * 57 + 2);
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // ---- sky: continuous per-stop interpolation ----
  const { top, bottom } = skyColors(alt);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, css(top));
  sky.addColorStop(1, css(bottom));
  ctx.fillStyle = sky;
  ctx.fillRect(-8, -8, w + 16, h + 16);

  // ---- sun: soft warm disc upper-left, washing out as air thins ----
  const sunAlpha = 0.5 * (1 - smoothstep(0.35, 0.6, alt));
  if (sunAlpha > 0.01) {
    const sun = ctx.createRadialGradient(w * 0.18, h * 0.17, 4, w * 0.18, h * 0.17, 130);
    sun.addColorStop(0, `rgba(250, 240, 216, ${sunAlpha})`);
    sun.addColorStop(0.35, `rgba(248, 232, 196, ${sunAlpha * 0.35})`);
    sun.addColorStop(1, 'rgba(248, 232, 196, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h * 0.6);
  }

  // ---- distant haze hills (slow parallax, atmospheric perspective) ----
  const hazeTop = h * 0.76 + alt * h * 1.9;
  if (hazeTop < h + 40) {
    ctx.fillStyle = 'rgba(93, 122, 148, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, hazeTop + 26);
    ctx.quadraticCurveTo(w * 0.22, hazeTop - 12, w * 0.5, hazeTop + 10);
    ctx.quadraticCurveTo(w * 0.76, hazeTop + 28, w, hazeTop + 2);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  }

  // ---- ground + pad (fast parallax) ----
  const groundTop = h * 0.8 + alt * h * 2.7;
  const groundDelta = lastGroundTop > 0 ? groundTop - lastGroundTop : 0;
  lastGroundTop = groundTop;
  const px = w / 2;
  if (groundTop < h + 80) {
    ctx.fillStyle = '#2e4a46';
    ctx.beginPath();
    ctx.moveTo(0, groundTop + 24);
    ctx.quadraticCurveTo(w * 0.3, groundTop - 26, w * 0.62, groundTop + 8);
    ctx.quadraticCurveTo(w * 0.85, groundTop + 30, w, groundTop + 14);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#243b38';
    ctx.fillRect(0, groundTop + 40, w, Math.max(0, h - groundTop - 40) + 4);

    // warm pool of engine light on the pad at ignition
    if (ignition > 0.05 && release < 1) {
      const pool = ctx.createRadialGradient(px, groundTop, 4, px, groundTop, 130 * ignition);
      pool.addColorStop(0, `rgba(232, 180, 90, ${0.4 * ignition * (1 - release)})`);
      pool.addColorStop(1, 'rgba(232, 180, 90, 0)');
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.ellipse(px, groundTop, 150, 46, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // platform + gantry
    ctx.fillStyle = '#1e2750';
    ctx.fillRect(px - 52, groundTop - 4, 104, 10);
    ctx.fillStyle = '#182040';
    ctx.fillRect(px - 44, groundTop + 6, 8, 26);
    ctx.fillRect(px + 36, groundTop + 6, 8, 26);
    ctx.fillStyle = '#26314f';
    ctx.fillRect(px + 34, groundTop - 92, 10, 88);
    ctx.strokeStyle = 'rgba(38, 49, 79, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + 34, groundTop - 78);
    ctx.lineTo(px + 16, groundTop - 66);
    ctx.stroke();
  }

  // ---- rocket position: settle → release → climb to cruise height ----
  const padY = groundTop - 40;
  const settle = 2.5 * ignition * (1 - release); // pre-liftoff shudder-settle
  const cruiseY = h * 0.42;
  const rocketY = padY + settle + (cruiseY - padY) * smoothstep(0.1, 0.32, at);
  const sway = Math.sin(timeSec * 3.1) * 0.03 * release * (1 - smoothstep(0.55, 0.8, at));
  const thrust = ignition * (0.55 + 0.45 * release);

  // ---- smoke particles ----
  if (thrust > 0.1) {
    const nozzleY = rocketY + 30;
    if (release < 0.9 && groundTop - nozzleY < 90) {
      // pad smoke blooms outward along the ground
      for (let i = 0; i < 2; i++) {
        const dir = Math.random() > 0.5 ? 1 : -1;
        spawnPuff({
          x: px + dir * (12 + Math.random() * 24),
          y: groundTop - 4 - Math.random() * 6,
          vx: dir * (30 + Math.random() * 70) * ignition,
          vy: -6 - Math.random() * 14,
          r: 7 + Math.random() * 9,
          vr: 14 + Math.random() * 10,
          life: 0,
          maxLife: 1.6 + Math.random() * 0.9,
          warm: Math.random() < 0.35,
          grounded: true,
        });
      }
    }
    if (release > 0.2) {
      // in-flight trail: streams behind, thinning with altitude
      spawnPuff({
        x: px + (Math.random() - 0.5) * 6 * (1 - alt),
        y: nozzleY + 10,
        vx: (Math.random() - 0.5) * 18,
        vy: 60 + speed * 160,
        r: 5 + Math.random() * 5 * (1 - alt * 0.6),
        vr: 10 + Math.random() * 8,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.5,
        warm: Math.random() < 0.3,
        grounded: false,
      });
    }
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      puffs.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt + (p.grounded ? groundDelta : 0);
    p.vx *= 1 - 0.8 * dt;
    p.r += p.vr * dt;
    const fade = 1 - p.life / p.maxLife;
    const sprite = p.warm && p.life < 0.35 ? s.puffWarm : s.puffCool;
    ctx.globalAlpha = 0.5 * fade * fade;
    ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  ctx.globalAlpha = 1;

  // ---- clouds: 4 depth bands, sun-lit sprites, organic placement ----
  const cloudGlobal = 1 - smoothstep(0.58, 0.78, alt);
  if (cloudGlobal > 0.01) {
    for (const c of ensureClouds()) {
      const y = h * 0.46 + (alt - c.alt) * h * (1.5 + c.depth * 2.6);
      const sw = 280 * c.scale;
      const sh = 140 * c.scale;
      if (y < -sh || y > h + sh) continue;
      const appear = smoothstep(c.alt - 0.16, c.alt - 0.05, alt);
      const a = c.alpha * cloudGlobal * Math.max(appear, alt > c.alt ? 1 : 0);
      if (a < 0.01) continue;
      ctx.globalAlpha = a;
      const cx = c.x * w + Math.sin(timeSec * 0.05 + c.alt * 20) * 5;
      ctx.save();
      ctx.translate(cx, y);
      if (c.flip) ctx.scale(-1, 1);
      ctx.drawImage(s.clouds[c.sprite], -sw / 2, -sh / 2, sw, sh);
      // warm rim from the passing engine on near clouds
      if (c.depth >= 1 && Math.abs(y - rocketY) < 150 && thrust > 0.3) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.5 * (1 - Math.abs(y - rocketY) / 150);
        const warm = ctx.createRadialGradient(0, 0, 4, 0, 0, sw * 0.4);
        warm.addColorStop(0, 'rgba(232, 180, 90, 0.35)');
        warm.addColorStop(1, 'rgba(232, 180, 90, 0)');
        ctx.fillStyle = warm;
        ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // god rays through the cloud band — very subtle, from the sun
    const rayAlpha = 0.032 * smoothstep(0.08, 0.2, alt) * cloudGlobal;
    if (rayAlpha > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(w * 0.18, h * 0.17);
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(0.55 + i * 0.22 + Math.sin(timeSec * 0.1 + i) * 0.02);
        const ray = ctx.createLinearGradient(0, 0, 0, h * 1.4);
        ray.addColorStop(0, `rgba(248, 236, 200, ${rayAlpha})`);
        ray.addColorStop(1, 'rgba(248, 236, 200, 0)');
        ctx.fillStyle = ray;
        ctx.fillRect(-30 - i * 26, 0, 46 + i * 18, h * 1.4);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // ---- speed streaks: sparse fine debris selling velocity ----
  if (at > 0.3 && mapAlpha < 0.5) {
    if (!streaks) {
      const rnd = mulberry(777);
      streaks = Array.from({ length: 11 }, () => ({ x: rnd() * w, y: rnd() * h, len: 20 + rnd() * 44, depth: 0.4 + rnd() * 0.9 }));
    }
    const sAlpha = 0.14 * smoothstep(0.3, 0.45, at) * (1 - mapAlpha * 2);
    ctx.strokeStyle = '#e9ebf4';
    ctx.lineWidth = 1;
    for (const st of streaks) {
      st.y += (260 + speed * 500) * st.depth * dt;
      if (st.y > h + st.len) {
        st.y = -st.len - Math.random() * 60;
        st.x = Math.random() * w;
      }
      ctx.globalAlpha = sAlpha * st.depth;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x, st.y + st.len * st.depth);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- vapor wisps flicking off the nose around max-Q ----
  const maxQ = smoothstep(0.34, 0.4, at) * (1 - smoothstep(0.58, 0.66, at));
  if (maxQ > 0.3 && timeSec - lastWispT > 0.45 && wisps.length < 3) {
    wisps.push({ born: timeSec, side: Math.random() > 0.5 ? 1 : -1 });
    lastWispT = timeSec;
  }
  wisps = wisps.filter((wp) => timeSec - wp.born < 0.38);
  for (const wp of wisps) {
    const age = (timeSec - wp.born) / 0.38;
    ctx.strokeStyle = `rgba(240, 244, 252, ${0.4 * (1 - age)})`;
    ctx.lineWidth = 2 * (1 - age * 0.5);
    ctx.beginPath();
    ctx.arc(px, rocketY - 20, 14 + age * 26, Math.PI * (1.15 + 0.25 * wp.side * age), Math.PI * (1.85 - 0.25 * wp.side * age));
    ctx.stroke();
  }

  // ---- the rocket ----
  ctx.save();
  ctx.globalAlpha = 1 - mapAlpha;
  drawRocket(ctx, px, Math.min(padY + settle, rocketY), timeSec, thrust, sway);
  ctx.restore();

  // ---- horizon curve: the Earth's edge bends into view at altitude ----
  const limb = smoothstep(0.78, 0.95, alt) * (1 - mapAlpha);
  if (limb > 0.01) {
    const R = w * (2.4 - 0.7 * limb);
    const cy = h + R - limb * h * 0.34;
    ctx.save();
    ctx.globalAlpha = limb;
    // dark planet body
    ctx.fillStyle = '#0f1d26';
    ctx.beginPath();
    ctx.arc(w / 2, cy, R, 0, Math.PI * 2);
    ctx.fill();
    // thin atmosphere line hugging the limb
    const atmo = ctx.createRadialGradient(w / 2, cy, R - 2, w / 2, cy, R + 16);
    atmo.addColorStop(0, 'rgba(111, 176, 208, 0.55)');
    atmo.addColorStop(0.35, 'rgba(79, 127, 174, 0.25)');
    atmo.addColorStop(1, 'rgba(79, 127, 174, 0)');
    ctx.fillStyle = atmo;
    ctx.beginPath();
    ctx.arc(w / 2, cy, R + 16, 0, Math.PI * 2);
    ctx.arc(w / 2, cy, Math.max(0, R - 2), 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // shake

  return { starsAlpha: smoothstep(0.62, 0.9, alt), mapAlpha };
}

/**
 * Finishing pass drawn above stars/map during takeoff: film grain + vignette.
 * Fades out as the map takes over so the session view stays pristine.
 */
export function drawAscentPost(ctx: CanvasRenderingContext2D, w: number, h: number, at: number) {
  const s = ensureSprites();
  const fade = 1 - smoothstep(0.87, 1, at);
  if (fade < 0.02) return;
  // grain: jittered noise tile
  ctx.save();
  ctx.globalAlpha = 0.5 * fade;
  const ox = (Math.random() * 160) | 0;
  const oy = (Math.random() * 160) | 0;
  const pat = ctx.createPattern(s.noise, 'repeat')!;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w + 160, h + 160);
  ctx.restore();
  // vignette
  ctx.globalAlpha = fade;
  ctx.drawImage(vignetteFor(w, h), 0, 0);
  ctx.globalAlpha = 1;
}
