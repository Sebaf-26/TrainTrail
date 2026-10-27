<script lang="ts">
  import StationDetailsActions from './StationDetailsActions.svelte';
  import StationDetailsBody from './StationDetailsBody.svelte';
  import StationDetailsHeader from './StationDetailsHeader.svelte';
  import MapDetailsFrame from './MapDetailsFrame.svelte';
  import type { useStationDetails } from './useStationDetails.svelte';

  import { closeMapDetails, mapDetailsState } from '$lib/state.svelte';

  let {
    details,
    hasFilters,
  }: {
    details: ReturnType<typeof useStationDetails>;
    hasFilters: boolean;
  } = $props();
</script>

{#snippet header()}
  {#if details.station}
    <StationDetailsHeader station={details.station} />
  {/if}
{/snippet}

{#snippet actions()}
  {#if details.station}
    <StationDetailsActions
      {hasFilters}
      filterActive={details.stationFilterActive}
      onToggleFilter={details.toggleStationFilter}
    />
  {/if}
{/snippet}

<MapDetailsFrame
  open={!!details.station}
  {header}
  {actions}
  onOpenChange={(v) => {
    if (!v && mapDetailsState.selection?.type === 'station') {
      closeMapDetails();
    }
  }}
>
  {#if details.station}
    <StationDetailsBody
      station={details.station}
      relatedJourneys={details.relatedJourneys}
      onShowDepartures={details.showDepartures}
      onShowArrivals={details.showArrivals}
      onShowJourney={details.showJourney}
    />
  {/if}
</MapDetailsFrame>
