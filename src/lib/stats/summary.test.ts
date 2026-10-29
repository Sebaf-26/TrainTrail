import { describe, expect, it } from 'vitest';

import { computeJourneyStatsSummary } from './summary';

import type { Journey } from '$lib/db/types';

const station = (id: number, lon: number, lat: number) => ({
  id,
  lon,
  lat,
});

// Torino Porta Nuova -> Viareggio, about 245 km as the crow flies.
const journey = (railDistanceM?: number | null) =>
  ({
    from: station(1, 7.677713, 45.061),
    to: station(2, 10.25297, 43.873957),
    duration: 12_900,
    operator: null,
    passengers: [],
    railDistanceM,
  }) as unknown as Journey;

describe('computeJourneyStatsSummary distance', () => {
  it('adds up the straight line for journeys without a rail route', () => {
    const summary = computeJourneyStatsSummary([journey(), journey(null)]);

    expect(summary.distanceKm).toBeGreaterThan(480);
    expect(summary.distanceKm).toBeLessThan(500);
  });

  it('adds up the length along the rails when there is one', () => {
    const summary = computeJourneyStatsSummary([journey(331_400)]);

    expect(summary.distanceKm).toBe(331);
  });

  it('mixes both, journey by journey', () => {
    const summary = computeJourneyStatsSummary([journey(331_400), journey()]);

    expect(summary.distanceKm).toBeGreaterThan(331 + 240);
    expect(summary.distanceKm).toBeLessThan(331 + 250);
  });
});
