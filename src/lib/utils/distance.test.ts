import { describe, expect, it } from 'vitest';

import { journeyDistanceKm } from './distance';

const TORINO = { lon: 7.677713, lat: 45.061 };
const VIAREGGIO = { lon: 10.25297, lat: 43.873957 };

describe('journeyDistanceKm', () => {
  it('is the straight line between the stations without a rail route', () => {
    const km = journeyDistanceKm({ from: TORINO, to: VIAREGGIO });

    expect(km).toBeGreaterThan(240);
    expect(km).toBeLessThan(250);
  });

  it('is the length along the rails when a route was computed', () => {
    expect(
      journeyDistanceKm({
        from: TORINO,
        to: VIAREGGIO,
        railDistanceM: 331_400,
      }),
    ).toBe(331.4);
  });

  it.each([null, undefined, 0])(
    'falls back to the straight line when the rail length is %s',
    (railDistanceM) => {
      const withoutRoute = journeyDistanceKm({ from: TORINO, to: VIAREGGIO });

      expect(
        journeyDistanceKm({ from: TORINO, to: VIAREGGIO, railDistanceM }),
      ).toBe(withoutRoute);
    },
  );

  it('is unknown without both stations and without a route', () => {
    expect(journeyDistanceKm({ from: TORINO, to: null })).toBeNull();
    expect(journeyDistanceKm({ from: null, to: null })).toBeNull();
  });

  it('uses the rail length even when a station is missing', () => {
    expect(
      journeyDistanceKm({ from: null, to: null, railDistanceM: 1500 }),
    ).toBe(1.5);
  });
});
