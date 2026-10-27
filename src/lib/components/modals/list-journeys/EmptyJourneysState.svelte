<script lang="ts">
  import { Plus, TrainFront } from '@o7/icon/lucide';

  import { RouteArrow } from '$lib/components/display';
  import { Button } from '$lib/components/ui/button';
  import type { Operator } from '$lib/db/types';

  type PreviewStation = {
    municipality: string | null;
    name: string;
  };
  type PreviewJourney = {
    id: number;
    from: PreviewStation | null;
    to: PreviewStation | null;
    operator: Operator | null;
  };

  let {
    journeys = [],
    hasTempFilters = false,
    onShowAllJourneys,
    onAddJourney,
  }: {
    journeys?: PreviewJourney[];
    hasTempFilters?: boolean;
    onShowAllJourneys?: () => void;
    onAddJourney?: () => void;
  } = $props();

  const previewJourneys = $derived.by(() => {
    if (journeys.length > 0) {
      return journeys.slice(0, 5);
    }

    return [
      {
        id: 1,
        from: { municipality: 'Milano', name: 'Milano Centrale' },
        to: { municipality: 'Roma', name: 'Roma Termini' },
        operator: null,
      },
      {
        id: 2,
        from: { municipality: 'Paris', name: 'Paris Gare de Lyon' },
        to: { municipality: 'Lyon', name: 'Lyon Part-Dieu' },
        operator: null,
      },
      {
        id: 3,
        from: { municipality: 'Zürich', name: 'Zürich HB' },
        to: { municipality: 'Milano', name: 'Milano Centrale' },
        operator: null,
      },
      {
        id: 4,
        from: { municipality: 'Berlin', name: 'Berlin Hbf' },
        to: { municipality: 'München', name: 'München Hbf' },
        operator: null,
      },
      {
        id: 5,
        from: { municipality: 'Roma', name: 'Roma Termini' },
        to: { municipality: 'Napoli', name: 'Napoli Centrale' },
        operator: null,
      },
    ] as PreviewJourney[];
  });

  // Duplicate for infinite scroll illusion
  const scrollCards = $derived([...previewJourneys, ...previewJourneys]);

  const isFilteredEmpty = $derived(journeys.length > 0);
  const title = $derived(
    isFilteredEmpty ? 'No journeys found' : 'No journeys yet',
  );
  const description = $derived.by(() => {
    if (!isFilteredEmpty) {
      return 'Start logging your journeys to track routes, operators, and travel patterns over time.';
    }

    if (hasTempFilters) {
      return 'No journeys match this station or route. Try showing all journeys or adjusting your filters.';
    }

    return 'Your current filters don\u2019t match any journeys. Try relaxing them to see results.';
  });

  const getName = (station: PreviewStation | null) =>
    station?.name || 'Unknown';
</script>

<div
  class="mx-4 mb-4 flex flex-col items-center justify-center gap-6 rounded-lg border border-border px-4 py-10 md:mt-4 md:mx-0 md:mb-0 md:min-h-[500px]"
>
  <!-- Scrolling cards -->
  <div
    class="h-36 w-full max-w-80 overflow-hidden px-4 [mask-image:linear-gradient(transparent,black_10%,black_90%,transparent)]"
  >
    <div class="animate-infinite-scroll-y flex flex-col">
      {#each scrollCards as journey, idx (idx)}
        <div
          class="mt-4 flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-[0_4px_12px_0_#0000000D]"
        >
          <div class="flex min-w-0 flex-1 items-center gap-1.5">
            <span class="truncate text-sm font-semibold">
              {getName(journey.from)}
            </span>
            <RouteArrow class="size-[14px] shrink-0 fill-muted-foreground" />
            <span class="truncate text-sm font-semibold">
              {getName(journey.to)}
            </span>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Text -->
  <div class="max-w-sm text-pretty text-center">
    <span class="text-base font-medium text-foreground">{title}</span>
    <p class="mt-2 text-pretty text-sm text-muted-foreground">
      {description}
    </p>
  </div>

  <!-- Actions -->
  <div class="flex items-center gap-2">
    {#if !isFilteredEmpty && onAddJourney}
      <Button class="gap-2" onclick={onAddJourney}>
        <Plus size={16} />
        Add journey
      </Button>
    {/if}
    {#if hasTempFilters && onShowAllJourneys}
      <Button variant="outline" class="gap-2" onclick={onShowAllJourneys}>
        <TrainFront size={16} />
        Show all journeys
      </Button>
    {/if}
  </div>
</div>
