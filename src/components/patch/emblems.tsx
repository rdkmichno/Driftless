/**
 * Emblem registry — the per-patch symbolic vector that sits in the centre slot
 * of the shared patch frame. Each emblem is a small set of flat vector shapes
 * that inherit the patch palette [field, primary, secondary, accent]; the frame
 * (Patch.tsx) is responsible for the embroidery (satin sheen, bevel, weave,
 * merrowed border) so the whole collection reads as one stitched series.
 *
 * Emblems draw inside a 100x100 user space centred on (50,50). Keep them clean,
 * legible at small sizes, and free of gradients — the thread sheen comes from
 * the frame's satin overlay, not from the emblem.
 */
import type { ReactNode } from 'react';

export type EmblemProps = {
  /** [field, primary, secondary, accent] — always 3–5 entries. */
  palette: string[];
  /** Roman-numeral / count label for parameterised emblems (wings, flame). */
  label?: string;
};

/** "wings:XXV" -> { base: 'wings', label: 'XXV' }; "ship" -> { base: 'ship' } */
export function parseEmblem(key: string): { base: string; label?: string } {
  const i = key.indexOf(':');
  if (i === -1) return { base: key };
  return { base: key.slice(0, i), label: key.slice(i + 1) };
}

// Palette accessors with safe fallbacks so a 3-colour patch never crashes.
const P = (p: string[], i: number) => p[Math.min(i, p.length - 1)];

const star = (cx: number, cy: number, r: number, fill: string, points = 5): ReactNode => {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (Math.PI / points) * i - Math.PI / 2;
    pts.push(`${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} />;
};

/** A little scatter of fixed stars — deterministic so renders are stable. */
const starfield = (fill: string): ReactNode => {
  const dots = [
    [20, 24, 1.3], [78, 30, 1.6], [30, 74, 1.1], [70, 68, 1.4], [50, 18, 1.2], [16, 52, 1.0], [84, 56, 1.1],
  ];
  return (
    <g fill={fill} opacity={0.85}>
      {dots.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} />
      ))}
    </g>
  );
};

/** A curved trajectory arc — the signature "mission path" motif. */
const arc = (stroke: string, w = 3): ReactNode => (
  <path d="M18 70 Q42 20 84 34" fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" opacity={0.9} />
);

const planet = (cx: number, cy: number, r: number, base: string, accent: string, banded = false): ReactNode => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={base} />
    {banded && (
      <g opacity={0.5} clipPath="url(#emblem-planet-clip)">
        <rect x={cx - r} y={cy - r * 0.5} width={r * 2} height={r * 0.28} fill={accent} />
        <rect x={cx - r} y={cy + r * 0.1} width={r * 2} height={r * 0.2} fill={accent} />
      </g>
    )}
    <circle cx={cx - r * 0.3} cy={cy - r * 0.32} r={r * 0.9} fill="#fff" opacity={0.1} />
  </g>
);

const shipMark = (cx: number, cy: number, s: number, body: string, accent: string): ReactNode => (
  <g transform={`translate(${cx} ${cy}) rotate(-38)`}>
    <path d={`M0 ${-s} Q${s * 0.42} ${-s * 0.2} ${s * 0.42} ${s * 0.7} L${-s * 0.42} ${s * 0.7} Q${-s * 0.42} ${-s * 0.2} 0 ${-s} Z`} fill={body} />
    <circle cx={0} cy={-s * 0.15} r={s * 0.18} fill={accent} />
    <path d={`M${-s * 0.42} ${s * 0.55} L${-s * 0.72} ${s * 0.95} L${-s * 0.2} ${s * 0.7} Z`} fill={accent} />
    <path d={`M${s * 0.42} ${s * 0.55} L${s * 0.72} ${s * 0.95} L${s * 0.2} ${s * 0.7} Z`} fill={accent} />
  </g>
);

/* ---------------- the emblem set ---------------- */

const EMBLEMS: Record<string, (p: EmblemProps) => ReactNode> = {
  // Low Earth Orbit: a station truss with solar wings over the limb of Earth.
  station: ({ palette }) => {
    const [, prim, sec, acc] = [palette[0], P(palette, 1), P(palette, 2), P(palette, 3)];
    return (
      <g>
        <path d="M6 82 A46 46 0 0 1 94 82 Z" fill={acc} opacity={0.5} />
        <rect x={44} y={30} width={12} height={40} rx={3} fill={prim} />
        <rect x={20} y={40} width={22} height={16} rx={2} fill={sec} />
        <rect x={58} y={40} width={22} height={16} rx={2} fill={sec} />
        <circle cx={50} cy={28} r={5} fill={acc} />
      </g>
    );
  },
  // Moon disc with a small Earth hanging behind.
  moonEarth: ({ palette }) => (
    <g>
      {planet(44, 52, 26, P(palette, 1), P(palette, 2))}
      <g opacity={0.85}>
        <circle cx={44} cy={44} r={4} fill={palette[0]} opacity={0.4} />
        <circle cx={54} cy={60} r={5} fill={palette[0]} opacity={0.4} />
        <circle cx={36} cy={58} r={3} fill={palette[0]} opacity={0.4} />
      </g>
      <circle cx={78} cy={28} r={11} fill={P(palette, 3)} />
      <path d="M70 28 h16" stroke="#fff" strokeWidth={2} opacity={0.25} />
    </g>
  ),
  // A banded gas/terrestrial sphere (venus, jupiter).
  sphereBanded: ({ palette }) => (
    <g>
      {planet(50, 50, 30, P(palette, 1), P(palette, 2), true)}
      <ellipse cx={58} cy={40} rx={7} ry={4} fill={P(palette, 3)} opacity={0.7} />
    </g>
  ),
  // A ship arcing over a planet on the horizon (mars).
  shipOverPlanet: ({ palette }) => (
    <g>
      <path d="M4 88 A54 54 0 0 1 96 88 Z" fill={P(palette, 1)} />
      <path d="M4 88 A54 54 0 0 1 96 88" fill="none" stroke={P(palette, 2)} strokeWidth={2} opacity={0.5} />
      {arc(P(palette, 3))}
      {shipMark(70, 34, 13, palette[0] === '#fff' ? '#fff' : '#f0eee6', P(palette, 3))}
      {starfield(P(palette, 3))}
    </g>
  ),
  // A cluster of drifting rocks (belt).
  rocks: ({ palette }) => (
    <g>
      {[[34, 42, 12], [62, 36, 9], [54, 62, 14], [30, 66, 7], [72, 60, 6]].map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={i % 2 ? P(palette, 2) : P(palette, 1)} />
          <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.4} fill="#fff" opacity={0.12} />
        </g>
      ))}
      {starfield(P(palette, 3))}
    </g>
  ),
  // Standing on an icy moon, giant Jupiter filling the sky (europa).
  jupiterHorizon: ({ palette }) => (
    <g>
      <path d="M0 66 A70 70 0 0 1 100 66 L100 100 L0 100 Z" fill={P(palette, 3)} opacity={0.35} />
      <circle cx={50} cy={30} r={26} fill={P(palette, 1)} />
      <g opacity={0.5} clipPath="url(#emblem-jup-clip)">
        <rect x={24} y={22} width={52} height={5} fill={P(palette, 2)} />
        <rect x={24} y={34} width={52} height={4} fill={P(palette, 2)} />
      </g>
      <ellipse cx={44} cy={62} rx={6} ry={3} fill={P(palette, 2)} opacity={0.7} />
      <line x1={0} y1={66} x2={100} y2={66} stroke={P(palette, 2)} strokeWidth={2} opacity={0.6} />
    </g>
  ),
  // A ringed planet (saturn).
  rings: ({ palette }) => (
    <g>
      <ellipse cx={50} cy={52} rx={44} ry={13} fill="none" stroke={P(palette, 1)} strokeWidth={6} opacity={0.9} transform="rotate(-18 50 52)" />
      <ellipse cx={50} cy={52} rx={44} ry={13} fill="none" stroke={P(palette, 3)} strokeWidth={2} opacity={0.8} transform="rotate(-18 50 52)" />
      <circle cx={50} cy={50} r={20} fill={P(palette, 1)} />
      <ellipse cx={50} cy={52} rx={44} ry={13} fill="none" stroke={P(palette, 1)} strokeWidth={6} opacity={0.9} transform="rotate(-18 50 52)" strokeDasharray="0 46 40 100" />
    </g>
  ),
  // Hazy crescent moon with weather (titan).
  crescentHaze: ({ palette }) => (
    <g>
      <circle cx={50} cy={50} r={30} fill={P(palette, 1)} />
      <circle cx={50} cy={50} r={30} fill="none" stroke={P(palette, 3)} strokeWidth={4} opacity={0.4} />
      <path d="M50 20 A30 30 0 0 0 50 80 A22 30 0 0 1 50 20 Z" fill={P(palette, 2)} opacity={0.55} />
      <line x1={26} y1={44} x2={74} y2={44} stroke={P(palette, 3)} strokeWidth={2} opacity={0.5} />
      <line x1={30} y1={58} x2={70} y2={58} stroke={P(palette, 3)} strokeWidth={2} opacity={0.4} />
    </g>
  ),
  // A world tilted on its side, ring vertical (uranus).
  orbitTilt: ({ palette }) => (
    <g>
      <circle cx={50} cy={50} r={22} fill={P(palette, 1)} />
      <ellipse cx={50} cy={50} rx={12} ry={40} fill="none" stroke={P(palette, 3)} strokeWidth={4} opacity={0.85} transform="rotate(12 50 50)" />
      <circle cx={44} cy={42} r={16} fill="#fff" opacity={0.1} />
    </g>
  ),
  // A stormy deep-blue giant (neptune).
  sphereStorm: ({ palette }) => (
    <g>
      {planet(50, 50, 30, P(palette, 1), P(palette, 2), true)}
      <ellipse cx={40} cy={58} rx={9} ry={6} fill={palette[0]} opacity={0.55} />
      <path d="M28 40 Q50 34 72 42" fill="none" stroke={P(palette, 3)} strokeWidth={2.5} opacity={0.7} />
    </g>
  ),
  // Pluto with its famous heart (pluto).
  heart: ({ palette }) => (
    <g>
      <circle cx={50} cy={50} r={30} fill={P(palette, 1)} />
      <path d="M50 68 C34 56 34 40 44 40 C49 40 50 45 50 47 C50 45 51 40 56 40 C66 40 66 56 50 68 Z" fill={P(palette, 3)} />
      <circle cx={38} cy={40} r={3} fill={P(palette, 2)} opacity={0.6} />
    </g>
  ),
  // A comet on the far drift (kuiper).
  comet: ({ palette }) => (
    <g>
      <path d="M20 78 L58 40" stroke={P(palette, 3)} strokeWidth={7} strokeLinecap="round" opacity={0.5} />
      <path d="M28 74 L58 44" stroke={P(palette, 2)} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <circle cx={64} cy={36} r={9} fill={P(palette, 3)} />
      <circle cx={64} cy={36} r={4} fill="#fff" opacity={0.7} />
      {starfield(P(palette, 2))}
    </g>
  ),

  // First flight: a single rocket climbing (hours-first).
  ship: ({ palette }) => (
    <g>
      {arc(P(palette, 3))}
      {shipMark(50, 50, 20, P(palette, 2), P(palette, 3))}
      {starfield(P(palette, 3))}
    </g>
  ),
  // Aviator wings with a roman-numeral hour count (hours-*).
  wings: ({ palette, label }) => {
    const [, prim, , acc] = [palette[0], P(palette, 1), P(palette, 2), P(palette, 3)];
    const feather = (dir: 1 | -1): ReactNode => (
      <g transform={`translate(50 50) scale(${dir} 1)`}>
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M2 ${-4 + i * 4} Q${18 + i * 7} ${-2 + i * 4} ${20 + i * 9} ${6 + i * 3} Q${10 + i * 5} ${2 + i * 4} 2 ${1 + i * 4} Z`}
            fill={prim}
            opacity={1 - i * 0.12}
          />
        ))}
      </g>
    );
    return (
      <g>
        {feather(1)}
        {feather(-1)}
        <circle cx={50} cy={50} r={9} fill={acc} />
        {label && (
          <text x={50} y={50} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill={palette[0]} fontFamily="'JetBrains Mono', monospace">
            {label}
          </text>
        )}
      </g>
    );
  },
  // Streak flame/comet with a day count (streak-*).
  flame: ({ palette, label }) => (
    <g>
      <path d="M50 20 C64 38 66 52 50 78 C34 52 36 38 50 20 Z" fill={P(palette, 1)} />
      <path d="M50 34 C58 46 59 56 50 72 C41 56 42 46 50 34 Z" fill={P(palette, 2)} />
      <path d="M50 48 C54 55 54 60 50 68 C46 60 46 55 50 48 Z" fill={P(palette, 3)} />
      {label && (
        <text x={50} y={62} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill={palette[0]} fontFamily="'JetBrains Mono', monospace">
          {label}
        </text>
      )}
    </g>
  ),
  // Deep space: a lone star in the void (feat-deepspace).
  voidStar: ({ palette }) => (
    <g>
      {starfield(P(palette, 2))}
      {star(50, 50, 20, P(palette, 3))}
      <circle cx={50} cy={50} r={5} fill="#fff" opacity={0.85} />
    </g>
  ),
  // Grand tour: concentric orbit rings with planets (feat-grandtour).
  grandTour: ({ palette }) => (
    <g>
      <circle cx={50} cy={50} r={5} fill={P(palette, 1)} />
      {[16, 26, 36].map((r, i) => (
        <g key={i}>
          <circle cx={50} cy={50} r={r} fill="none" stroke={P(palette, 2)} strokeWidth={1.5} opacity={0.6} />
          <circle cx={50 + r * Math.cos(i * 2)} cy={50 + r * Math.sin(i * 2)} r={3.5} fill={i % 2 ? P(palette, 3) : P(palette, 2)} />
        </g>
      ))}
    </g>
  ),
  // Marathon: a chronometer (feat-marathon).
  chronometer: ({ palette }) => (
    <g>
      <circle cx={50} cy={52} r={26} fill="none" stroke={P(palette, 1)} strokeWidth={5} />
      <circle cx={50} cy={52} r={26} fill={P(palette, 1)} opacity={0.12} />
      <rect x={44} y={18} width={12} height={6} rx={2} fill={P(palette, 2)} />
      <line x1={50} y1={52} x2={50} y2={34} stroke={P(palette, 3)} strokeWidth={3} strokeLinecap="round" />
      <line x1={50} y1={52} x2={64} y2={56} stroke={P(palette, 3)} strokeWidth={3} strokeLinecap="round" />
      <circle cx={50} cy={52} r={3} fill={P(palette, 3)} />
    </g>
  ),
  // Night watch: moon and a star (feat-nightwatch).
  moonStar: ({ palette }) => (
    <g>
      <path d="M62 26 A28 28 0 1 0 62 78 A22 28 0 0 1 62 26 Z" fill={P(palette, 2)} />
      {star(34, 40, 9, P(palette, 3))}
      {starfield(P(palette, 3))}
    </g>
  ),
  // Dawn patrol: a rising sun over a horizon (feat-dawnpatrol).
  sunrise: ({ palette }) => (
    <g>
      <circle cx={50} cy={60} r={18} fill={P(palette, 3)} />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={50} y1={60} x2={50 + 34 * Math.cos(Math.PI + (i / 4) * Math.PI)} y2={60 + 34 * Math.sin(Math.PI + (i / 4) * Math.PI)} stroke={P(palette, 2)} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      ))}
      <rect x={10} y={60} width={80} height={30} fill={P(palette, 1)} />
      <line x1={10} y1={60} x2={90} y2={60} stroke={P(palette, 2)} strokeWidth={2} />
    </g>
  ),
  // Full system: a sun ringed by every world (feat-fullsystem).
  fullSystem: ({ palette }) => (
    <g>
      {star(50, 50, 12, P(palette, 1))}
      <circle cx={50} cy={50} r={30} fill="none" stroke={P(palette, 2)} strokeWidth={1.5} opacity={0.5} />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <circle key={i} cx={50 + 30 * Math.cos(a)} cy={50 + 30 * Math.sin(a)} r={i % 3 === 0 ? 4 : 2.6} fill={i % 2 ? P(palette, 3) : P(palette, 2)} />;
      })}
    </g>
  ),
  // Perseids: a meteor shower (seasonal-perseids).
  meteor: ({ palette }) => (
    <g>
      {[[20, 20], [40, 14], [58, 26]].map(([x, y], i) => (
        <g key={i}>
          <path d={`M${x} ${y} L${x + 22} ${y + 30}`} stroke={P(palette, 2)} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
          <circle cx={x + 22} cy={y + 30} r={3.5} fill={P(palette, 3)} />
        </g>
      ))}
      {starfield(P(palette, 2))}
    </g>
  ),
  // Totality: an eclipse corona (seasonal-eclipse).
  eclipse: ({ palette }) => (
    <g>
      <circle cx={50} cy={50} r={30} fill="none" stroke={P(palette, 2)} strokeWidth={2} opacity={0.5} />
      {Array.from({ length: 20 }).map((_, i) => {
        const a = (i / 20) * Math.PI * 2;
        return <line key={i} x1={50 + 24 * Math.cos(a)} y1={50 + 24 * Math.sin(a)} x2={50 + 34 * Math.cos(a)} y2={50 + 34 * Math.sin(a)} stroke={P(palette, 2)} strokeWidth={1.5} opacity={0.6} />;
      })}
      <circle cx={50} cy={50} r={22} fill={P(palette, 3)} opacity={0.85} />
      <circle cx={50} cy={50} r={18} fill={palette[0]} />
    </g>
  ),
  // Sealed orders: a redacted classification bar (hidden-classified).
  redacted: ({ palette }) => (
    <g>
      <rect x={22} y={38} width={56} height={10} rx={2} fill={P(palette, 2)} />
      <rect x={30} y={54} width={40} height={8} rx={2} fill={P(palette, 2)} opacity={0.7} />
      <path d="M50 20 l6 4 v10 c0 8 -6 12 -6 12 s-6 -4 -6 -12 v-10 z" fill={P(palette, 3)} />
      <text x={50} y={30} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={700} fill={palette[0]} fontFamily="'JetBrains Mono', monospace">?</text>
    </g>
  ),
};

export const EMBLEM_BASES = Object.keys(EMBLEMS);

export function Emblem({ emblem, palette }: { emblem: string; palette: string[] }) {
  const { base, label } = parseEmblem(emblem);
  const render = EMBLEMS[base];
  if (!render) return null;
  return <>{render({ palette, label })}</>;
}
