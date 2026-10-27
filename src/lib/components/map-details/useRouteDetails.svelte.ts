import { page } from '$app/state';
import {
  normalizeRoute,
  routeMatchesEndpoints,
  type JourneyFilters,
  type Route,
} from '$lib/components/journey-filters/types';
import type { NavigateJourneys } from '$lib/journey-navigation';
import { mapDetailsState, openJourneyDetails } from '$lib/state.svelte';
import { type JourneyData } from '$lib/utils';
import {
  convertDistance,
  formatCompactJourneyDate,
  getPreferences,
} from '$lib/utils/preferences';

export function useRouteDetails(
  journeys: () => JourneyData[],
  filters: () => JourneyFilters | undefined,
  onNavigate: NavigateJourneys,
) {
  const prefs = $derived(getPreferences(page.data.user));

  let now = $state(new Date());

  const selectedRoute = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'route' ? selection.route : null;
  });

  $effect(() => {
    if (!selectedRoute) return;
    now = new Date();
    const id = setInterval(() => {
      now = new Date();
    }, 30_000);
    return () => clearInterval(id);
  });

  const matchesRoute = (journey: JourneyData, route: Route) => {
    return routeMatchesEndpoints(journey.from?.id, journey.to?.id, route);
  };

  const routeJourneys = $derived.by(() => {
    if (!selectedRoute) return [];
    return journeys()
      .filter((journey) => matchesRoute(journey, selectedRoute))
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  });

  const routeStations = $derived.by(() => {
    if (!selectedRoute) return null;
    const journey = routeJourneys.find((f) => f.from && f.to);
    if (!journey?.from || !journey.to) return null;

    if (journey.from.id.toString() === selectedRoute.a) {
      return { from: journey.from, to: journey.to };
    }
    return { from: journey.to, to: journey.from };
  });

  const operatorCount = $derived.by(() => {
    const ids = new Set<number>();
    for (const journey of routeJourneys) {
      if (journey.operator) ids.add(journey.operator.id);
    }
    return ids.size;
  });

  const distance = $derived.by(() => {
    const km = routeJourneys.find(
      (f) => typeof f.distance === 'number',
    )?.distance;
    if (typeof km !== 'number') return null;
    return Math.round(convertDistance(km, prefs));
  });

  const lastTravelledLabel = $derived.by(() => {
    const journey = routeJourneys.find((f) => f.date);
    if (!journey?.date) return null;
    return formatCompactJourneyDate(
      journey.date,
      journey.datePrecision ?? 'day',
    );
  });

  const routeFilterActive = $derived.by(() => {
    const f = filters();
    if (!f || !selectedRoute) return false;
    return (
      f.routes.length === 1 &&
      f.routes[0]?.a === selectedRoute.a &&
      f.routes[0]?.b === selectedRoute.b &&
      f.departureStations.length === 0 &&
      f.arrivalStations.length === 0 &&
      f.stationsEither.length === 0
    );
  });

  const toggleRouteFilter = () => {
    const f = filters();
    if (!f || !selectedRoute) return;

    if (routeFilterActive) {
      f.routes = [];
      return;
    }

    f.departureStations = [];
    f.arrivalStations = [];
    f.stationsEither = [];
    f.routes = [normalizeRoute(selectedRoute.a, selectedRoute.b)];
  };

  const showAllJourneys = () => {
    if (!selectedRoute) return;
    onNavigate({
      destination: 'list',
      focus: { type: 'route', route: selectedRoute },
    });
  };

  const showJourney = (journeyId: number) => {
    // Open the journey's details pane; while it's open the map isolates that
    // journey (a derived view of the pane state, not a persistent filter).
    openJourneyDetails(journeyId);
  };

  return {
    get prefs() {
      return prefs;
    },
    get now() {
      return now;
    },
    get selectedRoute() {
      return selectedRoute;
    },
    get routeJourneys() {
      return routeJourneys;
    },
    get routeStations() {
      return routeStations;
    },
    get operatorCount() {
      return operatorCount;
    },
    get distance() {
      return distance;
    },
    get lastTravelledLabel() {
      return lastTravelledLabel;
    },
    get routeFilterActive() {
      return routeFilterActive;
    },
    toggleRouteFilter,
    showAllJourneys,
    showJourney,
  };
}
