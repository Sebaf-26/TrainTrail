import { describe, expect, it } from 'vitest';

import {
  createEmptyImportMappings,
  getOutstandingUnknowns,
  getPendingJourneys,
  mergeImportMappings,
} from './model';

import type { Train, CreateJourney } from '$lib/db/types';

const journey = (date: string) => ({ date }) as CreateJourney;

describe('import mapping model', () => {
  it('merges entity mappings without discarding earlier choices', () => {
    const firstTrain = { id: 1 } as Train;
    const secondTrain = { id: 2 } as Train;
    const current = createEmptyImportMappings();
    current.train.A = firstTrain;

    const pending = createEmptyImportMappings();
    pending.train.B = secondTrain;

    expect(mergeImportMappings(current, pending).train).toEqual({
      A: firstTrain,
      B: secondTrain,
    });
  });

  it('does not replay handled rows after another mapping resolves', () => {
    const journeys = [
      journey('2026-01-01'),
      journey('2026-01-02'),
      journey('2026-01-03'),
    ];

    const pending = getPendingJourneys(
      journeys,
      {
        stations: {},
        operators: {},
        train: { B: [1] },
      },
      new Set([0]),
    );

    expect(pending.map(({ index }) => index)).toEqual([2]);
  });

  it('allows unknown optional references while still blocking unknown stations', () => {
    const journeys = [
      journey('2026-01-01'),
      journey('2026-01-02'),
      journey('2026-01-03'),
    ];

    const pending = getPendingJourneys(
      journeys,
      {
        stations: { CPH: [0] },
        operators: { NWA: [1] },
        train: { B733: [2] },
      },
      new Set(),
      {
        allowUnknownOperators: true,
        allowUnknownTrain: true,
      },
    );

    expect(pending.map(({ index }) => index)).toEqual([1, 2]);
  });

  it('removes unknown values after their journeys are handled', () => {
    const outstanding = getOutstandingUnknowns(
      {
        stations: { CPH: [0] },
        operators: { NWA: [1, 2], JAI: [2] },
        train: {},
      },
      new Set([1, 2]),
    );

    expect(outstanding).toEqual({
      stations: { CPH: [0] },
      operators: {},
      train: {},
    });
  });
});
