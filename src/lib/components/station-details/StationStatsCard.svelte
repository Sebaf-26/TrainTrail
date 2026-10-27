<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { ArrowLeftToLine, ArrowRightFromLine } from '@o7/icon/lucide';

  import { cn, type JourneyData } from '$lib/utils';
  import { getStationVisitSummary } from '$lib/utils/data/station-visits';

  let {
    journeys,
    stationId,
    operatorCount,
    now,
  }: {
    journeys: JourneyData[];
    stationId: number;
    operatorCount: number;
    now: Date;
  } = $props();

  const departures = $derived(
    journeys.filter((f) => f.from?.id === stationId).length,
  );
  const arrivals = $derived(
    journeys.filter((f) => f.to?.id === stationId).length,
  );

  const distinctRoutes = $derived.by(() => {
    const set = new Set<string>();
    for (const f of journeys) {
      if (!f.from || !f.to) continue;
      const key = [f.from.id, f.to.id].sort().join('-');
      set.add(key);
    }
    return set.size;
  });

  const visits = $derived(getStationVisitSummary(journeys, stationId, now));
  const lastVisitLabel = $derived(visits.last);
  const nextVisitLabel = $derived(visits.next);
</script>

<section class="px-4 py-4">
  <h3 class="text-xs uppercase tracking-wider text-muted-foreground mb-2.5">
    Your activity
  </h3>

  <div class="grid grid-cols-2 gap-2">
    <div
      class="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
    >
      <div class="flex items-center gap-1.5 text-muted-foreground">
        <ArrowRightFromLine size={13} />
        <span class="text-xs">Departures</span>
      </div>
      <p class="text-2xl font-semibold leading-none mt-1.5 tabular-nums">
        <NumberFlow value={departures} />
      </p>
    </div>
    <div
      class="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
    >
      <div class="flex items-center gap-1.5 text-muted-foreground">
        <ArrowLeftToLine size={13} />
        <span class="text-xs">Arrivals</span>
      </div>
      <p class="text-2xl font-semibold leading-none mt-1.5 tabular-nums">
        <NumberFlow value={arrivals} />
      </p>
    </div>
  </div>

  {#if lastVisitLabel && nextVisitLabel}
    <div
      class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-xs text-muted-foreground"
    >
      <span>
        last visit <span class="text-foreground">{lastVisitLabel}</span>
      </span>
      <span class="inline-flex items-center gap-2">
        <span aria-hidden="true">·</span>
        <span>
          next visit <span class="text-foreground">{nextVisitLabel}</span>
        </span>
      </span>
    </div>
  {/if}

  <div
    class={cn(
      'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground',
      lastVisitLabel && nextVisitLabel ? 'mt-1' : 'mt-3',
    )}
  >
    <span>
      <span class="font-semibold text-foreground tabular-nums">
        {operatorCount}
      </span>
      operators
    </span>
    <span class="inline-flex items-center gap-2">
      <span aria-hidden="true">·</span>
      <span>
        <span class="font-semibold text-foreground tabular-nums">
          {distinctRoutes}
        </span>
        routes
      </span>
    </span>
    {#if Boolean(lastVisitLabel) !== Boolean(nextVisitLabel)}
      <span class="inline-flex items-center gap-2">
        <span aria-hidden="true">·</span>
        <span>
          {lastVisitLabel ? 'last' : 'next'} visit
          <span class="text-foreground">
            {lastVisitLabel ?? nextVisitLabel}
          </span>
        </span>
      </span>
    {/if}
  </div>
</section>
