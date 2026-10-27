<script lang="ts">
  import { closeMapDetails, mapDetailsState } from '$lib/state.svelte';

  import JourneyDetailsActions from './JourneyDetailsActions.svelte';
  import JourneyDetailsBody from './JourneyDetailsBody.svelte';
  import JourneyDetailsHeader from './JourneyDetailsHeader.svelte';
  import MapDetailsFrame from './MapDetailsFrame.svelte';
  import type { useJourneyDetails } from './useJourneyDetails.svelte';

  let {
    details,
    seatUserId,
  }: {
    details: ReturnType<typeof useJourneyDetails>;
    seatUserId?: string;
  } = $props();
</script>

{#snippet header()}
  {#if details.journey}
    <JourneyDetailsHeader
      journey={details.journey}
      onShowRoute={details.showRoute}
    />
  {/if}
{/snippet}

{#snippet actions()}
  {#if details.journey}
    <JourneyDetailsActions />
  {/if}
{/snippet}

<MapDetailsFrame
  open={!!details.journey}
  {header}
  {actions}
  onOpenChange={(v) => {
    if (!v && mapDetailsState.selection?.type === 'journey') {
      closeMapDetails();
    }
  }}
>
  {#if details.journey}
    <JourneyDetailsBody
      journey={details.journey}
      prefs={details.prefs}
      {seatUserId}
      onShowInList={details.showInList}
    />
  {/if}
</MapDetailsFrame>
