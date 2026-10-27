import {
  routeMatchesEndpoints,
  type Route,
} from '$lib/components/journey-filters/types';

export const canShowJourneyOnMap = (journey: {
  from: unknown | null;
  to: unknown | null;
}) => journey.from !== null && journey.to !== null;

export const includeFocusedRouteOnMap = <
  T extends {
    id: number;
    from: { id: number } | null;
    to: { id: number } | null;
  },
>(
  filteredJourneys: T[],
  allJourneys: T[],
  route: Route | null,
) => {
  if (!route) return filteredJourneys;

  const visibleIds = new Set(filteredJourneys.map((journey) => journey.id));
  const routeJourneys = allJourneys.filter((journey) => {
    if (!journey.from || !journey.to || visibleIds.has(journey.id))
      return false;
    return routeMatchesEndpoints(journey.from.id, journey.to.id, route);
  });

  return routeJourneys.length
    ? [...filteredJourneys, ...routeJourneys]
    : filteredJourneys;
};

export const includeFocusedJourneyInList = <T extends { id: number }>(
  filteredJourneys: T[],
  allJourneys: T[],
  focusedJourneyId: number | null,
) => {
  if (
    focusedJourneyId === null ||
    filteredJourneys.some((journey) => journey.id === focusedJourneyId)
  ) {
    return {
      journeys: filteredJourneys,
      focusedJourneyOutsideFilters: false,
    };
  }

  const focusedJourney = allJourneys.find(
    (journey) => journey.id === focusedJourneyId,
  );
  if (!focusedJourney) {
    return {
      journeys: filteredJourneys,
      focusedJourneyOutsideFilters: false,
    };
  }

  return {
    journeys: [...filteredJourneys, focusedJourney],
    focusedJourneyOutsideFilters: true,
  };
};
