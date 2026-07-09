/**
 * Per-destination landing profiles. The landing renderer is generic and reads
 * every visual specific from here, so adding a body later means adding a
 * profile entry — not a new branch. `mode` selects the arrival beat:
 *   land       — descend and touch down on a solid surface
 *   orbit      — gas giant: orbital insertion / cloud-top hover (no landing)
 *   dock       — approach and connect to a station (ISS)
 *   driftStop  — drift to a halt among tumbling bodies (asteroid/Kuiper belts)
 */

export type Rgb = [number, number, number];
export type Atmosphere = 'none' | 'trace' | 'thin' | 'thick' | 'veryThick';
export type LandingMode = 'land' | 'orbit' | 'dock' | 'driftStop';
export type Signature = 'earth' | 'jupiter' | 'rings' | 'redSpot' | 'darkSpot' | 'heart' | 'faintRings' | 'none';

export type LandingProfile = {
  atmosphere: Atmosphere;
  mode: LandingMode;
  /** Sky gradient morph from space (d=0) to the surface sky (d=1): [d, top, bottom]. */
  sky: [number, Rgb, Rgb][];
  surface: { base: Rgb; accent: Rgb; fracture?: Rgb };
  dust: Rgb;
  dustFall: 'fast' | 'slow';
  lightTemp: Rgb; // key-light tint
  shadowHard: number; // 0 soft/diffuse .. 1 hard-edged
  haze: number; // 0 airless .. 1 crushing
  signature: Signature;
  cloudBands?: Rgb[]; // orbit mode
  scroll?: number; // orbit cloud scroll speed
  descentScale?: number; // <1 slower/softer descent (Titan), >1 quicker
};

const SPACE: [number, Rgb, Rgb] = [0, [7, 11, 26], [13, 18, 48]];
const NIGHT: [number, Rgb, Rgb][] = [
  [0, [4, 6, 14], [7, 10, 22]],
  [1, [4, 6, 14], [9, 12, 26]],
]; // airless: near-black all the way down, stars stay

const PROFILES: Record<string, LandingProfile> = {
  iss: {
    atmosphere: 'none',
    mode: 'dock',
    sky: NIGHT,
    surface: { base: [150, 158, 175], accent: [210, 218, 232] },
    dust: [200, 210, 225],
    dustFall: 'fast',
    lightTemp: [255, 250, 240],
    shadowHard: 1,
    haze: 0,
    signature: 'earth',
  },
  moon: {
    atmosphere: 'none',
    mode: 'land',
    sky: NIGHT,
    surface: { base: [150, 150, 156], accent: [208, 208, 214] },
    dust: [186, 186, 190],
    dustFall: 'fast',
    lightTemp: [255, 253, 246],
    shadowHard: 1,
    haze: 0,
    signature: 'earth',
  },
  venus: {
    atmosphere: 'veryThick',
    mode: 'land',
    sky: [SPACE, [0.4, [120, 96, 44], [150, 120, 58]], [1, [156, 128, 66], [196, 166, 96]]],
    surface: { base: [138, 96, 54], accent: [182, 142, 90] },
    dust: [172, 138, 84],
    dustFall: 'slow',
    lightTemp: [214, 184, 122],
    shadowHard: 0.05,
    haze: 0.92,
    signature: 'none',
  },
  mars: {
    atmosphere: 'thin',
    mode: 'land',
    sky: [SPACE, [0.5, [150, 108, 92], [186, 140, 112]], [1, [196, 150, 120], [224, 182, 150]]],
    surface: { base: [150, 70, 44], accent: [202, 112, 70] },
    dust: [190, 112, 72],
    dustFall: 'slow',
    lightTemp: [232, 182, 150],
    shadowHard: 0.4,
    haze: 0.35,
    signature: 'none',
  },
  belt: {
    atmosphere: 'none',
    mode: 'driftStop',
    sky: NIGHT,
    surface: { base: [112, 106, 98], accent: [150, 142, 130] },
    dust: [140, 134, 124],
    dustFall: 'fast',
    lightTemp: [250, 246, 236],
    shadowHard: 0.9,
    haze: 0,
    signature: 'none',
  },
  jupiter: {
    atmosphere: 'thick',
    mode: 'orbit',
    sky: [SPACE, [0.6, [40, 34, 40], [70, 56, 50]], [1, [96, 78, 60], [150, 120, 88]]],
    surface: { base: [196, 149, 106], accent: [224, 185, 138] },
    dust: [210, 180, 140],
    dustFall: 'slow',
    lightTemp: [235, 205, 160],
    shadowHard: 0.2,
    haze: 0.55,
    signature: 'redSpot',
    cloudBands: [
      [214, 186, 146],
      [176, 132, 96],
      [232, 208, 172],
      [150, 108, 82],
      [222, 196, 158],
    ],
    scroll: 10,
  },
  europa: {
    atmosphere: 'none',
    mode: 'land',
    sky: NIGHT,
    surface: { base: [184, 200, 216], accent: [228, 238, 248], fracture: [150, 92, 72] },
    dust: [214, 228, 242],
    dustFall: 'fast',
    lightTemp: [206, 220, 238],
    shadowHard: 0.9,
    haze: 0,
    signature: 'jupiter',
  },
  saturn: {
    atmosphere: 'thick',
    mode: 'orbit',
    sky: [SPACE, [0.6, [46, 42, 40], [78, 68, 54]], [1, [140, 120, 84], [196, 176, 132]]],
    surface: { base: [214, 190, 132], accent: [238, 220, 176] },
    dust: [226, 208, 160],
    dustFall: 'slow',
    lightTemp: [238, 218, 172],
    shadowHard: 0.15,
    haze: 0.5,
    signature: 'rings',
    cloudBands: [
      [226, 208, 160],
      [206, 184, 138],
      [236, 222, 184],
      [196, 172, 128],
    ],
    scroll: 6,
  },
  titan: {
    atmosphere: 'veryThick',
    mode: 'land',
    sky: [SPACE, [0.35, [120, 78, 38], [150, 100, 50]], [1, [176, 120, 64], [206, 150, 86]]],
    surface: { base: [66, 52, 34], accent: [116, 88, 50] },
    dust: [150, 112, 62],
    dustFall: 'slow',
    lightTemp: [220, 160, 92],
    shadowHard: 0.08,
    haze: 0.95,
    signature: 'none',
    descentScale: 0.8,
  },
  uranus: {
    atmosphere: 'thick',
    mode: 'orbit',
    sky: [SPACE, [0.6, [60, 96, 104], [96, 150, 158]], [1, [140, 190, 196], [176, 214, 218]]],
    surface: { base: [150, 200, 206], accent: [186, 222, 226] },
    dust: [180, 214, 218],
    dustFall: 'slow',
    lightTemp: [210, 232, 236],
    shadowHard: 0.1,
    haze: 0.6,
    signature: 'faintRings',
    cloudBands: [
      [160, 206, 212],
      [150, 198, 204],
      [172, 214, 220],
    ],
    scroll: 3,
  },
  neptune: {
    atmosphere: 'thick',
    mode: 'orbit',
    sky: [SPACE, [0.55, [22, 40, 82], [40, 70, 128]], [1, [58, 96, 168], [92, 138, 206]]],
    surface: { base: [74, 111, 168], accent: [122, 156, 208] },
    dust: [150, 180, 220],
    dustFall: 'slow',
    lightTemp: [200, 216, 240],
    shadowHard: 0.15,
    haze: 0.55,
    signature: 'darkSpot',
    cloudBands: [
      [74, 111, 168],
      [58, 92, 150],
      [120, 156, 208],
      [46, 76, 132],
    ],
    scroll: 20,
  },
  pluto: {
    atmosphere: 'trace',
    mode: 'land',
    sky: [SPACE, [0.6, [10, 14, 30], [26, 40, 66]], [1, [30, 46, 74], [58, 78, 108]]],
    surface: { base: [190, 176, 150], accent: [226, 216, 196] },
    dust: [206, 196, 176],
    dustFall: 'slow',
    lightTemp: [176, 186, 206],
    shadowHard: 0.5,
    haze: 0.2,
    signature: 'heart',
  },
  kuiper: {
    atmosphere: 'none',
    mode: 'driftStop',
    sky: NIGHT,
    surface: { base: [96, 104, 120], accent: [140, 150, 168] },
    dust: [160, 172, 190],
    dustFall: 'fast',
    lightTemp: [214, 222, 236],
    shadowHard: 0.85,
    haze: 0,
    signature: 'none',
  },
};

const FALLBACK: LandingProfile = PROFILES.moon;

export function getLandingProfile(destinationId: string): LandingProfile {
  return PROFILES[destinationId] ?? FALLBACK;
}
