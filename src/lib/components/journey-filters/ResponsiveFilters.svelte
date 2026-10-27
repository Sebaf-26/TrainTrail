<script lang="ts">
  import { Funnel } from '@o7/icon/lucide';

  import Filters from './Filters.svelte';
  import MobileFiltersModal from './MobileFiltersModal.svelte';

  import type {
    JourneyFilters,
    TempFilters,
  } from '$lib/components/journey-filters/types';
  import { hasJourneyFilters } from '$lib/components/journey-filters/model';
  import { Button } from '$lib/components/ui/button';
  import { isMediumScreen } from '$lib/utils/size';
  import type { JourneyData } from '$lib/utils';

  let {
    journeys,
    filters = $bindable(),
    tempFilters = $bindable(),
    hasTempFilters = false,
  }: {
    journeys: JourneyData[];
    filters: JourneyFilters;
    tempFilters?: TempFilters;
    hasTempFilters?: boolean;
  } = $props();

  let drawerOpen = $state(false);

  const filtersApplied = $derived(hasTempFilters || hasJourneyFilters(filters));
</script>

{#if $isMediumScreen}
  <Filters {journeys} bind:filters bind:tempFilters {hasTempFilters} />
{:else}
  <span class="relative inline-flex">
    <Button
      variant="outline"
      size="sm"
      class="gap-2"
      disabled={journeys.length === 0}
      onclick={() => (drawerOpen = true)}
    >
      <Funnel size={16} />
      Filters
    </Button>
    {#if filtersApplied}
      <span
        aria-hidden="true"
        class="pointer-events-none absolute -right-1 -top-1 size-2.5 rounded-full bg-blue-500 ring-2 ring-background"
      ></span>
    {/if}
  </span>

  <MobileFiltersModal
    bind:open={drawerOpen}
    {journeys}
    bind:filters
    bind:tempFilters
    {hasTempFilters}
  />
{/if}
