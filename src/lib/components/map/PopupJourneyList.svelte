<script lang="ts">
  import { page } from '$app/state';
  import { OperatorIcon, RouteArrow } from '$lib/components/display';
  import type { SimpleJourney } from '$lib/utils';
  import { formatJourneyDate, getPreferences } from '$lib/utils/preferences';

  let { journeys }: { journeys: SimpleJourney[] } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  const recentJourneys = $derived(
    [...journeys]
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
      .slice(0, 5),
  );
</script>

<div class="border-t border-border/50 px-4 pt-2.5 pb-3">
  <div class="mb-1 flex items-center gap-2">
    <h3 class="text-xs font-medium text-muted-foreground">Journeys</h3>
    <span class="text-xs text-muted-foreground tabular-nums">
      {journeys.length}
    </span>
  </div>
  <div class="divide-y divide-border/50">
    {#each recentJourneys as journey}
      <div
        class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-2"
      >
        <div class="flex w-7 shrink-0 justify-center">
          <OperatorIcon
            operator={journey.operator || null}
            size={22}
            fallback="train"
          />
        </div>
        <div class="min-w-0">
          <div class="flex min-w-0 items-center gap-1.5">
            <span
              class="min-w-0 truncate text-sm leading-4 font-semibold tracking-tight"
            >
              {journey.fromCode}
            </span>
            <RouteArrow class="size-3.5 shrink-0 fill-muted-foreground/70" />
            <span
              class="min-w-0 truncate text-sm leading-4 font-semibold tracking-tight"
            >
              {journey.toCode}
            </span>
          </div>
          {#if journey.operator}
            <p class="mt-0.5 truncate text-xs text-muted-foreground">
              {journey.operator.name}
            </p>
          {/if}
        </div>
        <div
          class="shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums"
        >
          {journey.date
            ? formatJourneyDate(
                journey.date,
                journey.datePrecision ?? 'day',
                prefs,
              )
            : 'Unknown date'}
        </div>
      </div>
    {/each}
  </div>

  {#if journeys.length > 5}
    <p class="mt-1.5 text-xs text-muted-foreground">
      +{journeys.length - 5} more
    </p>
  {/if}
</div>
