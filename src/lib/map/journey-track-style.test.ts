import { describe, expect, it } from 'vitest';

import type { JourneyTrackPath } from './journey-layer-data';
import {
  buildJourneyTrackRuns,
  getJourneyTrackColor,
  metersToFeet,
  roundJourneyTrackAltitude,
} from './journey-track-style';

import {
  toJourneyTrackSamples,
  type JourneyTrackCoordinate,
} from '$lib/track/schema';

const track = (
  coordinates: JourneyTrackCoordinate[],
  options: { ground?: boolean[]; estimated?: boolean[] } = {},
) =>
  ({
    journeyId: 1,
    samples: toJourneyTrackSamples({ coordinates, ...options }),
  }) as JourneyTrackPath;

describe('journey track styling', () => {
  it('converts metres and rounds like tar1090', () => {
    expect(metersToFeet(304.8)).toBeCloseTo(1_000);
    expect(roundJourneyTrackAltitude(7_974)).toBe(7_950);
    expect(roundJourneyTrackAltitude(8_240)).toBe(8_000);
    expect(roundJourneyTrackAltitude(8_260)).toBe(8_500);
  });

  it('uses ground and unknown colors before altitude', () => {
    expect(
      getJourneyTrackColor({
        altitudeFeet: 30_000,
        ground: true,
      }),
    ).toEqual([82, 82, 91]);
    expect(
      getJourneyTrackColor({
        altitudeFeet: 30_000,
        ground: true,
        darkMode: true,
      }),
    ).toEqual([228, 228, 231]);
    expect(
      getJourneyTrackColor({
        altitudeFeet: null,
        ground: false,
      }),
    ).toEqual([161, 161, 170]);
  });

  it('keeps estimated ground tracks visible in dark mode', () => {
    expect(
      getJourneyTrackColor({
        altitudeFeet: null,
        ground: true,
        estimated: true,
        darkMode: true,
      }),
    ).toEqual([179, 179, 188]);
  });

  it('exposes exact TrainTrail palette anchors', () => {
    expect(
      getJourneyTrackColor({
        altitudeFeet: 0,
        ground: false,
      }),
    ).toEqual([249, 115, 22]);
    expect(
      getJourneyTrackColor({
        altitudeFeet: 11_000,
        ground: false,
      }),
    ).toEqual([6, 182, 212]);
    expect(
      getJourneyTrackColor({
        altitudeFeet: 51_000,
        ground: false,
      }),
    ).toEqual([239, 68, 68]);
  });

  it('darkens estimated segments in HSL like tar1090', () => {
    const actual = getJourneyTrackColor({
      altitudeFeet: 0,
      ground: false,
    });
    const estimated = getJourneyTrackColor({
      altitudeFeet: 0,
      ground: false,
      estimated: true,
    });
    expect(estimated[0]).toBeLessThan(actual[0]);
    expect(estimated[1]).toBeLessThan(actual[1]);
    expect(estimated[2]).toBeLessThan(actual[2]);
    expect(estimated).toEqual([211, 90, 5]);
  });

  it('merges consecutive edges with the same rounded style', () => {
    const runs = buildJourneyTrackRuns([
      track(
        [
          [10, 55, 304.8],
          [11, 56, 307.8],
          [12, 57, 365.76],
          [13, 58, 368.8],
        ],
        { estimated: [false, false, false, true] },
      ),
    ]);

    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({
      altitudeFeet: 1_000,
      estimated: false,
      path: [
        [10, 55, 304.8],
        [11, 56, 307.8],
        [12, 57, 365.76],
      ],
    });
    expect(runs[1]).toMatchObject({
      altitudeFeet: 1_200,
      estimated: true,
      path: [
        [12, 57, 365.76],
        [13, 58, 368.8],
      ],
    });
  });

  it('uses starting-point journey state and destination-point uncertainty', () => {
    const runs = buildJourneyTrackRuns([
      track(
        [
          [10, 55, 0],
          [11, 56, 304.8],
          [12, 57, 609.6],
        ],
        { ground: [true, false, false], estimated: [false, true, false] },
      ),
    ]);

    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ ground: true, estimated: true });
    expect(runs[1]).toMatchObject({ ground: false, estimated: false });
  });

  it('keeps ground runs together when recorded altitude changes', () => {
    const runs = buildJourneyTrackRuns([
      track(
        [
          [10, 55, 0],
          [11, 56, 100],
          [12, 57, 200],
        ],
        { ground: [true, true, false] },
      ),
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      altitudeFeet: null,
      ground: true,
      path: [
        [10, 55, 0],
        [11, 56, 100],
        [12, 57, 200],
      ],
    });
  });

  it('only splits standard runs at estimated boundaries', () => {
    const runs = buildJourneyTrackRuns(
      [
        track(
          [
            [10, 55, 0],
            [11, 56, 304.8],
            [12, 57, 609.6],
          ],
          { ground: [true, false, false], estimated: [false, false, false] },
        ),
      ],
      { splitByAltitude: false },
    );

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      altitudeFeet: null,
      ground: false,
      estimated: false,
    });
    expect(runs[0]).not.toHaveProperty('samples');
  });
});
