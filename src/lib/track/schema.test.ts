import { describe, expect, it } from 'vitest';

import {
  fromJourneyTrackSamples,
  journeyTrackPayloadSchema,
  toJourneyTrackSamples,
  toJourneyTrackInput,
  toJourneyTrackPayload,
} from './schema';

const track = {
  coordinates: [
    [10, 55, 0],
    [11, 56, 304.8],
  ] as [number, number, number][],
  times: [1_700_000_000, 1_700_000_060],
  groundSpeedKt: [0, 120],
  trackDeg: [90, 95],
  ground: [true, false],
  estimated: [false, true],
};

describe('journey track schema helpers', () => {
  it('rejects point flags that are not aligned with coordinates', () => {
    expect(
      journeyTrackPayloadSchema.safeParse({ ...track, ground: [true] }).success,
    ).toBe(false);
    expect(
      journeyTrackPayloadSchema.safeParse({ ...track, estimated: [false] })
        .success,
    ).toBe(false);
  });

  it('rejects coordinates outside valid longitude and latitude ranges', () => {
    expect(
      journeyTrackPayloadSchema.safeParse({
        coordinates: [
          [181, 55],
          [11, 56],
        ],
      }).success,
    ).toBe(false);
    expect(
      journeyTrackPayloadSchema.safeParse({
        coordinates: [
          [10, -91],
          [11, 56],
        ],
      }).success,
    ).toBe(false);
  });

  it('copies every aligned property into database payloads', () => {
    expect(toJourneyTrackPayload(track)).toEqual(track);
  });

  it('converts persistence columns to explicit point and edge samples', () => {
    const samples = toJourneyTrackSamples(track);

    expect(samples[1]).toEqual({
      coordinate: [11, 56, 304.8],
      point: {
        time: 1_700_000_060,
        groundSpeedKt: 120,
        trackDeg: 95,
        ground: false,
      },
      incomingEdge: { estimated: true },
    });
    expect(fromJourneyTrackSamples(samples)).toEqual(track);
  });

  it('can omit shared timestamps without dropping point flags', () => {
    expect(
      toJourneyTrackInput(
        {
          ...track,
          sourceFormat: 'kml',
          sourceName: 'journey.kml',
        },
        { includeTimes: false },
      ),
    ).toEqual({
      coordinates: track.coordinates,
      groundSpeedKt: track.groundSpeedKt,
      trackDeg: track.trackDeg,
      ground: track.ground,
      estimated: track.estimated,
      sourceFormat: 'kml',
      sourceName: 'journey.kml',
    });
  });
});
