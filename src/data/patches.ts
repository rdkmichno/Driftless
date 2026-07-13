/**
 * Mission patches — embroidered collectible emblems earned at real milestones.
 * Everything is data-driven: adding a patch is one entry here. Earning is a
 * pure evaluation over the store's state at mission completion (an aborted
 * mission never reaches the evaluator).
 */

export type PatchCategory = 'destination' | 'hours' | 'streak' | 'feat' | 'seasonal';
export type PatchShape = 'circle' | 'shield' | 'rounded-triangle';

export type EarnCondition =
  | { type: 'visit'; destinationId: string }
  | { type: 'firstFlight' }
  | { type: 'hours'; minutes: number }
  | { type: 'streak'; days: number }
  | { type: 'sessionMinutes'; minutes: number }
  | { type: 'dayMinutes'; minutes: number }
  | { type: 'startHourBetween'; from: number; to: number } // local hour window [from, to)
  | { type: 'classifiedMission' }
  | { type: 'allPlanets' }
  | { type: 'allDestinations' }
  | { type: 'manual' }; // seasonal drops — awarded by future event logic only

export type Patch = {
  id: string;
  name: string;
  category: PatchCategory;
  emblem: string;
  palette: string[]; // 3–5 bold flat colors, [field, primary, secondary, thread/accent]
  shape: PatchShape;
  ringLabel: string;
  earnCondition: EarnCondition;
  earnHint: string; // shown on locked detail — how to earn, no spoilers beyond that
  flavor: string; // shown once earned
  isPremium: boolean;
  hidden?: boolean; // secret patches: locked state shows ??? only
};

/* ---------------- the starter set ---------------- */

const dest = (
  id: string,
  name: string,
  emblem: string,
  palette: string[],
  ringLabel: string,
  hint: string,
  flavor: string,
): Patch => ({
  id: `dest-${id}`,
  name,
  category: 'destination',
  emblem,
  palette,
  shape: 'circle',
  ringLabel,
  earnCondition: { type: 'visit', destinationId: id },
  earnHint: hint,
  flavor,
  isPremium: false,
});

export const PATCHES: Patch[] = [
  // ---- destinations: first landing on each body ----
  dest('iss', 'Low Earth Orbit', 'station', ['#101838', '#8c97ad', '#c9d2e0', '#e8b45a'], 'LOW EARTH ORBIT · FIRST DOCKING', 'Dock at Low Earth Orbit.', 'Every voyage starts a hundred miles up.'),
  dest('moon', 'First Moon Landing', 'moonEarth', ['#0d1024', '#9a9aa5', '#cfcfd8', '#4a7fa8'], 'LUNA · FIRST LANDING', 'Land on the Moon.', 'One small step, again — but this one was yours.'),
  dest('venus', 'Venus Descent', 'sphereBanded', ['#241a10', '#c9a876', '#e8d5a8', '#8a5c30'], 'VENUS · CLOUD DESCENT', 'Land on Venus.', 'Through the sulphur veil to the hidden plains.'),
  dest('mars', 'First Mars Landing', 'shipOverPlanet', ['#1c0f0a', '#b5623b', '#d98e62', '#e8b45a'], 'ARES · FIRST LANDING', 'Land on Mars.', 'Rust under the landing legs at last.'),
  dest('belt', 'Belt Runner', 'rocks', ['#141210', '#7a6e62', '#a89a88', '#c9d2e0'], 'ASTEROID BELT · SURVEY', 'Drift through the Asteroid Belt.', 'A million worlds too small for names.'),
  dest('jupiter', 'Jovian Orbit', 'sphereBanded', ['#170f08', '#c4956a', '#e0b98a', '#8a5c30'], 'JUPITER · ORBITAL INSERTION', 'Reach orbit above Jupiter.', 'The king of worlds rolled beneath you.'),
  dest('europa', 'Europa Station', 'jupiterHorizon', ['#0a0e1c', '#b8c4ce', '#dce6ee', '#96604a'], 'EUROPA · ICE LANDING', 'Land on Europa.', 'Jupiter filled half the sky and never moved.'),
  dest('saturn', 'Ring Passage', 'rings', ['#171208', '#d6b478', '#eed9a6', '#8a6a35'], 'SATURN · RING PASSAGE', 'Reach orbit above Saturn.', 'You threaded the needle of a billion shards.'),
  dest('titan', 'Titan Expedition', 'crescentHaze', ['#1c1206', '#c29a4e', '#e0be7e', '#6b4a20'], 'TITAN · SURFACE EXPEDITION', 'Land on Titan.', 'Rain that is not water, on a shore that is not sand.'),
  dest('uranus', 'Sideways World', 'orbitTilt', ['#0c1618', '#7fb4bc', '#a8d4da', '#3a5f6b'], 'URANUS · POLAR SURVEY', 'Reach orbit above Uranus.', 'A world rolling on its side through the quiet.'),
  dest('neptune', 'Last Giant', 'sphereStorm', ['#0a1020', '#4a6fa8', '#7a9cd0', '#c9d2e0'], 'NEPTUNE · DEEP RANGE', 'Reach orbit above Neptune.', 'The wind here would strip a coastline in a minute.'),
  dest('pluto', 'Heart of Pluto', 'heart', ['#12100e', '#a89a8e', '#cbbfb2', '#6a7189'], 'PLUTO · TOMBAUGH REGIO', 'Land on Pluto.', 'The little world kept its heart on its sleeve.'),
  dest('kuiper', 'Kuiper Drifter', 'comet', ['#0a0c14', '#5a6478', '#8a94a8', '#dce6ee'], 'KUIPER BELT · FAR DRIFT', 'Drift into the Kuiper Belt.', 'Past every chart, the hum was the only weather.'),

  // ---- flight hours: the pilot's logbook ----
  { id: 'hours-first', name: 'First Flight', category: 'hours', emblem: 'ship', palette: ['#101838', '#aab0c5', '#e9ebf4', '#e8b45a'], shape: 'circle', ringLabel: 'FIRST FLIGHT · DFT ACADEMY', earnCondition: { type: 'firstFlight' }, earnHint: 'Complete your first mission.', flavor: 'Everyone remembers their first burn.', isPremium: false },
  { id: 'hours-10', name: '10 Hours Aloft', category: 'hours', emblem: 'wings:X', palette: ['#141b3c', '#8a94a8', '#e8b45a', '#f5ce82'], shape: 'circle', ringLabel: 'TEN HOURS · FLIGHT LOG', earnCondition: { type: 'hours', minutes: 600 }, earnHint: 'Log 10 hours of focused flight.', flavor: 'The controls are starting to feel familiar.', isPremium: false },
  { id: 'hours-25', name: '25 Hours Aloft', category: 'hours', emblem: 'wings:XXV', palette: ['#141b3c', '#8a94a8', '#e8b45a', '#f5ce82'], shape: 'circle', ringLabel: 'TWENTY-FIVE HOURS · FLIGHT LOG', earnCondition: { type: 'hours', minutes: 1500 }, earnHint: 'Log 25 hours of focused flight.', flavor: 'You stopped checking the instruments so often.', isPremium: false },
  { id: 'hours-50', name: '50 Hours Aloft', category: 'hours', emblem: 'wings:L', palette: ['#1c1a2e', '#a89a88', '#e8b45a', '#f5ce82'], shape: 'circle', ringLabel: 'FIFTY HOURS · FLIGHT LOG', earnCondition: { type: 'hours', minutes: 3000 }, earnHint: 'Log 50 hours of focused flight.', flavor: 'Fifty hours of engine hum and quiet work.', isPremium: false },
  { id: 'hours-100', name: 'Centurion', category: 'hours', emblem: 'wings:C', palette: ['#171208', '#d6b478', '#eed9a6', '#e8b45a'], shape: 'shield', ringLabel: 'ONE HUNDRED HOURS', earnCondition: { type: 'hours', minutes: 6000 }, earnHint: 'Log 100 hours of focused flight.', flavor: 'A hundred hours. The ship knows your hands now.', isPremium: false },
  { id: 'hours-250', name: 'Deep Log', category: 'hours', emblem: 'wings:CCL', palette: ['#0c1618', '#7fb4bc', '#a8d4da', '#e8b45a'], shape: 'shield', ringLabel: 'TWO HUNDRED FIFTY HOURS', earnCondition: { type: 'hours', minutes: 15000 }, earnHint: 'Log 250 hours of focused flight.', flavor: 'Most people never leave the atmosphere.', isPremium: false },
  { id: 'hours-500', name: 'Master Aviator', category: 'hours', emblem: 'wings:D', palette: ['#12100e', '#cbbfb2', '#e8b45a', '#f5ce82'], shape: 'shield', ringLabel: 'FIVE HUNDRED HOURS · MASTER', earnCondition: { type: 'hours', minutes: 30000 }, earnHint: 'Log 500 hours of focused flight.', flavor: 'Five hundred hours. The stars file their reports to you.', isPremium: false },

  // ---- streaks: consecutive focus days ----
  { id: 'streak-3', name: 'Three-Day Burn', category: 'streak', emblem: 'flame:3', palette: ['#1c0f0a', '#d98e62', '#f5ce82', '#e8b45a'], shape: 'circle', ringLabel: 'THREE CONSECUTIVE DAYS', earnCondition: { type: 'streak', days: 3 }, earnHint: 'Fly missions three days in a row.', flavor: 'A burn held for three days straight.', isPremium: false },
  { id: 'streak-7', name: 'Week in Orbit', category: 'streak', emblem: 'flame:7', palette: ['#1c0f0a', '#d98e62', '#f5ce82', '#e8b45a'], shape: 'circle', ringLabel: 'SEVEN CONSECUTIVE DAYS', earnCondition: { type: 'streak', days: 7 }, earnHint: 'Fly missions seven days in a row.', flavor: 'Seven sunrises from the same window.', isPremium: false },
  { id: 'streak-30', name: 'Long Haul', category: 'streak', emblem: 'flame:30', palette: ['#170f08', '#c4956a', '#f5ce82', '#e8b45a'], shape: 'circle', ringLabel: 'THIRTY CONSECUTIVE DAYS', earnCondition: { type: 'streak', days: 30 }, earnHint: 'Fly missions thirty days in a row.', flavor: 'A month without missing a launch window.', isPremium: false },
  { id: 'streak-100', name: 'Constant Star', category: 'streak', emblem: 'flame:100', palette: ['#0a0c14', '#8a94a8', '#f5ce82', '#e8b45a'], shape: 'shield', ringLabel: 'ONE HUNDRED CONSECUTIVE DAYS', earnCondition: { type: 'streak', days: 100 }, earnHint: 'Fly missions one hundred days in a row.', flavor: 'Some lights in the sky turn out to be people.', isPremium: false },

  // ---- feats ----
  { id: 'feat-deepspace', name: 'Deep Space', category: 'feat', emblem: 'voidStar', palette: ['#070b1a', '#3a5f6b', '#8a94a8', '#e9ebf4'], shape: 'shield', ringLabel: 'ONE HUNDRED EIGHTY MINUTES', earnCondition: { type: 'sessionMinutes', minutes: 180 }, earnHint: 'Complete a single 3-hour mission.', flavor: 'Three hours past the last beacon.', isPremium: false },
  { id: 'feat-grandtour', name: 'Grand Tour', category: 'feat', emblem: 'grandTour', palette: ['#0d1024', '#e8b45a', '#7a9cd0', '#d98e62'], shape: 'shield', ringLabel: 'EVERY PLANET · GRAND TOUR', earnCondition: { type: 'allPlanets' }, earnHint: 'Visit every planet in the system.', flavor: 'Six worlds, one logbook.', isPremium: false },
  { id: 'feat-marathon', name: 'Marathon', category: 'feat', emblem: 'chronometer', palette: ['#141b3c', '#aab0c5', '#e8b45a', '#f5ce82'], shape: 'shield', ringLabel: 'FOUR HOURS · SINGLE DAY', earnCondition: { type: 'dayMinutes', minutes: 240 }, earnHint: 'Fly 4 focused hours in one day.', flavor: 'The long shift. The coffee went cold twice.', isPremium: false },
  { id: 'feat-nightwatch', name: 'Night Watch', category: 'feat', emblem: 'moonStar', palette: ['#070b1a', '#1e2750', '#aab0c5', '#f5ce82'], shape: 'circle', ringLabel: 'NIGHT WATCH · 0000–0400', earnCondition: { type: 'startHourBetween', from: 0, to: 4 }, earnHint: 'Launch a mission in the dead of night.', flavor: 'Somebody has to mind the ship while the world sleeps.', isPremium: false },
  { id: 'feat-dawnpatrol', name: 'Dawn Patrol', category: 'feat', emblem: 'sunrise', palette: ['#1c0f0a', '#6b4a55', '#d98e62', '#f5ce82'], shape: 'circle', ringLabel: 'DAWN PATROL · 0400–0800', earnCondition: { type: 'startHourBetween', from: 4, to: 8 }, earnHint: 'Launch a mission before eight in the morning.', flavor: 'First light on the hull, first burn of the day.', isPremium: false },
  { id: 'feat-fullsystem', name: 'Full System', category: 'feat', emblem: 'fullSystem', palette: ['#0d1024', '#e8b45a', '#4a7fa8', '#f5ce82'], shape: 'shield', ringLabel: 'EVERY DESTINATION · FULL SYSTEM', earnCondition: { type: 'allDestinations' }, earnHint: 'Visit every destination on the map.', flavor: 'There is nowhere left they have not sent you.', isPremium: false },

  // ---- seasonal / rare (premium collection depth; limited-time drops) ----
  { id: 'seasonal-perseids', name: 'Perseids Run', category: 'seasonal', emblem: 'meteor', palette: ['#0a0c14', '#3a5f6b', '#dce6ee', '#f5ce82'], shape: 'rounded-triangle', ringLabel: 'PERSEIDS · AUGUST FLIGHT', earnCondition: { type: 'manual' }, earnHint: 'A limited drop during the Perseid meteor shower.', flavor: 'You flew through the dust of a dead comet.', isPremium: true },
  { id: 'seasonal-eclipse', name: 'Totality', category: 'seasonal', emblem: 'eclipse', palette: ['#070b1a', '#12100e', '#f5ce82', '#e9ebf4'], shape: 'rounded-triangle', ringLabel: 'TOTALITY · ECLIPSE FLIGHT', earnCondition: { type: 'manual' }, earnHint: 'A limited drop during a solar eclipse.', flavor: 'For four minutes the sun wore a ring.', isPremium: true },

  // ---- hidden / secret ----
  { id: 'hidden-classified', name: 'Sealed Orders', category: 'feat', emblem: 'redacted', palette: ['#0a0c14', '#1e2750', '#8a94a8', '#e8b45a'], shape: 'shield', ringLabel: 'DESTINATION REDACTED', earnCondition: { type: 'classifiedMission' }, earnHint: '???', flavor: 'You launched without knowing where. It knew you.', isPremium: false, hidden: true },
];

export const getPatch = (id: string) => PATCHES.find((p) => p.id === id);

export type CategoryProgress = Record<PatchCategory, { earned: number; total: number }>;

/** Overall and per-category earned/total counts for the collection wall. */
export function collectionProgress(earned: Record<string, number>): {
  earned: number;
  total: number;
  byCategory: CategoryProgress;
} {
  const ids = new Set(Object.keys(earned));
  const byCategory = {} as CategoryProgress;
  let earnedCount = 0;
  for (const p of PATCHES) {
    const c = (byCategory[p.category] ??= { earned: 0, total: 0 });
    c.total++;
    if (ids.has(p.id)) {
      c.earned++;
      earnedCount++;
    }
  }
  return { earned: earnedCount, total: PATCHES.length, byCategory };
}

/* ---------------- earning evaluation ---------------- */

type CompletedRecord = { destinationId: string; startedAt: number; endedAt: number; plannedMinutes: number; completed: boolean };

export type PatchContext = {
  earned: Record<string, number>;
  visitedIds: string[];
  totalFocusMinutes: number;
  /** Completed mission log INCLUDING the just-completed mission. */
  log: CompletedRecord[];
  justCompleted: { destinationId: string; plannedMinutes: number; startedAt: number; endedAt: number; classified?: boolean };
  /** IDs of planet-type / all destinations — injected so this module stays store-agnostic. */
  planetIds: string[];
  allDestinationIds: string[];
};

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Consecutive days with ≥1 completed mission, ending on the just-completed day. */
export function currentStreakDays(log: CompletedRecord[], endAt: number): number {
  const days = new Set(log.filter((m) => m.completed).map((m) => dayKey(m.endedAt)));
  days.add(dayKey(endAt));
  let streak = 0;
  const cursor = new Date(endAt);
  while (days.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function met(cond: EarnCondition, ctx: PatchContext): boolean {
  switch (cond.type) {
    case 'visit':
      return ctx.visitedIds.includes(cond.destinationId);
    case 'firstFlight':
      return ctx.log.some((m) => m.completed);
    case 'hours':
      return ctx.totalFocusMinutes >= cond.minutes;
    case 'streak':
      return currentStreakDays(ctx.log, ctx.justCompleted.endedAt) >= cond.days;
    case 'sessionMinutes':
      return ctx.justCompleted.plannedMinutes >= cond.minutes;
    case 'dayMinutes': {
      const today = dayKey(ctx.justCompleted.endedAt);
      const total = ctx.log
        .filter((m) => m.completed && dayKey(m.endedAt) === today)
        .reduce((sum, m) => sum + m.plannedMinutes, 0);
      return total >= cond.minutes;
    }
    case 'startHourBetween': {
      const h = new Date(ctx.justCompleted.startedAt).getHours();
      return h >= cond.from && h < cond.to;
    }
    case 'classifiedMission':
      return !!ctx.justCompleted.classified;
    case 'allPlanets':
      return ctx.planetIds.every((id) => ctx.visitedIds.includes(id));
    case 'allDestinations':
      return ctx.allDestinationIds.every((id) => ctx.visitedIds.includes(id));
    case 'manual':
      return false;
  }
}

/** Returns ids of patches newly earned in this context (not already earned). */
export function evaluateNewPatches(ctx: PatchContext): string[] {
  return PATCHES.filter((p) => !(p.id in ctx.earned) && met(p.earnCondition, ctx)).map((p) => p.id);
}
