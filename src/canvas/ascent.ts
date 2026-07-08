/**
 * Takeoff sequence: ground pad → liftoff → parallax clouds → space.
 * Pure Canvas 2D, flat-vector style, same palette family as the space view.
 * The sky interpolates continuously from daylight to the app's space navy —
 * never a hard switch. Returns per-frame alphas so SceneCanvas can composite
 * the starfield and the flight-map handoff on top.
 */

export const ASCENT_MS = 4200;

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

// sky keyframes by altitude: [altitude, topColor, bottomColor]
const SKY: [number, Rgb, Rgb][] = [
  [0.0, hex('#4f7fae'), hex('#a3c3dd')], // soft daylight, same cool family
  [0.4, hex('#2a4676'), hex('#4f7099')], // upper atmosphere
  [0.72, hex('#101838'), hex('#1c2c55')], // edge of space
  [1.0, hex('#070b1a'), hex('#0d1230')], // existing space navy
];

function skyColors(alt: number): { top: Rgb; bottom: Rgb } {
  let i = 0;
  while (i < SKY.length - 2 && alt > SKY[i + 1][0]) i++;
  const [a0, t0, b0] = SKY[i];
  const [a1, t1, b1] = SKY[i + 1];
  const t = Math.min(1, Math.max(0, (alt - a0) / (a1 - a0)));
  return { top: mix(t0, t1, t), bottom: mix(b0, b1, t) };
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// deterministic cloud field
const clouds = (() => {
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const layers = [0.45, 0.7, 1].map((depth, li) =>
    Array.from({ length: 6 }, () => ({
      depth,
      x: rnd(), // 0..1 of width
      alt: 0.14 + rnd() * 0.5, // world altitude where this cloud lives
      scale: 0.5 + rnd() * 0.9,
      alpha: (0.16 + rnd() * 0.14) * (li === 2 ? 1.3 : 1),
    })),
  );
  return layers.flat();
})();

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number) {
  ctx.fillStyle = `rgba(233, 235, 244, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, 70 * s, 18 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 40 * s, y + 4 * s, 38 * s, 13 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 42 * s, y + 5 * s, 42 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 8 * s, y - 12 * s, 34 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, timeSec: number, thrust: number) {
  ctx.save();
  ctx.translate(x, y);
  if (thrust > 0.05) ctx.rotate(Math.sin(timeSec * 2.2) * 0.02 * thrust);

  // exhaust plume (behind body)
  if (thrust > 0.02) {
    const flick = 0.85 + 0.15 * Math.sin(timeSec * 31) * Math.cos(timeSec * 17);
    const len = (34 + thrust * 46) * flick;
    const plume = ctx.createLinearGradient(0, 30, 0, 30 + len);
    plume.addColorStop(0, 'rgba(245, 206, 130, 0.95)');
    plume.addColorStop(0.45, 'rgba(232, 180, 90, 0.55)');
    plume.addColorStop(1, 'rgba(107, 74, 85, 0)');
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.moveTo(-7, 28);
    ctx.quadraticCurveTo(0, 30 + len * 1.15, 7, 28);
    ctx.closePath();
    ctx.fill();
    // hot core
    ctx.fillStyle = `rgba(255, 244, 214, ${0.75 * flick})`;
    ctx.beginPath();
    ctx.ellipse(0, 32, 3.4, 8 + thrust * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // fins
  ctx.fillStyle = '#465579';
  ctx.beginPath();
  ctx.moveTo(-9, 10);
  ctx.quadraticCurveTo(-20, 26, -17, 32);
  ctx.lineTo(-7, 24);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9, 10);
  ctx.quadraticCurveTo(20, 26, 17, 32);
  ctx.lineTo(7, 24);
  ctx.closePath();
  ctx.fill();

  // body: soft vertical capsule with the ship's hull tones
  const body = ctx.createLinearGradient(-11, 0, 11, 0);
  body.addColorStop(0, '#6f778f');
  body.addColorStop(0.35, '#c4cadb');
  body.addColorStop(1, '#8a92aa');
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

  // porthole
  ctx.fillStyle = '#1c2c55';
  ctx.beginPath();
  ctx.arc(0, -8, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8b45a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // nozzle
  ctx.fillStyle = '#3a4665';
  ctx.beginPath();
  ctx.moveTo(-6, 26);
  ctx.lineTo(6, 26);
  ctx.lineTo(8, 32);
  ctx.lineTo(-8, 32);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draw one frame of the takeoff. `at` 0..1 (0 = sitting on the pad — also used
 * for the countdown phase), `timeSec` for flicker/sway life.
 * Returns alphas for the starfield and flight-map layers composited above.
 */
export function drawAscentFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  at: number,
  timeSec: number,
): { starsAlpha: number; mapAlpha: number } {
  // world altitude: ease-in so liftoff feels weighty, accelerating upward
  const alt = at ** 1.9;

  // --- sky: continuous gradient morph ---
  const { top, bottom } = skyColors(alt);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, css(top));
  sky.addColorStop(1, css(bottom));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // --- ground + pad (recede downward as we climb) ---
  const groundTop = h * 0.8 + alt * h * 2.6;
  if (groundTop < h + 60) {
    // rolling hill silhouette in the muted teal family
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
    ctx.fillRect(0, groundTop + 40, w, h);

    // launch platform + gantry
    const px = w / 2;
    ctx.fillStyle = '#1e2750';
    ctx.fillRect(px - 52, groundTop - 4, 104, 10);
    ctx.fillStyle = '#182040';
    ctx.fillRect(px - 44, groundTop + 6, 8, 26);
    ctx.fillRect(px + 36, groundTop + 6, 8, 26);
    // gantry tower
    ctx.fillStyle = '#26314f';
    ctx.fillRect(px + 34, groundTop - 92, 10, 88);
    ctx.strokeStyle = 'rgba(38, 49, 79, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + 34, groundTop - 78);
    ctx.lineTo(px + 16, groundTop - 66);
    ctx.stroke();
  }

  // --- clouds: parallax layers drifting down as we rise ---
  const cloudFade = 1 - smoothstep(0.6, 0.78, alt);
  if (cloudFade > 0.01) {
    for (const c of clouds) {
      const y = h * 0.45 + (alt - c.alt) * h * (2 + c.depth * 2.4);
      if (y < -60 || y > h + 60) continue;
      const appear = smoothstep(c.alt - 0.14, c.alt - 0.03, alt); // fade in as we approach
      drawCloud(ctx, c.x * w, y, c.scale * (0.7 + c.depth * 0.5), c.alpha * cloudFade * Math.max(appear, alt > c.alt ? 1 : 0));
    }
  }

  // --- rocket ---
  const thrust = smoothstep(0.03, 0.14, at);
  const padY = groundTop - 36;
  const cruiseY = h * 0.42;
  const rocketY = padY + (cruiseY - padY) * smoothstep(0.05, 0.3, at);
  const mapAlpha = smoothstep(0.86, 1, at);
  ctx.save();
  ctx.globalAlpha = 1 - mapAlpha; // rocket hands off to the map craft
  drawRocket(ctx, w / 2, Math.min(padY, rocketY), timeSec, thrust);
  ctx.restore();

  return { starsAlpha: smoothstep(0.68, 0.92, alt), mapAlpha };
}
