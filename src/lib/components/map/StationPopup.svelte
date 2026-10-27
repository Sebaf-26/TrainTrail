<script lang="ts">
  import NumberFlow from '@number-flow/svelte';

  import { pluralize, type prepareVisitedStations } from '$lib/utils';

  import PopupJourneyList from './PopupJourneyList.svelte';

  type VisitedStation = ReturnType<typeof prepareVisitedStations>[number];

  let { data, clickable }: { data: VisitedStation; clickable: boolean } =
    $props();
</script>

<div class="w-80 max-w-[calc(100vw-2rem)]">
  <div class="px-4 pt-3 pb-2.5">
    <h3 class="text-xs font-medium text-muted-foreground">Station</h3>
    <div class="mt-2">
      <div class="flex items-center gap-2 py-1">
        <img
          src="https://flagcdn.com/{data.country.toLowerCase()}.svg"
          alt={data.country}
          class="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/10 dark:ring-white/15"
        />
        <span
          class="min-w-0 flex-1 truncate text-lg leading-tight font-semibold tracking-tight"
        >
          {data.name}
        </span>
        {#if data.municipality}
          <span
            class="max-w-28 shrink-0 truncate text-xs text-muted-foreground"
          >
            {data.municipality}
          </span>
        {/if}
      </div>

      <div
        class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5 text-[11px] text-muted-foreground tabular-nums"
      >
        <div class="h-px bg-border/60"></div>
        <div class="flex items-center gap-1.5 whitespace-nowrap">
          <span>
            <NumberFlow value={data.departures} />
            {pluralize(data.departures, 'departure')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <NumberFlow value={data.arrivals} />
            {pluralize(data.arrivals, 'arrival')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <NumberFlow value={data.operators.length} />
            {pluralize(data.operators.length, 'operator')}
          </span>
        </div>
        <div class="h-px bg-border/60"></div>
      </div>
    </div>
  </div>

  <PopupJourneyList journeys={data.journeys} />

  {#if clickable}
    <div class="border-t border-border/50 px-4 py-2">
      <p class="text-center text-xs text-muted-foreground">
        Click for station details
      </p>
    </div>
  {/if}
</div>
