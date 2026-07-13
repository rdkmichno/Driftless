/**
 * The one reusable patch frame. Every patch in the collection is this component
 * with different data, which is what makes the set read as a coherent series:
 * the same satin-stitch sheen, the same raised bevel, the same fabric weave and
 * the same merrowed (over-stitched) rim on all of them. Individuality comes only
 * from the per-patch emblem, palette, shape and ring label.
 *
 * Embroidery is simulated in pure SVG:
 *  - feSpecularLighting bevel gives every filled area a raised, threaded relief.
 *  - a fine diagonal line pattern is the satin-stitch thread direction + sheen.
 *  - feTurbulence supplies a restrained fabric-weave under-texture.
 *  - the rim is a thick stroke with a dashed over-stitch on top (the merrow).
 *
 * Locked patches render as a dark "classified" ghost of the same silhouette with
 * a lock glyph and a text label, never revealing the emblem detail, ring label or
 * flavor. Nothing here animates — the reveal moment animates the frame from
 * outside; the wall renders these statically for performance.
 */
import { useId } from 'react';
import type { Patch as PatchData, PatchShape } from '../../data/patches';
import { Emblem } from './emblems';

const LOCKED_PALETTE = ['#0a0e1c', '#1a2340', '#222c4e', '#2c3866'];

// Silhouette shape in a 120x120 box; the emblem lives in the inner 100x100.
function shapePath(shape: PatchShape): string {
  switch (shape) {
    case 'shield':
      return 'M14 22 Q14 15 21 14 L99 14 Q106 15 106 22 L106 58 Q106 92 60 114 Q14 92 14 58 Z';
    case 'rounded-triangle':
      return 'M60 12 Q66 12 69 19 L102 88 Q107 99 95 100 L25 100 Q13 99 18 88 L51 19 Q54 12 60 12 Z';
    case 'circle':
    default:
      return 'M60 8 A52 52 0 1 1 59.99 8 Z';
  }
}

export function Patch({
  patch,
  earned,
  size = 200,
}: {
  patch: PatchData;
  earned: boolean;
  size?: number;
}) {
  const uid = useId().replace(/[:]/g, '');
  const bevel = `bevel-${uid}`;
  const weave = `weave-${uid}`;
  const satin = `satin-${uid}`;
  const face = `face-${uid}`;
  const sheen = `sheen-${uid}`;
  const clip = `clip-${uid}`;
  const ring = `ring-${uid}`;

  const hidden = patch.hidden === true;
  const palette = earned ? patch.palette : LOCKED_PALETTE;
  const [field, primary, secondary, accent] = [
    palette[0],
    palette[Math.min(1, palette.length - 1)],
    palette[Math.min(2, palette.length - 1)],
    palette[Math.min(3, palette.length - 1)],
  ];
  const d = shapePath(patch.shape);

  const label = earned
    ? `${patch.name}, mission patch`
    : hidden
      ? 'Classified mission patch, locked'
      : `${patch.name}, locked mission patch. ${patch.earnHint}`;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        {/* Raised, threaded relief — the single most important embroidery cue. */}
        <filter id={bevel} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="b" />
          <feSpecularLighting in="b" surfaceScale="2.4" specularConstant="0.5" specularExponent="13" lightingColor="#ffffff" result="s">
            <feDistantLight azimuth="235" elevation="58" />
          </feSpecularLighting>
          <feComposite in="s" in2="SourceAlpha" operator="in" result="sc" />
          <feComposite in="SourceGraphic" in2="sc" operator="arithmetic" k1="0" k2="1" k3="0.5" k4="0" />
        </filter>

        {/* Fabric weave under-texture. */}
        <filter id={weave} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="turbulence" baseFrequency="0.9 0.9" numOctaves="2" seed="7" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0" />
        </filter>

        {/* Satin-stitch thread direction: fine diagonal lines catching light. */}
        <pattern id={satin} width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3.2" height="3.2" fill="none" />
          <line x1="0.4" y1="0" x2="0.4" y2="3.2" stroke="#ffffff" strokeWidth="0.7" opacity="0.09" />
          <line x1="1.9" y1="0" x2="1.9" y2="3.2" stroke="#000000" strokeWidth="0.8" opacity="0.10" />
        </pattern>

        {/* Field gradient for a domed, physically-embossed face. */}
        <radialGradient id={face} cx="42%" cy="36%" r="74%">
          <stop offset="0%" stopColor={field} />
          <stop offset="66%" stopColor={field} />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
        </radialGradient>
        <radialGradient id={sheen} cx="38%" cy="30%" r="52%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
        <clipPath id="emblem-planet-clip">
          <circle cx="50" cy="50" r="30" />
        </clipPath>
        <clipPath id="emblem-jup-clip">
          <circle cx="50" cy="30" r="26" />
        </clipPath>

        {/* Circular baseline for the ring label; 50% offset centres it at top. */}
        <path id={ring} d="M60 105 A45 45 0 1 1 60 15 A45 45 0 1 1 60 105" fill="none" />
      </defs>

      {/* soft contact shadow so the patch sits off the board */}
      <path d={d} fill="#000000" opacity="0.35" transform="translate(0 2.5)" filter={`blur(1px)`} />

      <g filter={`url(#${bevel})`}>
        {/* satin-filled field */}
        <path d={d} fill={`url(#${face})`} />
        <g clipPath={`url(#${clip})`}>
          <rect x="0" y="0" width="120" height="120" fill={`url(#${satin})`} />

          {earned ? (
            <g transform="translate(10 10)">
              <Emblem emblem={patch.emblem} palette={patch.palette} />
            </g>
          ) : hidden ? (
            <text x="60" y="58" textAnchor="middle" dominantBaseline="central" fontSize="26" fontWeight="700" fill={secondary} opacity="0.7" fontFamily="'JetBrains Mono', monospace">
              ???
            </text>
          ) : (
            // locked, non-secret: a flat dark ghost of the emblem
            <g transform="translate(10 10)" opacity="0.5">
              <Emblem emblem={patch.emblem} palette={LOCKED_PALETTE} />
            </g>
          )}

          {/* fabric weave + dome sheen, clipped to the face */}
          <rect x="0" y="0" width="120" height="120" filter={`url(#${weave})`} opacity="0.06" />
          <path d={d} fill={`url(#${sheen})`} />
        </g>
      </g>

      {/* Ring label — withheld while locked so the reward stays a surprise. */}
      {earned && (
        <text fill={accent} fontSize="7" fontWeight="600" letterSpacing="0.5" fontFamily="'Space Grotesk Variable', sans-serif">
          <textPath href={`#${ring}`} startOffset="50%" textAnchor="middle">
            {patch.ringLabel}
          </textPath>
        </text>
      )}

      {/* Merrowed border: a thick rim + a dashed over-stitch, identical on every
          patch (shared treatment) but threaded in the patch's own accent. */}
      <path d={d} fill="none" stroke={earned ? accent : '#33406e'} strokeWidth="6" opacity="0.95" />
      <path d={d} fill="none" stroke={earned ? primary : '#1a2340'} strokeWidth="6" strokeDasharray="0.6 2.4" strokeLinecap="round" opacity="0.75" />
      <path d={d} fill="none" stroke="#000000" strokeWidth="1" opacity="0.35" />

      {/* Lock affordance: glyph + text, never colour alone. */}
      {!earned && (
        <g transform="translate(60 82)">
          <rect x="-7" y="-3" width="14" height="11" rx="2.5" fill="#0a0e1c" stroke="#8a94a8" strokeWidth="1.2" />
          <path d="M-4 -3 v-3 a4 4 0 0 1 8 0 v3" fill="none" stroke="#8a94a8" strokeWidth="1.2" />
          <circle cx="0" cy="2.5" r="1.6" fill="#8a94a8" />
          <text x="0" y="18" textAnchor="middle" fontSize="7" letterSpacing="1.5" fill="#8a94a8" fontFamily="'Space Grotesk Variable', sans-serif">
            {hidden ? 'CLASSIFIED' : 'LOCKED'}
          </text>
        </g>
      )}
    </svg>
  );
}
