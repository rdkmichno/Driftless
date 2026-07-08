type Star = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
};

type Layer = {
  depth: number;
  stars: Star[];
  sizeMin: number;
  sizeMax: number;
  alphaMin: number;
  alphaMax: number;
};

type ShootingStar = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number; // 0..1
};

const LAYER_SPECS = [
  { density: 90, depth: 0.25, sizeMin: 0.5, sizeMax: 1.1, alphaMin: 0.2, alphaMax: 0.45 },
  { density: 50, depth: 0.55, sizeMin: 0.8, sizeMax: 1.5, alphaMin: 0.35, alphaMax: 0.65 },
  { density: 22, depth: 1.0, sizeMin: 1.2, sizeMax: 2.2, alphaMin: 0.55, alphaMax: 0.9 },
];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export class Starfield {
  private w: number;
  private h: number;
  private layers: Layer[] = [];
  private speed = 0.6;
  private speedTarget = 0.6;
  private pointer = { x: 0, y: 0 };
  private pointerTarget = { x: 0, y: 0 };
  private t = 0;
  private shooting: ShootingStar | null = null;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.seed();
  }

  private seed() {
    const area = this.w * this.h;
    this.layers = LAYER_SPECS.map((spec) => {
      const count = Math.max(12, Math.min(spec.density * 3, Math.round((spec.density * area) / 1_000_000)));
      const stars: Star[] = Array.from({ length: count }, () => ({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        size: rand(spec.sizeMin, spec.sizeMax),
        alpha: rand(spec.alphaMin, spec.alphaMax),
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: rand(0.3, 1.1),
      }));
      return { depth: spec.depth, stars, sizeMin: spec.sizeMin, sizeMax: spec.sizeMax, alphaMin: spec.alphaMin, alphaMax: spec.alphaMax };
    });
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.seed();
  }

  setSpeedTarget(mult: number) {
    this.speedTarget = mult;
  }

  setPointer(nx: number, ny: number) {
    this.pointerTarget = { x: nx, y: ny };
  }

  step(dt: number) {
    this.t += dt;
    this.speed += (this.speedTarget - this.speed) * Math.min(1, dt * 1.5);
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * Math.min(1, dt * 3);
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * Math.min(1, dt * 3);

    const cx = this.w * 0.5;
    const cy = this.h * 0.42;
    const maxDist = Math.hypot(Math.max(cx, this.w - cx), Math.max(cy, this.h - cy));

    for (const layer of this.layers) {
      for (const s of layer.stars) {
        const rx = s.x - cx;
        const ry = s.y - cy;
        const dist = Math.hypot(rx, ry) || 1;
        const v = (16 + 18 * (dist / maxDist)) * layer.depth * this.speed;
        s.x += (rx / dist) * v * dt;
        s.y += (ry / dist) * v * dt;
        if (s.x < -4 || s.x > this.w + 4 || s.y < -4 || s.y > this.h + 4) {
          const angle = Math.random() * Math.PI * 2;
          const r = rand(30, Math.min(this.w, this.h) * 0.35);
          s.x = cx + Math.cos(angle) * r;
          s.y = cy + Math.sin(angle) * r;
          s.size = rand(layer.sizeMin, layer.sizeMax);
          s.alpha = rand(layer.alphaMin, layer.alphaMax);
        }
      }
    }

    if (this.shooting) {
      this.shooting.life += dt / 0.7;
      this.shooting.x += this.shooting.dx * dt;
      this.shooting.y += this.shooting.dy * dt;
      if (this.shooting.life >= 1) this.shooting = null;
    } else if (Math.random() < dt / 90) {
      const angle = rand(Math.PI * 0.15, Math.PI * 0.35);
      const speed = rand(500, 750);
      this.shooting = {
        x: rand(this.w * 0.1, this.w * 0.7),
        y: rand(0, this.h * 0.35),
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 0,
      };
    }
  }

  draw(ctx: CanvasRenderingContext2D, opts: { skipBackground?: boolean; starsAlpha?: number } = {}) {
    const { w, h } = this;
    if (opts.skipBackground) {
      this.drawStars(ctx, opts.starsAlpha ?? 1);
      return;
    }

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#070b1a');
    bg.addColorStop(0.55, '#0b1026');
    bg.addColorStop(1, '#0d1230');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const teal = ctx.createRadialGradient(w * 0.22, h * 0.3, 0, w * 0.22, h * 0.3, w * 0.7);
    teal.addColorStop(0, 'rgba(58, 95, 107, 0.05)');
    teal.addColorStop(1, 'rgba(58, 95, 107, 0)');
    ctx.fillStyle = teal;
    ctx.fillRect(0, 0, w, h);

    const rose = ctx.createRadialGradient(w * 0.8, h * 0.72, 0, w * 0.8, h * 0.72, w * 0.6);
    rose.addColorStop(0, 'rgba(107, 74, 85, 0.04)');
    rose.addColorStop(1, 'rgba(107, 74, 85, 0)');
    ctx.fillStyle = rose;
    ctx.fillRect(0, 0, w, h);

    this.drawStars(ctx, 1);

    this.drawShooting(ctx);
  }

  private drawStars(ctx: CanvasRenderingContext2D, alphaMult: number) {
    ctx.fillStyle = '#e9ebf4';
    for (const layer of this.layers) {
      const ox = this.pointer.x * 14 * layer.depth;
      const oy = this.pointer.y * 10 * layer.depth;
      for (const s of layer.stars) {
        const tw = 0.82 + 0.18 * Math.sin(this.t * s.twinkleSpeed + s.twinklePhase);
        ctx.globalAlpha = s.alpha * tw * alphaMult;
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawShooting(ctx: CanvasRenderingContext2D) {
    if (this.shooting) {
      const sh = this.shooting;
      const fade = Math.sin(sh.life * Math.PI); // in-out
      const len = 130;
      const nx = sh.dx / Math.hypot(sh.dx, sh.dy);
      const ny = sh.dy / Math.hypot(sh.dx, sh.dy);
      const grad = ctx.createLinearGradient(sh.x - nx * len, sh.y - ny * len, sh.x, sh.y);
      grad.addColorStop(0, 'rgba(233, 235, 244, 0)');
      grad.addColorStop(1, `rgba(233, 235, 244, ${0.55 * fade})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sh.x - nx * len, sh.y - ny * len);
      ctx.lineTo(sh.x, sh.y);
      ctx.stroke();
    }
  }
}
