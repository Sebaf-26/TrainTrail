import type { Color, LayerExtension } from '@deck.gl/core';
import { PathStyleExtension } from '@deck.gl/extensions';
import { PathLayer, type PathLayerProps } from '@deck.gl/layers';

import type {
  JourneyArc,
  JourneyTrackIdentity,
  JourneyTrackPath,
} from './journey-layer-data';
import { buildJourneyTrackDisplayPaths } from './journey-track-display-geometry';
import {
  buildJourneyTrackRuns,
  type JourneyTrackRun,
} from './journey-track-style';
import type { JourneyTrackStyle } from './map-preferences.svelte';

type PathParameters = PathLayerProps<JourneyTrackPath>['parameters'];
type PathHoverHandler = PathLayerProps<JourneyTrackPath>['onHover'];
type PathClickHandler = PathLayerProps<JourneyTrackPath>['onClick'];

export type RenderableJourneyTrackPath = JourneyTrackPath & {
  displayPath: [number, number][];
};

export type RenderableJourneyTrackRun = JourneyTrackRun & {
  displayPath: [number, number][];
};

export type JourneyTrackLayerData = {
  paths: RenderableJourneyTrackPath[];
  solidRuns: RenderableJourneyTrackRun[];
  estimatedRuns: RenderableJourneyTrackRun[];
  groundRuns: RenderableJourneyTrackRun[];
};

type JourneyTrackLayerOptions = {
  data: JourneyTrackLayerData;
  style: JourneyTrackStyle;
  context: JourneyTrackRenderContext;
};

export type JourneyTrackRenderContext = {
  geometry: {
    parameters: PathParameters;
    extensions: LayerExtension[];
  };
  appearance: {
    getWidth: (track: JourneyArc) => number;
    getStandardColor: (track: JourneyTrackIdentity) => Color;
    getAltitudeColor: (run: JourneyTrackRun) => Color;
    getGroundCasingColor: (run: JourneyTrackRun) => Color;
    getEstimatedUnderlayColor: (run: JourneyTrackRun) => Color;
    updateTriggers: {
      width: readonly unknown[];
      standardColor: readonly unknown[];
      altitudeColor: readonly unknown[];
    };
  };
  interaction: {
    onHover: PathHoverHandler;
    onClick: PathClickHandler;
  };
};

const estimatedPathStyle = new PathStyleExtension({
  dash: true,
  highPrecisionDash: true,
});
const ESTIMATED_UNDERLAY_WIDTH_SCALE = 0.56;

export const prepareJourneyTrackLayerData = (
  paths: JourneyTrackPath[],
  style: JourneyTrackStyle,
): JourneyTrackLayerData => {
  const preparedPaths: RenderableJourneyTrackPath[] = [];
  const preparedRuns: RenderableJourneyTrackRun[] = [];

  for (const path of paths) {
    const sourcePath = path.samples.map((sample) => sample.coordinate);
    const runs = buildJourneyTrackRuns([path], {
      splitByAltitude: style === 'altitude',
    });
    const [trackDisplayPath, ...runDisplayPaths] =
      buildJourneyTrackDisplayPaths([
        { path: sourcePath, layerCount: 1 },
        ...runs.map((run) => ({
          path: run.path,
          layerCount:
            (run.estimated ? 2 : 1) +
            (style === 'altitude' && run.ground ? 1 : 0),
        })),
      ]);

    preparedPaths.push({
      ...path,
      displayPath: trackDisplayPath!,
    });
    preparedRuns.push(
      ...runs.map((run, index) => ({
        ...run,
        displayPath: runDisplayPaths[index]!,
      })),
    );
  }

  return {
    paths: preparedPaths,
    solidRuns: preparedRuns.filter((run) => !run.estimated),
    estimatedRuns: preparedRuns.filter((run) => run.estimated),
    groundRuns: preparedRuns.filter((run) => run.ground),
  };
};

export const buildJourneyTrackLayers = ({
  data,
  style,
  context: {
    geometry: { parameters, extensions },
    appearance: {
      getWidth,
      getStandardColor,
      getAltitudeColor,
      getGroundCasingColor,
      getEstimatedUnderlayColor,
      updateTriggers: {
        width: widthUpdateTriggers,
        standardColor: standardColorUpdateTriggers,
        altitudeColor: altitudeColorUpdateTriggers,
      },
    },
    interaction: { onHover, onClick },
  },
}: JourneyTrackLayerOptions) => {
  const sharedPathOptions = {
    parameters,
    getWidth,
    widthUnits: 'pixels' as const,
    jointRounded: true,
    updateTriggers: {
      getWidth: widthUpdateTriggers,
    },
  };

  return [
    new PathLayer<RenderableJourneyTrackRun>({
      ...sharedPathOptions,
      id: 'track-path-layer',
      extensions,
      data: style === 'standard' ? data.solidRuns : [],
      getPath: (track) => track.displayPath,
      getColor: getStandardColor,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: standardColorUpdateTriggers,
      },
    }),
    new PathLayer<RenderableJourneyTrackRun>({
      ...sharedPathOptions,
      id: 'ground-track-casing-layer',
      extensions,
      data: style === 'altitude' ? data.groundRuns : [],
      getPath: (run) => run.displayPath,
      getColor: getGroundCasingColor,
      getWidth: (run) => getWidth(run) + 2.5,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: altitudeColorUpdateTriggers,
      },
    }),
    new PathLayer<RenderableJourneyTrackRun>({
      ...sharedPathOptions,
      id: 'altitude-track-path-layer',
      extensions,
      data: style === 'altitude' ? data.solidRuns : [],
      getPath: (run) => run.displayPath,
      getColor: getAltitudeColor,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: altitudeColorUpdateTriggers,
      },
    }),
    new PathLayer<RenderableJourneyTrackRun>({
      ...sharedPathOptions,
      id: 'estimated-track-underlay-layer',
      extensions,
      data: data.estimatedRuns,
      getPath: (run) => run.displayPath,
      getColor: getEstimatedUnderlayColor,
      getWidth: (run) => getWidth(run) * ESTIMATED_UNDERLAY_WIDTH_SCALE,
      widthMinPixels: 1,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: altitudeColorUpdateTriggers,
      },
    }),
    new PathLayer<RenderableJourneyTrackRun>({
      ...sharedPathOptions,
      id: 'estimated-track-path-layer',
      extensions: [...extensions, estimatedPathStyle],
      data: data.estimatedRuns,
      getPath: (run) => run.displayPath,
      getColor: style === 'standard' ? getStandardColor : getAltitudeColor,
      getDashArray: (run: RenderableJourneyTrackRun) => {
        const width = Math.max(1, getWidth(run));
        const halfWidth = width / 2;
        return [10 / halfWidth, (20 + 1.5 * width) / halfWidth];
      },
      dashJustified: false,
      dashGapPickable: false,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor:
          style === 'standard'
            ? standardColorUpdateTriggers
            : altitudeColorUpdateTriggers,
        getDashArray: widthUpdateTriggers,
      },
    } as PathLayerProps<RenderableJourneyTrackRun> & {
      getDashArray: (run: RenderableJourneyTrackRun) => [number, number];
    }),
    new PathLayer<RenderableJourneyTrackPath>({
      id: 'ghost-track-path',
      parameters,
      extensions,
      data: data.paths,
      getPath: (track) => track.displayPath,
      getColor: [0, 0, 0, 0],
      getWidth: 18,
      widthUnits: 'pixels',
      pickable: true,
      onHover,
      onClick,
      jointRounded: true,
      capRounded: true,
    }),
  ];
};
