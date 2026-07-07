export type DestinationType = 'planet' | 'moon' | 'station' | 'region' | 'dwarf';

export type Destination = {
  id: string;
  name: string;
  type: DestinationType;
  durationMinutes: number;
  distanceMkm: number; // millions of km — flavour/stats only
  palette: { base: string; accent: string };
  flavor: string;
  unlockAtTotalMinutes: number;
};

export const DESTINATIONS: Destination[] = [
  { id: 'iss', name: 'Low Earth Orbit', type: 'station', durationMinutes: 5, distanceMkm: 0.0004, palette: { base: '#8c97ad', accent: '#c9d2e0' }, flavor: 'A quick loop above the clouds. Back before the coffee cools.', unlockAtTotalMinutes: 0 },
  { id: 'moon', name: 'The Moon', type: 'moon', durationMinutes: 10, distanceMkm: 0.384, palette: { base: '#9a9aa5', accent: '#cfcfd8' }, flavor: 'Silver seas of dust, and the Earth hanging quiet behind you.', unlockAtTotalMinutes: 0 },
  { id: 'venus', name: 'Venus', type: 'planet', durationMinutes: 15, distanceMkm: 41, palette: { base: '#c9a876', accent: '#e8d5a8' }, flavor: 'The morning star, wrapped in slow golden storms.', unlockAtTotalMinutes: 0 },
  { id: 'mars', name: 'Mars', type: 'planet', durationMinutes: 25, distanceMkm: 78, palette: { base: '#b5623b', accent: '#d98e62' }, flavor: 'Rust-red plains and the tallest mountain in the system.', unlockAtTotalMinutes: 0 },
  { id: 'belt', name: 'The Asteroid Belt', type: 'region', durationMinutes: 30, distanceMkm: 330, palette: { base: '#7a6e62', accent: '#a89a88' }, flavor: 'A slow drift through ancient rubble, older than any world.', unlockAtTotalMinutes: 30 },
  { id: 'jupiter', name: 'Jupiter', type: 'planet', durationMinutes: 45, distanceMkm: 628, palette: { base: '#c4956a', accent: '#e0b98a' }, flavor: 'A storm larger than Earth has raged here for centuries.', unlockAtTotalMinutes: 120 },
  { id: 'europa', name: 'Europa', type: 'moon', durationMinutes: 50, distanceMkm: 629, palette: { base: '#b8c4ce', accent: '#dce6ee' }, flavor: 'Cracked ice over a hidden ocean. Something waits beneath.', unlockAtTotalMinutes: 180 },
  { id: 'saturn', name: 'Saturn', type: 'planet', durationMinutes: 60, distanceMkm: 1275, palette: { base: '#d6b478', accent: '#eed9a6' }, flavor: 'The rings resolve slowly — a billion shards of drifting ice.', unlockAtTotalMinutes: 240 },
  { id: 'titan', name: 'Titan', type: 'moon', durationMinutes: 75, distanceMkm: 1276, palette: { base: '#c29a4e', accent: '#e0be7e' }, flavor: 'Amber haze and methane rain on the only moon with weather.', unlockAtTotalMinutes: 360 },
  { id: 'uranus', name: 'Uranus', type: 'planet', durationMinutes: 90, distanceMkm: 2724, palette: { base: '#7fb4bc', accent: '#a8d4da' }, flavor: 'A pale, sideways world, rolling through the dark.', unlockAtTotalMinutes: 480 },
  { id: 'neptune', name: 'Neptune', type: 'planet', durationMinutes: 105, distanceMkm: 4351, palette: { base: '#4a6fa8', accent: '#7a9cd0' }, flavor: 'The last giant. Winds here outrun the speed of sound.', unlockAtTotalMinutes: 600 },
  { id: 'pluto', name: 'Pluto', type: 'dwarf', durationMinutes: 120, distanceMkm: 5900, palette: { base: '#a89a8e', accent: '#cbbfb2' }, flavor: 'A small heart of ice at the edge of the map.', unlockAtTotalMinutes: 720 },
  { id: 'kuiper', name: 'The Kuiper Belt', type: 'region', durationMinutes: 150, distanceMkm: 7500, palette: { base: '#5a6478', accent: '#8a94a8' }, flavor: 'Past every chart. Just you, the hum, and the long dark.', unlockAtTotalMinutes: 900 },
];

export function getDestination(id: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}

export function unlockedIdsFor(totalMinutes: number): string[] {
  return DESTINATIONS.filter((d) => d.unlockAtTotalMinutes <= totalMinutes).map((d) => d.id);
}

export function nearestUnlocked(minutes: number, totalFocusMinutes: number): Destination {
  const unlocked = DESTINATIONS.filter((d) => d.unlockAtTotalMinutes <= totalFocusMinutes);
  return unlocked.reduce((best, d) =>
    Math.abs(d.durationMinutes - minutes) < Math.abs(best.durationMinutes - minutes) ? d : best,
  );
}

export function formatDistance(mkm: number): string {
  if (mkm < 1) return `${Math.round(mkm * 1_000_000).toLocaleString()} km`;
  return `${mkm.toLocaleString()} million km`;
}
