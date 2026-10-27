import { describe, expect, it } from 'vitest';

import type { Journey } from '$lib/db/types';
import { getStationVisitSummary } from './station-visits';
import { prepareJourneyData } from './data';

const baseJourney = (): Journey =>
  ({
    from: { id: 1, tz: 'Europe/Rome', lon: 9.2, lat: 45.5 },
    to: { id: 2, tz: 'Europe/Rome', lon: 12.5, lat: 41.9 },
    date: '2024-06-14',
    datePrecision: 'day',
    duration: 10_800,
    departure: null,
    arrival: null,
    departureScheduled: null,
    arrivalScheduled: null,
    departurePlatform: null,
    arrivalPlatform: null,
  }) as Journey;

const prepare = (journey: Journey) => prepareJourneyData([journey])[0]!;

describe('station visit summary', () => {
  it('uses day precision for an exact timestamp on a coarse journey date', () => {
    const journey = {
      ...baseJourney(),
      datePrecision: 'month',
      arrivalScheduled: '2024-06-14T09:45:00.000Z',
    } as Journey;

    expect(
      getStationVisitSummary(
        [prepare(journey)],
        2,
        new Date('2024-07-01T00:00:00Z'),
      ).last,
    ).toContain('14');
  });

  it('derives an untimed arrival from departure and duration', () => {
    const journey = {
      ...baseJourney(),
      departureScheduled: '2024-06-15T06:00:00.000Z',
    } as Journey;

    expect(
      getStationVisitSummary(
        [prepare(journey)],
        2,
        new Date('2024-07-01T00:00:00Z'),
      ).last,
    ).toContain('15');
  });

  it('omits an arrival that cannot be placed on a calendar day', () => {
    const journey = { ...baseJourney(), duration: null };

    expect(
      getStationVisitSummary(
        [prepare(journey)],
        2,
        new Date('2024-07-01T00:00:00Z'),
      ),
    ).toEqual({ last: null, next: null });
  });

  it('does not classify an imprecise range that contains now', () => {
    expect(
      getStationVisitSummary(
        [prepare(baseJourney())],
        1,
        new Date('2024-06-14T12:00:00Z'),
      ),
    ).toEqual({ last: null, next: null });
  });
});
