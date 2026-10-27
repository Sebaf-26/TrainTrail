import { describe, expect, it } from 'vitest';

import {
  buildJourneyTrackPaths,
  hasFallbackJourneyArcs,
  type JourneyArc,
} from './journey-layer-data';

import type { JourneyTrackRow } from '$lib/track/schema';
import type { JourneyData } from '$lib/utils';

describe('journey track layer data', () => {
  it('preserves canonical source coordinates in render paths', () => {
    const journeys = [
      { id: 7, from: { id: 1 }, to: { id: 2 } },
    ] as JourneyData[];
    const arcs = [{ from: { id: 1 }, to: { id: 2 } }] as JourneyArc[];
    const coordinates = [
      [179, 55, 1_000],
      [-179, 56, 2_000],
      [-178, 57],
    ] as JourneyTrackRow['coordinates'];
    const tracks = [{ journeyId: 7, coordinates }] as JourneyTrackRow[];

    const paths = buildJourneyTrackPaths(journeys, arcs, tracks);

    expect(paths[0]!.samples.map((sample) => sample.coordinate)).toEqual(
      coordinates,
    );
  });

  it('carries aligned flags into render paths', () => {
    const journeys = [
      { id: 7, from: { id: 1 }, to: { id: 2 } },
    ] as JourneyData[];
    const arcs = [{ from: { id: 1 }, to: { id: 2 } }] as JourneyArc[];
    const tracks = [
      {
        journeyId: 7,
        coordinates: [
          [10, 55, 0],
          [11, 56, 304.8],
        ],
        ground: [true, false],
        estimated: [false, true],
        sourceFormat: 'kml',
        pointCount: 2,
      },
    ] as JourneyTrackRow[];

    const paths = buildJourneyTrackPaths(journeys, arcs, tracks);

    expect(paths).toMatchObject([
      {
        journeyId: 7,
        samples: [
          {
            coordinate: [10, 55, 0],
            point: { ground: true },
            incomingEdge: { estimated: false },
          },
          {
            coordinate: [11, 56, 304.8],
            point: { ground: false },
            incomingEdge: { estimated: true },
          },
        ],
      },
    ]);
    expect(paths[0]!.samples).toHaveLength(2);
  });

  it('detects whether route arcs remain after tracked journeys are replaced', () => {
    const arcs = [
      {
        from: { id: 1 },
        to: { id: 2 },
        journeys: [{ id: 7 }, { id: 8 }],
      },
    ] as JourneyArc[];

    expect(hasFallbackJourneyArcs(arcs, new Set([7]))).toBe(true);
    expect(hasFallbackJourneyArcs(arcs, new Set([7, 8]))).toBe(false);
  });
});
