<script lang="ts">
  import Filters from './Filters.svelte';

  import type {
    JourneyFilters,
    TempFilters,
  } from '$lib/components/journey-filters/types';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';
  import type { JourneyData } from '$lib/utils';

  let {
    open = $bindable(),
    journeys,
    filters = $bindable(),
    tempFilters = $bindable(),
    hasTempFilters = false,
  }: {
    open: boolean;
    journeys: JourneyData[];
    filters: JourneyFilters;
    tempFilters?: TempFilters;
    hasTempFilters?: boolean;
  } = $props();
</script>

<Modal bind:open class="max-w-lg">
  <ModalHeader class="pb-2">
    <h2 class="text-lg font-medium">Filters</h2>
  </ModalHeader>
  <ModalBody class="overflow-x-hidden pt-2">
    <Filters
      {journeys}
      bind:filters
      bind:tempFilters
      {hasTempFilters}
      layout="stacked"
    />
  </ModalBody>
</Modal>
