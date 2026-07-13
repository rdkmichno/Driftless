import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Patch } from './Patch';
import { parseEmblem, EMBLEM_BASES } from './emblems';
import { PATCHES, getPatch } from '../../data/patches';

const moon = getPatch('dest-moon')!;
const hidden = getPatch('hidden-classified')!;

describe('emblem registry', () => {
  it('has a renderer for every emblem base referenced in the patch set', () => {
    for (const p of PATCHES) {
      const { base } = parseEmblem(p.emblem);
      expect(EMBLEM_BASES, `missing emblem "${base}" for ${p.id}`).toContain(base);
    }
  });

  it('splits a "base:label" emblem key into base and label', () => {
    expect(parseEmblem('wings:XXV')).toEqual({ base: 'wings', label: 'XXV' });
    expect(parseEmblem('ship')).toEqual({ base: 'ship', label: undefined });
  });
});

describe('Patch component', () => {
  it('renders an embroidered SVG with a stitch filter and merrowed border when earned', () => {
    const svg = renderToStaticMarkup(<Patch patch={moon} earned size={220} />);
    expect(svg).toContain('<svg');
    // embroidery signatures: a specular/bevel filter, a fabric-weave texture, a satin thread pattern
    expect(svg).toMatch(/feSpecularLighting|feDiffuseLighting/);
    expect(svg).toContain('feTurbulence');
    // the text ring uses the uppercase ring label around a path
    expect(svg).toContain('textPath');
    expect(svg).toContain('LUNA');
  });

  it('labels the patch by name for screen readers when earned', () => {
    const svg = renderToStaticMarkup(<Patch patch={moon} earned />);
    expect(svg).toMatch(/role="img"/);
    expect(svg).toContain('First Moon Landing');
  });

  it('renders a locked silhouette that does not reveal the emblem detail or flavor', () => {
    const svg = renderToStaticMarkup(<Patch patch={moon} earned={false} />);
    // locked patches announce themselves as locked, not by their reward
    expect(svg.toLowerCase()).toContain('locked');
    // the evocative flavor line is never present in a locked render
    expect(svg).not.toContain(moon.flavor);
    // the full-colour ring label is withheld on lock
    expect(svg).not.toContain('LUNA');
  });

  it('renders a hidden/secret patch as fully classified when locked', () => {
    const svg = renderToStaticMarkup(<Patch patch={hidden} earned={false} />);
    expect(svg).toContain('Classified');
    expect(svg).not.toContain('Sealed Orders');
  });

  it('renders every patch in the set without throwing, earned and locked', () => {
    for (const p of PATCHES) {
      expect(() => renderToStaticMarkup(<Patch patch={p} earned size={120} />)).not.toThrow();
      expect(() => renderToStaticMarkup(<Patch patch={p} earned={false} size={120} />)).not.toThrow();
    }
  });
});
