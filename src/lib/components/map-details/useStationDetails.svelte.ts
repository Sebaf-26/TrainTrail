import type { JourneyFilters } from '$lib/components/journey-filters/types';
import type { NavigateJourneys } from '$lib/journey-navigation';
import { mapDetailsState, openJourneyDetails } from '$lib/state.svelte';
import { prepareVisitedStations, type JourneyData } from '$lib/utils';

export function useStationDetails(
  journeys: () => JourneyData[],
  filters: () => JourneyFilters | undefined,
  onNavigate: NavigateJourneys,
) {
  const selectedStationId = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'station' ? selection.stationId : null;
  });

  const visited = $derived(prepareVisitedStations(journeys()));

  const station = $derived.by(() => {
    const id = selectedStationId;
    if (id === null) return null;
    return visited.find((a) => a.id === id) ?? null;
  });

  const relatedJourneys = $derived.by(() => {
    const id = selectedStationId;
    if (id === null) return [];
    return journeys().filter((f) => f.from?.id === id || f.to?.id === id);
  });

  const stationFilterActive = $derived.by(() => {
    const f = filters();
    if (!f || !station) return false;
    return (
      f.stationsEither.length === 1 &&
      f.stationsEither[0] === station.id.toString() &&
      f.departureStations.length === 0 &&
      f.arrivalStations.length === 0 &&
      f.routes.length === 0
    );
  });

  const toggleStationFilter = () => {
    const f = filters();
    if (!f || !station) return;

    if (stationFilterActive) {
      f.stationsEither = [];
      return;
    }

    f.departureStations = [];
    f.arrivalStations = [];
    f.routes = [];
    f.stationsEither = [station.id.toString()];
  };

  const showDepartures = () => {
    if (!station) return;
    onNavigate({
      destination: 'list',
      focus: {
        type: 'station',
        stationId: station.id,
        direction: 'departure',
      },
    });
  };

  const showArrivals = () => {
    if (!station) return;
    onNavigate({
      destination: 'list',
      focus: {
        type: 'station',
        stationId: station.id,
        direction: 'arrival',
      },
    });
  };

  const showJourney = (journeyId: number) => {
    openJourneyDetails(journeyId);
  };

  return {
    get station() {
      return station;
    },
    get relatedJourneys() {
      return relatedJourneys;
    },
    get stationFilterActive() {
      return stationFilterActive;
    },
    toggleStationFilter,
    showDepartures,
    showArrivals,
    showJourney,
  };
}
