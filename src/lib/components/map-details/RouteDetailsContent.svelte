<script lang="ts">
  import { closeMapDetails, mapDetailsState } from '$lib/state.svelte';

  import MapDetailsFrame from './MapDetailsFrame.svelte';
  import RouteDetailsActions from './RouteDetailsActions.svelte';
  import RouteDetailsBody from './RouteDetailsBody.svelte';
  import RouteDetailsHeader from './RouteDetailsHeader.svelte';
  import type { useRouteDetails } from './useRouteDetails.svelte';

  let {
    details,
    hasFilters,
  }: {
    details: ReturnType<typeof useRouteDetails>;
    hasFilters: boolean;
  } = $props();
</script>

{#snippet header()}
  {#if details.routeStations}
    <RouteDetailsHeader
      routeStations={details.routeStations}
      prefs={details.prefs}
      now={details.now}
      distance={details.distance}
    />
  {/if}
{/snippet}

{#snippet actions()}
  {#if details.routeStations}
    <RouteDetailsActions
      {hasFilters}
      filterActive={details.routeFilterActive}
      onToggleFilter={details.toggleRouteFilter}
    />
  {/if}
{/snippet}

<MapDetailsFrame
  open={!!details.routeStations}
  {header}
  {actions}
  onOpenChange={(v) => {
    if (!v && mapDetailsState.selection?.type === 'route') {
      closeMapDetails();
    }
  }}
>
  {#if details.routeStations}
    <RouteDetailsBody
      routeJourneys={details.routeJourneys}
      operatorCount={details.operatorCount}
      distance={details.distance}
      lastTravelledLabel={details.lastTravelledLabel}
      prefs={details.prefs}
      onShowAll={details.showAllJourneys}
      onShowJourney={details.showJourney}
    />
  {/if}
</MapDetailsFrame>
