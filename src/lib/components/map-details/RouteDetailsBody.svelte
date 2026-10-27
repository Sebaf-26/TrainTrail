<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { List } from '@o7/icon/lucide';

  import { OperatorIcon, RouteArrow } from '$lib/components/display';
  import { formatTrainNumberLabel } from '$lib/utils/journey-labels';
  import { Button } from '$lib/components/ui/button';
  import { mapDetailsState } from '$lib/state.svelte';
  import { type JourneyData } from '$lib/utils';
  import { distanceUnitLabel, formatJourneyDate } from '$lib/utils/preferences';
  import type { Preferences } from '$lib/zod/user';

  let {
    routeJourneys,
    operatorCount,
    distance,
    lastTravelledLabel,
    prefs,
    onShowAll,
    onShowJourney,
  }: {
    routeJourneys: JourneyData[];
    operatorCount: number;
    distance: number | null;
    lastTravelledLabel: string | null;
    prefs: Preferences;
    onShowAll: () => void;
    onShowJourney: (journeyId: number) => void;
  } = $props();

  const journeySubtitle = (journey: JourneyData) => {
    if (journey.operator?.name) return journey.operator.name;
    if (journey.train?.name && journey.unitNumber) {
      return `${journey.train.name} · ${journey.unitNumber}`;
    }
    return journey.train?.name ?? journey.unitNumber ?? null;
  };

  // A programmatic pane swap (row click) can skip pointerleave, so clear the
  // shared hover token when the body unmounts to avoid a stuck map highlight.
  $effect(() => () => {
    mapDetailsState.hoveredJourneyTrackId = null;
  });
</script>

{#snippet journeyRow(journey: JourneyData)}
  {@const dateLabel = journey.date
    ? formatJourneyDate(journey.date, journey.datePrecision ?? 'day', prefs)
    : 'Unknown date'}
  {@const trainNumber = formatTrainNumberLabel(journey.trainNumber)}
  {@const subtitle = journeySubtitle(journey)}
  <li>
    <button
      type="button"
      class="group grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-background/55 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      onpointerenter={() =>
        (mapDetailsState.hoveredJourneyTrackId = journey.id)}
      onpointerleave={() => (mapDetailsState.hoveredJourneyTrackId = null)}
      onclick={() => onShowJourney(journey.id)}
      aria-label="Open journey details for {journey.from?.name ??
        'N/A'} to {journey.to?.name ?? 'N/A'}"
    >
      <div class="flex w-8 shrink-0 justify-center">
        <OperatorIcon operator={journey.operator} size={28} fallback="train" />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <span
            class="min-w-0 truncate text-sm leading-5 font-semibold tracking-tight"
          >
            {journey.from?.name ?? 'N/A'}
          </span>
          <RouteArrow class="size-4 shrink-0 fill-muted-foreground/70" />
          <span
            class="min-w-0 truncate text-sm leading-5 font-semibold tracking-tight"
          >
            {journey.to?.name ?? 'N/A'}
          </span>
          {#if trainNumber}
            <span
              class="min-w-0 truncate text-xs font-medium text-muted-foreground tabular-nums"
            >
              {trainNumber}
            </span>
          {/if}
          <span
            class="size-2 shrink-0 rounded-full bg-emerald-500 transition-opacity"
            class:opacity-100={mapDetailsState.hoveredJourneyTrackId ===
              journey.id}
            class:opacity-0={mapDetailsState.hoveredJourneyTrackId !==
              journey.id}
            aria-hidden="true"
          ></span>
        </div>
        {#if subtitle}
          <p class="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        {/if}
      </div>

      <div
        class="shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums"
      >
        {dateLabel}
      </div>
    </button>
  </li>
{/snippet}

<section class="px-4 py-4">
  <h3 class="mb-2.5 text-xs tracking-wider text-muted-foreground uppercase">
    Route activity
  </h3>
  <div class="grid grid-cols-2 gap-2">
    <div
      class="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
    >
      <p class="text-xs text-muted-foreground">Journeys</p>
      <p class="mt-1.5 text-2xl leading-none font-semibold tabular-nums">
        <NumberFlow value={routeJourneys.length} />
      </p>
    </div>
    <div
      class="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
    >
      <p class="text-xs text-muted-foreground">Operators</p>
      <p class="mt-1.5 text-2xl leading-none font-semibold tabular-nums">
        <NumberFlow value={operatorCount} />
      </p>
    </div>
  </div>
  <div
    class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
  >
    {#if distance !== null}
      <span>
        <span class="font-semibold text-foreground tabular-nums">
          {distance}
        </span>
        {distanceUnitLabel(prefs)}
      </span>
    {/if}
    {#if distance !== null && lastTravelledLabel}
      <span aria-hidden="true">·</span>
    {/if}
    {#if lastTravelledLabel}
      <span
        >last travelled <span class="text-foreground">{lastTravelledLabel}</span
        ></span
      >
    {/if}
  </div>
</section>

<section class="px-4 py-4">
  <div class="mb-1 flex min-h-8 items-center gap-2">
    <List size={14} class="text-muted-foreground" />
    <h3 class="text-xs tracking-wider text-muted-foreground uppercase">
      Journeys
    </h3>
    <span class="text-xs text-muted-foreground tabular-nums">
      {routeJourneys.length}
    </span>
    {#if routeJourneys.length > 0}
      <Button
        variant="ghost"
        size="sm"
        class="ml-auto h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        onclick={() => onShowAll()}
      >
        Open list
      </Button>
    {/if}
  </div>
  <ul class="flex flex-col divide-y divide-border/50">
    {#each routeJourneys as journey (journey.id)}
      {@render journeyRow(journey)}
    {/each}
  </ul>
  {#if routeJourneys.length === 0}
    <p class="py-1 text-sm text-muted-foreground">No journeys on this route.</p>
  {/if}
</section>
