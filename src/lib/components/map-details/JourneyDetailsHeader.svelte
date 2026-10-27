<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import {
    OperatorIcon,
    RouteArrow,
    TimeDisplay,
  } from '$lib/components/display';
  import { formatTrainNumberLabel } from '$lib/utils/journey-labels';
  import type { JourneyData } from '$lib/utils';
  import { formatJourneyDate, getPreferences } from '$lib/utils/preferences';

  let {
    journey,
    onShowRoute,
  }: {
    journey: JourneyData;
    onShowRoute?: () => void;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  const trainNumber = $derived(formatTrainNumberLabel(journey.trainNumber));

  const dateLabel = $derived(
    journey.date
      ? formatJourneyDate(journey.date, journey.datePrecision ?? 'day', prefs)
      : null,
  );

  const canShowRoute = $derived(
    !!(journey.from && journey.to) && !!onShowRoute,
  );
</script>

<div class="flex flex-col gap-3 px-4 py-4">
  <div class="flex items-center gap-3">
    <OperatorIcon operator={journey.operator} size={36} fallback="train" />
    <div class="min-w-0">
      <p class="truncate text-lg leading-tight font-semibold tracking-tight">
        {trainNumber ?? journey.operator?.name ?? 'Journey'}
      </p>
      <p class="truncate text-xs text-muted-foreground">
        {#if trainNumber && journey.operator?.name}
          {journey.operator.name}{dateLabel ? ` · ${dateLabel}` : ''}
        {:else}
          {dateLabel ?? ''}
        {/if}
      </p>
    </div>
  </div>

  {#snippet endpoint(
    station: JourneyData['from'],
    time: JourneyData['departure'],
    align: 'left' | 'right',
  )}
    <div
      class="flex flex-col gap-1 {align === 'right'
        ? 'items-end text-right'
        : 'items-start text-left'}"
    >
      {#if station}
        <div
          class="flex items-center gap-1.5 {align === 'right'
            ? 'flex-row-reverse'
            : ''}"
        >
          <img
            src="https://flagcdn.com/{station.country.toLowerCase()}.svg"
            alt={station.country}
            class="h-4 w-6 shrink-0 rounded object-cover shadow-sm"
          />
          <span
            class="min-w-0 text-lg leading-tight font-semibold tracking-tight"
          >
            {station.name}
          </span>
        </div>
        {#if time}
          <TimeDisplay
            date={time}
            stationTz={station.tz}
            stationLabel={station.name}
            side="bottom"
            class="text-xs text-muted-foreground tabular-nums"
          />
        {/if}
      {:else}
        <span class="text-2xl font-semibold text-muted-foreground">N/A</span>
      {/if}
    </div>
  {/snippet}

  <button
    type="button"
    class="group grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors enabled:hover:bg-background/55 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    disabled={!canShowRoute}
    onclick={() => onShowRoute?.()}
    aria-label="Open route details"
  >
    {@render endpoint(journey.from, journey.departure, 'left')}
    <div class="flex flex-col items-center gap-0.5 text-muted-foreground/70">
      <RouteArrow class="size-5 fill-muted-foreground/70" />
    </div>
    {@render endpoint(journey.to, journey.arrival, 'right')}
  </button>
</div>
