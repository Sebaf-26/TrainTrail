import type { Journey } from '$lib/db/types';
import { journeyDistanceKm } from '$lib/utils';
import { isCompletedJourney } from '$lib/utils/data/journey-timeline';

export { isCompletedJourney };

type TopKeyResult = {
  best: string | null;
  count: number;
};

export type JourneyStatsSummary = {
  journeys: number;
  distanceKm: number;
  durationSeconds: number;
  stations: number;
  topOperator: {
    id: number;
    name: string;
    code: string | null;
    count: number;
  } | null;
  topStation: {
    id: number;
    name: string;
    code: string;
    count: number;
  } | null;
  topTrain: {
    id: number;
    name: string;
    code: string | null;
    count: number;
  } | null;
  topRoute: {
    from: {
      id: number;
      name: string;
      code: string;
    };
    to: {
      id: number;
      name: string;
      code: string;
    };
    count: number;
  } | null;
};

const topKey = (
  journeys: Journey[],
  getKey: (journey: Journey) => string | null,
): TopKeyResult => {
  const counts = new Map<string, number>();
  for (const journey of journeys) {
    const key = getKey(journey);
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let best: string | null = null;
  let count = 0;
  for (const [key, currentCount] of counts) {
    if (currentCount > count) {
      best = key;
      count = currentCount;
    }
  }

  return { best, count };
};

export const completedJourneys = (
  journeys: Journey[],
  now: Date = new Date(),
): Journey[] => journeys.filter((journey) => isCompletedJourney(journey, now));

export const computeJourneyStatsSummary = (
  journeys: Journey[],
): JourneyStatsSummary => {
  let totalDistanceKm = 0;
  let totalDurationSeconds = 0;
  const stationIds = new Set<string>();

  for (const journey of journeys) {
    totalDistanceKm += journeyDistanceKm(journey) ?? 0;

    if (journey.duration !== null) {
      totalDurationSeconds += journey.duration;
    }

    if (journey.from?.id) stationIds.add(String(journey.from.id));
    if (journey.to?.id) stationIds.add(String(journey.to.id));
  }

  const operatorResult = topKey(journeys, (journey) =>
    journey.operator ? String(journey.operator.id) : null,
  );
  const topOperator = operatorResult.best
    ? (() => {
        const operator = journeys.find(
          (journey) => String(journey.operator?.id) === operatorResult.best,
        )!.operator!;
        return {
          id: operator.id,
          name: operator.name,
          code: operator.code,
          count: operatorResult.count,
        };
      })()
    : null;

  const stationCounts = new Map<string, number>();
  for (const journey of journeys) {
    if (journey.from?.id) {
      stationCounts.set(
        String(journey.from.id),
        (stationCounts.get(String(journey.from.id)) ?? 0) + 1,
      );
    }
    if (journey.to?.id) {
      stationCounts.set(
        String(journey.to.id),
        (stationCounts.get(String(journey.to.id)) ?? 0) + 1,
      );
    }
  }

  let bestStationId: string | null = null;
  let bestStationCount = 0;
  for (const [id, count] of stationCounts) {
    if (count > bestStationCount) {
      bestStationId = id;
      bestStationCount = count;
    }
  }
  const topStation = bestStationId
    ? (() => {
        const journey = journeys.find(
          (journey) =>
            String(journey.from?.id) === bestStationId ||
            String(journey.to?.id) === bestStationId,
        )!;
        const station =
          String(journey.from?.id) === bestStationId
            ? journey.from!
            : journey.to!;
        return {
          id: station.id,
          name: station.name,
          code: station.code,
          count: bestStationCount,
        };
      })()
    : null;

  const trainResult = topKey(journeys, (journey) =>
    journey.train ? String(journey.train.id) : null,
  );
  const topTrain = trainResult.best
    ? (() => {
        const train = journeys.find(
          (journey) => String(journey.train?.id) === trainResult.best,
        )!.train!;
        return {
          id: train.id,
          name: train.name,
          code: train.code,
          count: trainResult.count,
        };
      })()
    : null;

  const routeResult = topKey(journeys, (journey) =>
    journey.from && journey.to ? `${journey.from.id}|${journey.to.id}` : null,
  );
  const topRoute = routeResult.best
    ? (() => {
        const journey = journeys.find(
          (journey) =>
            journey.from &&
            journey.to &&
            `${journey.from.id}|${journey.to.id}` === routeResult.best,
        )!;
        return {
          from: {
            id: journey.from!.id,
            name: journey.from!.name,
            code: journey.from!.code,
          },
          to: {
            id: journey.to!.id,
            name: journey.to!.name,
            code: journey.to!.code,
          },
          count: routeResult.count,
        };
      })()
    : null;

  return {
    journeys: journeys.length,
    distanceKm: Math.round(totalDistanceKm),
    durationSeconds: totalDurationSeconds,
    stations: stationIds.size,
    topOperator,
    topStation,
    topTrain,
    topRoute,
  };
};

export const computeCompletedJourneyStatsSummary = (
  journeys: Journey[],
): JourneyStatsSummary =>
  computeJourneyStatsSummary(completedJourneys(journeys));
