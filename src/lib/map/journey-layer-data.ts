import {
  routeMatchesEndpoints,
  type Route,
} from '$lib/components/journey-filters/types';
import {
  toJourneyTrackSamples,
  type JourneyTrackRow,
  type JourneyTrackSample,
} from '$lib/track/schema';
import type { prepareJourneyArcData, JourneyData } from '$lib/utils';

export type JourneyArc = ReturnType<typeof prepareJourneyArcData>[number];

export type JourneyTrackIdentity = JourneyArc & {
  journeyId: number;
};

export type JourneyTrackPath = JourneyTrackIdentity & {
  samples: JourneyTrackSample[];
};

export const getRouteKey = (fromId: number, toId: number) =>
  fromId <= toId ? `${fromId}:${toId}` : `${toId}:${fromId}`;

export const routeMatchesArc = (
  arc: JourneyArc,
  route: Route | null | undefined,
) => {
  return routeMatchesEndpoints(arc.from.id, arc.to.id, route);
};

export const buildArcFrequencyPercentileByRoute = (
  journeyArcs: JourneyArc[],
) => {
  const percentileByRoute: Record<string, number> = {};
  if (journeyArcs.length === 0) return percentileByRoute;

  const frequencies = [
    ...new Set(journeyArcs.map((arc) => arc.frequency)),
  ].sort((a, b) => a - b);
  if (frequencies.length === 1) {
    for (const arc of journeyArcs) {
      percentileByRoute[getRouteKey(arc.from.id, arc.to.id)] = 0;
    }
    return percentileByRoute;
  }

  const denominator = frequencies.length - 1;
  const percentileByFrequency = new Map<number, number>();

  for (const [rank, frequency] of frequencies.entries()) {
    percentileByFrequency.set(frequency, rank / denominator);
  }

  for (const arc of journeyArcs) {
    percentileByRoute[getRouteKey(arc.from.id, arc.to.id)] =
      percentileByFrequency.get(arc.frequency) ?? 0;
  }

  return percentileByRoute;
};

export const findFullyTrackedRouteKeys = (
  journeyArcs: JourneyArc[],
  trackJourneyIds: Set<number>,
) => {
  const keys = new Set<string>();
  for (const arc of journeyArcs) {
    if (
      arc.journeys.length > 0 &&
      arc.journeys.every((journey) => trackJourneyIds.has(journey.id))
    ) {
      keys.add(getRouteKey(arc.from.id, arc.to.id));
    }
  }
  return keys;
};

export const hasFallbackJourneyArcs = (
  journeyArcs: JourneyArc[],
  trackJourneyIds: Set<number>,
) => {
  const fullyTrackedRouteKeys = findFullyTrackedRouteKeys(
    journeyArcs,
    trackJourneyIds,
  );
  return journeyArcs.some(
    (arc) => !fullyTrackedRouteKeys.has(getRouteKey(arc.from.id, arc.to.id)),
  );
};

export const buildJourneyTrackPaths = (
  journeys: JourneyData[],
  journeyArcs: JourneyArc[],
  journeyTracks: JourneyTrackRow[],
) => {
  const paths: JourneyTrackPath[] = [];
  const journeyById = new Map(journeys.map((journey) => [journey.id, journey]));
  const arcByRoute = new Map(
    journeyArcs.map((arc) => [getRouteKey(arc.from.id, arc.to.id), arc]),
  );

  for (const track of journeyTracks) {
    const journey = journeyById.get(track.journeyId);
    if (!journey?.from || !journey.to) continue;

    const arc = arcByRoute.get(getRouteKey(journey.from.id, journey.to.id));
    if (!arc) continue;

    paths.push({
      ...arc,
      journeyId: track.journeyId,
      samples: toJourneyTrackSamples(track),
    });
  }

  return paths;
};
