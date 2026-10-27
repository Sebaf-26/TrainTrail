<script lang="ts">
  import NumberFlow from '@number-flow/svelte';

  import { page } from '$app/state';
  import type { JourneyArc } from '$lib/map/journey-layer-data';
  import { pluralize } from '$lib/utils';
  import {
    convertDistance,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';

  import PopupJourneyList from './PopupJourneyList.svelte';

  const prefs = $derived(getPreferences(page.data.user));

  let { data, clickable }: { data: JourneyArc; clickable: boolean } = $props();
</script>

{#snippet routeStop(station: typeof data.from)}
  <div class="flex items-center gap-2 py-1">
    <img
      src="https://flagcdn.com/{station.country.toLowerCase()}.svg"
      alt={station.country}
      class="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/10 dark:ring-white/15"
    />
    <span
      class="min-w-0 flex-1 truncate text-lg leading-tight font-semibold tracking-tight"
    >
      {station.name}
    </span>
    {#if station.municipality}
      <span class="max-w-28 shrink-0 truncate text-xs text-muted-foreground">
        {station.municipality}
      </span>
    {/if}
  </div>
{/snippet}

<div class="w-80 max-w-[calc(100vw-2rem)]">
  <div class="px-4 pt-3 pb-2.5">
    <h3 class="text-xs font-medium text-muted-foreground">Route</h3>
    <div class="mt-2">
      {@render routeStop(data.from)}

      <div
        class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5 text-[11px] text-muted-foreground tabular-nums"
      >
        <div class="h-px bg-border/60"></div>
        <div class="flex items-center gap-1.5 whitespace-nowrap">
          <span>
            <NumberFlow
              value={Math.round(convertDistance(data.distance, prefs))}
            />
            {distanceUnitLabel(prefs)}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <NumberFlow value={data.journeys.length} />
            {pluralize(data.journeys.length, 'trip')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <NumberFlow value={data.operators.length} />
            {pluralize(data.operators.length, 'operator')}
          </span>
        </div>
        <div class="h-px bg-border/60"></div>
      </div>

      {@render routeStop(data.to)}
    </div>
  </div>

  <PopupJourneyList journeys={data.journeys} />

  {#if clickable}
    <div class="border-t border-border/50 px-4 py-2">
      <p class="text-center text-xs text-muted-foreground">
        Click for route details
      </p>
    </div>
  {/if}
</div>
