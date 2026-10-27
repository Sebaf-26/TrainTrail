<script lang="ts">
  import StationDetailsActions from './StationDetailsActions.svelte';
  import StationDetailsBody from './StationDetailsBody.svelte';
  import StationDetailsContent from './StationDetailsContent.svelte';
  import StationDetailsHeader from './StationDetailsHeader.svelte';
  import JourneyDetailsActions from './JourneyDetailsActions.svelte';
  import JourneyDetailsBody from './JourneyDetailsBody.svelte';
  import JourneyDetailsContent from './JourneyDetailsContent.svelte';
  import JourneyDetailsHeader from './JourneyDetailsHeader.svelte';
  import MapDetailsFrame from './MapDetailsFrame.svelte';
  import RouteDetailsActions from './RouteDetailsActions.svelte';
  import RouteDetailsBody from './RouteDetailsBody.svelte';
  import RouteDetailsContent from './RouteDetailsContent.svelte';
  import RouteDetailsHeader from './RouteDetailsHeader.svelte';
  import { useStationDetails } from './useStationDetails.svelte';
  import { useJourneyDetails } from './useJourneyDetails.svelte';
  import { useRouteDetails } from './useRouteDetails.svelte';

  import type { JourneyFilters } from '$lib/components/journey-filters/types';
  import type { NavigateJourneys } from '$lib/journey-navigation';
  import { closeMapDetails, mapDetailsState } from '$lib/state.svelte';
  import type { JourneyData } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  let {
    journeys,
    filters = $bindable(),
    seatUserId,
    onNavigate,
  }: {
    journeys: JourneyData[];
    filters?: JourneyFilters;
    seatUserId?: string;
    onNavigate: NavigateJourneys;
  } = $props();

  const navigateJourneys: NavigateJourneys = (intent) => onNavigate(intent);

  const station = useStationDetails(
    () => journeys,
    () => filters,
    navigateJourneys,
  );

  const route = useRouteDetails(
    () => journeys,
    () => filters,
    navigateJourneys,
  );

  const journey = useJourneyDetails(() => journeys, navigateJourneys);

  const mobileOpen = $derived.by(() => {
    const selection = mapDetailsState.selection;
    if (selection?.type === 'station') return !!station.station;
    if (selection?.type === 'route') return !!route.routeStations;
    if (selection?.type === 'journey') return !!journey.journey;
    return false;
  });
</script>

{#if $isMediumScreen}
  <StationDetailsContent details={station} hasFilters={!!filters} />
  <RouteDetailsContent details={route} hasFilters={!!filters} />
  <JourneyDetailsContent details={journey} {seatUserId} />
{:else}
  {#snippet mobileHeader()}
    {#if mapDetailsState.selection?.type === 'station' && station.station}
      <StationDetailsHeader station={station.station} />
    {:else if mapDetailsState.selection?.type === 'route' && route.routeStations}
      <RouteDetailsHeader
        routeStations={route.routeStations}
        prefs={route.prefs}
        now={route.now}
        distance={route.distance}
      />
    {:else if mapDetailsState.selection?.type === 'journey' && journey.journey}
      <JourneyDetailsHeader
        journey={journey.journey}
        onShowRoute={journey.showRoute}
      />
    {/if}
  {/snippet}

  {#snippet mobileActions()}
    {#if mapDetailsState.selection?.type === 'station' && station.station}
      <StationDetailsActions
        hasFilters={!!filters}
        filterActive={station.stationFilterActive}
        onToggleFilter={station.toggleStationFilter}
      />
    {:else if mapDetailsState.selection?.type === 'route' && route.routeStations}
      <RouteDetailsActions
        hasFilters={!!filters}
        filterActive={route.routeFilterActive}
        onToggleFilter={route.toggleRouteFilter}
      />
    {:else if mapDetailsState.selection?.type === 'journey' && journey.journey}
      <JourneyDetailsActions />
    {/if}
  {/snippet}

  <MapDetailsFrame
    open={mobileOpen}
    header={mobileHeader}
    actions={mobileActions}
    onOpenChange={(v) => {
      if (!v) closeMapDetails();
    }}
  >
    {#if mapDetailsState.selection?.type === 'station' && station.station}
      <StationDetailsBody
        station={station.station}
        relatedJourneys={station.relatedJourneys}
        onShowDepartures={station.showDepartures}
        onShowArrivals={station.showArrivals}
        onShowJourney={station.showJourney}
      />
    {:else if mapDetailsState.selection?.type === 'route' && route.routeStations}
      <RouteDetailsBody
        routeJourneys={route.routeJourneys}
        operatorCount={route.operatorCount}
        distance={route.distance}
        lastTravelledLabel={route.lastTravelledLabel}
        prefs={route.prefs}
        onShowAll={route.showAllJourneys}
        onShowJourney={route.showJourney}
      />
    {:else if mapDetailsState.selection?.type === 'journey' && journey.journey}
      <JourneyDetailsBody
        journey={journey.journey}
        prefs={journey.prefs}
        {seatUserId}
        onShowInList={journey.showInList}
      />
    {/if}
  </MapDetailsFrame>
{/if}
