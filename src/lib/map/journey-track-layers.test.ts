import type { Color } from '@deck.gl/core';
import { distance, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';

import {
  buildJourneyTrackPaths,
  type JourneyArc,
  type JourneyTrackPath,
} from './journey-layer-data';
import {
  buildJourneyTrackDisplayPath,
  MAX_JOURNEY_TRACK_DISPLAY_POINTS,
} from './journey-track-display-geometry';
import {
  buildJourneyTrackLayers,
  type JourneyTrackRenderContext,
  prepareJourneyTrackLayerData,
  type RenderableJourneyTrackPath,
  type RenderableJourneyTrackRun,
} from './journey-track-layers';

import {
  toJourneyTrackSamples,
  type JourneyTrackCoordinate,
  type JourneyTrackRow,
} from '$lib/track/schema';
import type { JourneyData } from '$lib/utils';

const paths = [
  {
    journeyId: 1,
    samples: toJourneyTrackSamples({
      coordinates: [
        [10, 55, 0],
        [11, 56, 304.8],
        [12, 57, 609.6],
      ],
      estimated: [false, false, true],
      ground: [true, false, false],
    }),
  },
] as JourneyTrackPath[];

const renderContext = ({
  standardColor = [0, 0, 0],
  estimatedUnderlayColor = [24, 24, 27, 190],
}: {
  standardColor?: Color;
  estimatedUnderlayColor?: Color;
} = {}): JourneyTrackRenderContext => ({
  geometry: { parameters: {}, extensions: [] },
  appearance: {
    getWidth: () => 2,
    getStandardColor: () => standardColor,
    getAltitudeColor: () => [4, 5, 6],
    getGroundCasingColor: () => [9, 9, 11, 220],
    getEstimatedUnderlayColor: () => estimatedUnderlayColor,
    updateTriggers: { width: [], standardColor: [], altitudeColor: [] },
  },
  interaction: { onHover: undefined, onClick: undefined },
});

type RuntimePathLayerProps<T> = {
  data: T[];
  getWidth: (value: T) => number;
  getColor: (value: T, info?: unknown) => Color;
  getPath: (value: T, info?: unknown) => [number, number][];
  getDashArray: (value: T) => [number, number];
  widthMinPixels: number;
  capRounded: boolean;
};

const runtimeProps = <T>(layer: { props: unknown }) =>
  layer.props as RuntimePathLayerProps<T>;

describe('journey track layers', () => {
  it('adaptively follows the globe without changing source coordinates', () => {
    const source = [
      [0, 0, 100],
      [179, 0, 1_000],
    ] as JourneyTrackCoordinate[];

    const display = buildJourneyTrackDisplayPath(source);

    expect(display).toHaveLength(2_049);
    expect(display[0]).toEqual([0, 0]);
    expect(display.at(-1)).toEqual([179, 0]);
    expect(source).toEqual([
      [0, 0, 100],
      [179, 0, 1_000],
    ]);
    for (let index = 1; index < display.length; index++) {
      expect(
        distance(point(display[index - 1]!), point(display[index]!), {
          units: 'meters',
        }),
      ).toBeLessThanOrEqual(19_000.001);
    }
  });

  it('keeps generated antimeridian geometry continuous', () => {
    const source = [
      [170, 10],
      [-170, 10],
    ] as JourneyTrackCoordinate[];
    const display = buildJourneyTrackDisplayPath(source);

    expect(display[0]).toEqual([170, 10]);
    expect(display.at(-1)).toEqual([190, 10]);
    expect(source).toEqual([
      [170, 10],
      [-170, 10],
    ]);
    for (let index = 1; index < display.length; index++) {
      expect(
        Math.abs(display[index]![0] - display[index - 1]![0]),
      ).toBeLessThan(180);
      expect(
        distance(point(display[index - 1]!), point(display[index]!), {
          units: 'meters',
        }),
      ).toBeLessThanOrEqual(19_000.001);
    }
  });

  it('unwraps short antimeridian crossings without tessellation', () => {
    const source = [
      [179.9, 10],
      [-179.9, 10],
    ] as JourneyTrackCoordinate[];

    const display = buildJourneyTrackDisplayPath(source);

    expect(display).toHaveLength(2);
    expect(display[0]).toEqual([179.9, 10]);
    expect(display[1]![0]).toBeCloseTo(180.1);
    expect(display[1]![1]).toBe(10);
    expect(source).toEqual([
      [179.9, 10],
      [-179.9, 10],
    ]);
  });

  it('keeps antipodal fallback geometry continuous after a crossing', () => {
    const source = [
      [170, 10],
      [-170, 10],
      [10, -10],
    ] as JourneyTrackCoordinate[];

    const display = buildJourneyTrackDisplayPath(source);

    expect(display[0]).toEqual([170, 10]);
    expect(display.at(-1)).toEqual([370, -10]);
    expect(source).toEqual([
      [170, 10],
      [-170, 10],
      [10, -10],
    ]);
    for (let index = 1; index < display.length; index++) {
      expect(
        Math.abs(display[index]![0] - display[index - 1]![0]),
      ).toBeLessThan(180);
    }
  });

  it('unwraps canonical crossings only in full-pipeline display geometry', () => {
    const coordinates = [
      [170, 10, 1_000],
      [-170, 10, 2_000],
    ] as JourneyTrackRow['coordinates'];
    const trackPaths = buildJourneyTrackPaths(
      [{ id: 7, from: { id: 1 }, to: { id: 2 } }] as JourneyData[],
      [{ from: { id: 1 }, to: { id: 2 } }] as JourneyArc[],
      [{ journeyId: 7, coordinates }] as JourneyTrackRow[],
    );

    const data = prepareJourneyTrackLayerData(trackPaths, 'standard');

    expect(trackPaths[0]!.samples.map((sample) => sample.coordinate)).toEqual(
      coordinates,
    );
    expect(data.paths[0]!.displayPath[0]).toEqual([170, 10]);
    expect(data.paths[0]!.displayPath.at(-1)).toEqual([190, 10]);
    for (let index = 1; index < data.paths[0]!.displayPath.length; index++) {
      expect(
        Math.abs(
          data.paths[0]!.displayPath[index]![0] -
            data.paths[0]!.displayPath[index - 1]![0],
        ),
      ).toBeLessThan(180);
    }
  });

  it('uses tar1090 distance thresholds and power-of-two subdivision', () => {
    expect(
      buildJourneyTrackDisplayPath([
        [0, 0],
        [0.2, 0],
      ]),
    ).toHaveLength(2);
    expect(
      buildJourneyTrackDisplayPath([
        [0, 0],
        [0.4, 0],
      ]),
    ).toHaveLength(5);
  });

  it('bounds tessellation for pathological maximum-size tracks', () => {
    const source: JourneyTrackCoordinate[] = Array.from(
      { length: 5_000 },
      (_, index): JourneyTrackCoordinate =>
        index % 2 === 0 ? [0, 0] : [179, 0],
    );

    const display = buildJourneyTrackDisplayPath(source);

    expect(display.length).toBeLessThanOrEqual(
      MAX_JOURNEY_TRACK_DISPLAY_POINTS,
    );
    expect(display[0]).toEqual(source[0]);
    expect(display.at(-1)).toEqual(source.at(-1));
  });

  it('shares the display budget across every layer generated for a track', () => {
    const coordinates: JourneyTrackCoordinate[] = Array.from(
      { length: 100 },
      (_, index) => [index % 2 === 0 ? 0 : 179, 0, index * 100],
    );
    const data = prepareJourneyTrackLayerData(
      [
        {
          journeyId: 2,
          samples: toJourneyTrackSamples({ coordinates }),
        } as JourneyTrackPath,
      ],
      'altitude',
    );
    const renderedPointCount =
      data.paths.reduce((total, path) => total + path.displayPath.length, 0) +
      data.solidRuns.reduce((total, run) => total + run.displayPath.length, 0) +
      2 *
        data.estimatedRuns.reduce(
          (total, run) => total + run.displayPath.length,
          0,
        ) +
      data.groundRuns.reduce((total, run) => total + run.displayPath.length, 0);

    expect(renderedPointCount).toBeLessThanOrEqual(
      MAX_JOURNEY_TRACK_DISPLAY_POINTS,
    );
  });

  it('prepares estimated runs for every track style', () => {
    const standardData = prepareJourneyTrackLayerData(paths, 'standard');
    expect(standardData.solidRuns).toHaveLength(1);
    expect(standardData.estimatedRuns).toHaveLength(1);
    expect(standardData.groundRuns).toHaveLength(0);
    expect(standardData.solidRuns[0]).toMatchObject({
      altitudeFeet: null,
      estimated: false,
    });

    const altitudeData = prepareJourneyTrackLayerData(paths, 'altitude');
    expect(altitudeData.solidRuns).toHaveLength(1);
    expect(altitudeData.estimatedRuns).toHaveLength(1);
    expect(altitudeData.groundRuns).toHaveLength(1);
  });

  it('renders estimated standard segments through the dotted layers', () => {
    const data = prepareJourneyTrackLayerData(paths, 'standard');
    const layers = buildJourneyTrackLayers({
      data,
      style: 'standard',
      context: renderContext({ standardColor: [1, 2, 3] }),
    });

    expect(layers[0]!.props.data).toBe(data.solidRuns);
    expect(layers[1]!.props.data).toEqual([]);
    expect(layers[2]!.props.data).toEqual([]);
    expect(layers[3]!.props.data).toBe(data.estimatedRuns);
    expect(layers[4]!.props.data).toBe(data.estimatedRuns);
    const underlayProps = runtimeProps<RenderableJourneyTrackRun>(layers[3]!);
    const estimatedProps = runtimeProps<RenderableJourneyTrackRun>(layers[4]!);
    expect(underlayProps.getWidth(data.estimatedRuns[0]!)).toBeCloseTo(1.12);
    expect(underlayProps.widthMinPixels).toBe(1);
    expect(underlayProps.capRounded).toBe(true);
    expect(estimatedProps.capRounded).toBe(true);
    expect(estimatedProps.getWidth(data.estimatedRuns[0]!)).toBe(2);
    const dashArray = estimatedProps.getDashArray(data.estimatedRuns[0]!);
    expect(dashArray).toEqual([10, 23]);
    expect(
      estimatedProps.getColor(data.estimatedRuns[0]!, {
        index: 0,
        data: data.estimatedRuns,
        target: [],
      }),
    ).toEqual([1, 2, 3]);
  });

  it('owns the complete ordered journey-track layer stack', () => {
    const data = prepareJourneyTrackLayerData(paths, 'altitude');
    const layers = buildJourneyTrackLayers({
      data,
      style: 'altitude',
      context: renderContext(),
    });

    expect(layers.map((layer) => layer.id)).toEqual([
      'track-path-layer',
      'ground-track-casing-layer',
      'altitude-track-path-layer',
      'estimated-track-underlay-layer',
      'estimated-track-path-layer',
      'ghost-track-path',
    ]);
    expect(layers[0]!.props.data).toEqual([]);
    expect(layers[1]!.props.data).toBe(data.groundRuns);
    expect(
      runtimeProps<RenderableJourneyTrackRun>(layers[1]!).getWidth(
        data.groundRuns[0]!,
      ),
    ).toBe(4.5);
    expect(layers[2]!.props.data).toBe(data.solidRuns);
    expect(layers[3]!.props.data).toBe(data.estimatedRuns);
    expect(layers[5]!.props.data).toBe(data.paths);
  });

  it('renders tracks on the map surface while retaining stored altitude', () => {
    const data = prepareJourneyTrackLayerData(paths, 'altitude');
    const layers = buildJourneyTrackLayers({
      data,
      style: 'altitude',
      context: renderContext({ estimatedUnderlayColor: [24, 24, 27, 60] }),
    });

    const visiblePath = runtimeProps<RenderableJourneyTrackRun>(
      layers[2]!,
    ).getPath(data.solidRuns[0]!, {
      index: 0,
      data: data.solidRuns,
      target: [],
    });
    const pickingPath = runtimeProps<RenderableJourneyTrackPath>(
      layers[5]!,
    ).getPath(data.paths[0]!, {
      index: 0,
      data: data.paths,
      target: [],
    });

    expect(visiblePath[0]).toEqual([10, 55]);
    expect(visiblePath.at(-1)).toEqual([11, 56]);
    expect(visiblePath).toHaveLength(9);
    expect(pickingPath[0]).toEqual([10, 55]);
    expect(pickingPath.at(-1)).toEqual([12, 57]);
    expect(pickingPath.every((coordinate) => coordinate.length === 2)).toBe(
      true,
    );
    expect(paths[0]!.samples[1]!.coordinate).toEqual([11, 56, 304.8]);
    expect(
      runtimeProps<RenderableJourneyTrackRun>(layers[3]!).getColor(
        data.estimatedRuns[0]!,
        {
          index: 0,
          data: data.estimatedRuns,
          target: [],
        },
      ),
    ).toEqual([24, 24, 27, 60]);
  });
});
