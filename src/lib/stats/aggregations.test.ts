import { describe, expect, it } from 'vitest';

import { COUNTRIES } from '$lib/data/countries';
import {
  countriesByContinentDetails,
  countriesByContinentDistribution,
  journeyMatchesChartBucket,
  reasonDistribution,
} from './aggregations';
import type { JourneyData } from '$lib/utils';

describe('country statistics', () => {
  const visitedKosovo = [
    { code: 'XK', status: 'visited', note: null },
  ] as const;

  it('counts Kosovo as a visited European country', () => {
    const result = countriesByContinentDistribution([...visitedKosovo]);
    const europeanCountries = COUNTRIES.filter(
      (country) => country.continent === 'Europe',
    );

    expect(result.Europe).toEqual({
      visited: 1,
      total: europeanCountries.length,
    });
  });

  it('includes Kosovo in country details', () => {
    const result = countriesByContinentDetails([...visitedKosovo]);
    const kosovo = result.Europe?.find((country) => country.code === 'XK');

    expect(kosovo).toMatchObject({
      name: 'Kosovo',
      visited: true,
    });
  });
});

describe('passenger reason statistics', () => {
  const journeys = [
    {
      passengers: [
        { userId: 'one', journeyReason: 'business' },
        { userId: 'two', journeyReason: 'leisure' },
      ],
    },
    {
      passengers: [
        { userId: 'one', journeyReason: null },
        { userId: 'two', journeyReason: 'leisure' },
      ],
    },
  ] as JourneyData[];

  it('counts each passenger when aggregating all users', () => {
    expect(reasonDistribution(journeys, {})).toMatchObject({
      Leisure: 2,
      Business: 1,
      'No Data': 1,
    });
  });

  it('counts only the selected passenger', () => {
    expect(reasonDistribution(journeys, { userId: 'one' })).toMatchObject({
      Business: 1,
      'No Data': 1,
    });
    expect(
      journeyMatchesChartBucket(journeys[0]!, 'reason', 'Business', {
        userId: 'one',
      }),
    ).toBe(true);
    expect(
      journeyMatchesChartBucket(journeys[0]!, 'reason', 'Leisure', {
        userId: 'one',
      }),
    ).toBe(false);
  });
});
