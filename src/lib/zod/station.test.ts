import { describe, expect, it } from 'vitest';

import { journeyStationSchema, stationSchema } from './station';

const form = {
  id: null,
  name: 'Milano Centrale',
  municipality: 'Milano',
  lat: 45.4859,
  lon: 9.2046,
  continent: 'EU',
  country: 'IT',
  tz: 'Europe/Rome',
};

describe('stationSchema', () => {
  it('needs neither a code nor a type', () => {
    expect(stationSchema.safeParse(form).success).toBe(true);
  });

  it('accepts an optional UIC code', () => {
    const parsed = stationSchema.parse({ ...form, uic: '8301700' });

    expect(parsed.uic).toBe('8301700');
  });

  it('still requires a name and coordinates', () => {
    expect(stationSchema.safeParse({ ...form, name: '' }).success).toBe(false);
    expect(stationSchema.safeParse({ ...form, lat: undefined }).success).toBe(
      false,
    );
  });
});

describe('journeyStationSchema', () => {
  const station = {
    id: 1,
    type: 'main',
    name: 'Milano Centrale',
    municipality: null,
    lat: 45.4859,
    lon: 9.2046,
    continent: 'EU',
    country: 'IT',
    code: '8301700',
    tz: 'Europe/Rome',
    custom: false,
  };

  it('defaults the optional rail identifiers to null', () => {
    expect(journeyStationSchema.parse(station)).toMatchObject({
      uic: null,
      viaggiatrenoId: null,
    });
  });

  it('only knows main stations and stations', () => {
    expect(journeyStationSchema.safeParse(station).success).toBe(true);
    expect(
      journeyStationSchema.safeParse({ ...station, type: 'station' }).success,
    ).toBe(true);
    expect(
      journeyStationSchema.safeParse({ ...station, type: 'large_station' })
        .success,
    ).toBe(false);
  });
});
