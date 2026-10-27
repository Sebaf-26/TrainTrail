<script lang="ts">
  import type { TZDate } from '@date-fns/tz';
  import type { Snippet } from 'svelte';

  import { page } from '$app/state';
  import { OperatorIcon, RouteArrow } from '$lib/components/display';
  import { formatTrainNumberLabel } from '$lib/utils/journey-labels';
  import { Badge } from '$lib/components/ui/badge';
  import type { Operator, Station, JourneyDatePrecision } from '$lib/db/types';
  import { formatJourneyDate, getPreferences } from '$lib/utils/preferences';

  type Journey = {
    from: Station | null;
    to: Station | null;
    operator: Operator | null;
    trainNumber?: string | null;
    date?: TZDate | null;
    datePrecision?: JourneyDatePrecision;
  };

  let {
    journey,
    passengerLabels = [],
    showMeta = true,
    indicators,
  }: {
    journey: Journey;
    passengerLabels?: string[];
    showMeta?: boolean;
    indicators?: Snippet;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  const formatDate = (journey: Journey) => {
    if (!journey.date) return null;
    return formatJourneyDate(
      journey.date,
      journey.datePrecision ?? 'day',
      prefs,
    );
  };

  const getCityName = (station: Station | null) => {
    if (!station) return 'Unknown';
    return station.municipality || station.name;
  };
</script>

<div class="flex w-full text-left">
  <!-- Logo Column -->
  <div class="w-[50px] mr-4 shrink-0 flex items-center justify-center">
    <OperatorIcon operator={journey.operator} size={42} fallback="train" />
  </div>

  <!-- Content Column -->
  <div class="flex-1 flex justify-between items-start min-w-0">
    <!-- Route Info (Left Side) -->
    <div class="flex flex-col gap-1 min-w-0">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="truncate text-lg font-extrabold">
          {journey.from?.name || 'N/A'}
        </span>
        <RouteArrow class="size-[22px] shrink-0 fill-foreground" />
        <span class="truncate text-lg font-extrabold">
          {journey.to?.name || 'N/A'}
        </span>
      </div>
      <span class="text-[15px] text-muted-foreground truncate">
        {getCityName(journey.from)} to {getCityName(journey.to)}
      </span>
    </div>

    <!-- Meta Info (Right Side) -->
    {#if showMeta}
      <div class="flex flex-col items-end gap-2 text-right shrink-0 ml-3">
        {#if formatDate(journey)}
          <span class="font-semibold text-foreground/90">
            {formatDate(journey)}
          </span>
        {/if}
        {#if passengerLabels.length}
          <Badge variant="outline" class="max-w-[120px] truncate self-end">
            {passengerLabels[0]}{passengerLabels.length > 1
              ? ` +${passengerLabels.length - 1}`
              : ''}
          </Badge>
        {:else if formatTrainNumberLabel(journey.trainNumber)}
          <span class="text-[15px] text-muted-foreground">
            {formatTrainNumberLabel(journey.trainNumber)}
          </span>
        {/if}
        {@render indicators?.()}
      </div>
    {/if}
  </div>
</div>
