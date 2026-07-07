import { describe, it, expect } from 'vitest';
import { DESTINATIONS, getDestination, unlockedIdsFor, nearestUnlocked, formatDistance } from './destinations';

describe('destinations', () => {
  it('has 13 destinations with mars defaulting to 25 min', () => {
    expect(DESTINATIONS).toHaveLength(13);
    expect(getDestination('mars')?.durationMinutes).toBe(25);
  });

  it('unlocks iss/moon/venus/mars at zero minutes', () => {
    expect(unlockedIdsFor(0)).toEqual(['iss', 'moon', 'venus', 'mars']);
  });

  it('unlocks the belt at 30 lifetime minutes and jupiter at 120', () => {
    expect(unlockedIdsFor(30)).toContain('belt');
    expect(unlockedIdsFor(119)).not.toContain('jupiter');
    expect(unlockedIdsFor(120)).toContain('jupiter');
  });

  it('maps custom durations to the nearest unlocked destination', () => {
    expect(nearestUnlocked(40, 0).id).toBe('mars'); // jupiter locked at 0 min
    expect(nearestUnlocked(40, 10_000).id).toBe('jupiter'); // everything unlocked
    expect(nearestUnlocked(5, 0).id).toBe('iss');
    expect(nearestUnlocked(180, 10_000).id).toBe('kuiper');
  });

  it('formats distances', () => {
    expect(formatDistance(0.0004)).toBe('400 km');
    expect(formatDistance(78)).toBe('78 million km');
  });
});
