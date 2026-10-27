<script lang="ts">
  import { ArrowLeftToLine, ArrowRightFromLine } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import { OperatorIcon } from '$lib/components/display';
  import { formatTrainNumberLabel } from '$lib/utils/journey-labels';
  import { Button } from '$lib/components/ui/button';
  import { mapDetailsState } from '$lib/state.svelte';
  import type { JourneyData } from '$lib/utils';
  import { formatJourneyDate, getPreferences } from '$lib/utils/preferences';

  let {
    journeys,
    stationId,
    onShowAllDepartures,
    onShowAllArrivals,
    onShowJourney,
  }: {
    journeys: JourneyData[];
    stationId: number;
    onShowAllDepartures?: () => void;
    onShowAllArrivals?: () => void;
    onShowJourney?: (journeyId: number) => void;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  const inlineJourneyTarget = 14;

  const byDateDesc = (a: JourneyData, b: JourneyData) => {
    const ad = a.date?.getTime() ?? 0;
    const bd = b.date?.getTime() ?? 0;
    return bd - ad;
  };

  const departures = $derived(
    journeys.filter((f) => f.from?.id === stationId).sort(byDateDesc),
  );
  const arrivals = $derived(
    journeys.filter((f) => f.to?.id === stationId).sort(byDateDesc),
  );

  const journeySubtitle = (journey: JourneyData) => {
    if (journey.operator?.name) return journey.operator.name;
    if (journey.train?.name && journey.unitNumber) {
      return `${journey.train.name} · ${journey.unitNumber}`;
    }
    return journey.train?.name ?? journey.unitNumber ?? null;
  };

  const inlineLimitFor = (direction: 'departure' | 'arrival') => {
    const current =
      direction === 'departure' ? departures.length : arrivals.length;
    const other =
      direction === 'departure' ? arrivals.length : departures.length;
    const sectionCount =
      Number(departures.length > 0) + Number(arrivals.length > 0);

    if (sectionCount <= 1) return Math.min(current, inlineJourneyTarget);

    const baseShare = Math.floor(inlineJourneyTarget / sectionCount);
    const otherShare = Math.min(other, baseShare);
    return Math.min(current, inlineJourneyTarget - otherShare);
  };
</script>

{#snippet journeyRow(journey: JourneyData, direction: 'departure' | 'arrival')}
  {@const other = direction === 'departure' ? journey.to : journey.from}
  {@const dateLabel = journey.date
    ? formatJourneyDate(journey.date, journey.datePrecision ?? 'day', prefs)
    : 'Unknown date'}
  {@const trainNumber = formatTrainNumberLabel(journey.trainNumber)}
  {@const subtitle = [other?.municipality, journeySubtitle(journey)]
    .filter(Boolean)
    .join(' · ')}
  <li>
    <button
      type="button"
      class="group grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-background/55 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      onclick={() => onShowJourney?.(journey.id)}
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
            {other?.name ?? 'N/A'}
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

{#snippet section(
  title: string,
  Icon: typeof ArrowRightFromLine,
  items: JourneyData[],
  direction: 'departure' | 'arrival',
  onShowAll?: (journeyId?: number) => void,
)}
  {@const visibleItems = items.slice(0, inlineLimitFor(direction))}
  <div>
    <div class="mb-1 flex min-h-8 items-center gap-2">
      <Icon size={14} class="text-muted-foreground" />
      <h4 class="text-xs uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {#if items.length > visibleItems.length && onShowAll}
        <Button
          variant="ghost"
          size="sm"
          class="ml-auto h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          onclick={() => onShowAll?.()}
        >
          Show all {items.length}
        </Button>
      {:else}
        <span class="ml-auto text-xs text-muted-foreground">{items.length}</span
        >
      {/if}
    </div>
    {#if items.length === 0}
      <p class="text-sm text-muted-foreground py-1">None.</p>
    {:else}
      <ul class="flex flex-col divide-y divide-border/50">
        {#each visibleItems as journey (journey.id)}
          {@render journeyRow(journey, direction)}
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

<section class="flex flex-col gap-4 px-4 py-4">
  {@render section(
    'Departures',
    ArrowRightFromLine,
    departures,
    'departure',
    onShowAllDepartures,
  )}
  {@render section(
    'Arrivals',
    ArrowLeftToLine,
    arrivals,
    'arrival',
    onShowAllArrivals,
  )}
</section>
