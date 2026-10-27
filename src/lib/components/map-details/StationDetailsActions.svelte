<script lang="ts">
  import { Funnel, Locate, X } from '@o7/icon/lucide';

  import { closeMapDetails, focusMapDetails } from '$lib/state.svelte';

  import DetailsActionButton from './DetailsActionButton.svelte';

  let {
    hasFilters,
    filterActive,
    onToggleFilter,
  }: {
    hasFilters: boolean;
    filterActive: boolean;
    onToggleFilter: () => void;
  } = $props();
</script>

<DetailsActionButton
  label="Locate station"
  shortLabel="Locate"
  icon={Locate}
  onclick={focusMapDetails}
/>
{#if hasFilters}
  <DetailsActionButton
    label={filterActive ? 'Clear station filter' : 'Filter map to station'}
    shortLabel={filterActive ? 'Clear' : 'Filter'}
    icon={Funnel}
    onclick={onToggleFilter}
    pressed={filterActive}
  />
{/if}
<DetailsActionButton
  label="Close details"
  shortLabel="Close"
  icon={X}
  onclick={closeMapDetails}
/>
