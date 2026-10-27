<script lang="ts">
  import { Calendar, Clock, TrainFront } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import { cn } from '$lib/utils';
  import {
    formatDate,
    formatTime,
    getPreferences,
    getWeekStartsOn,
    resolveJourneyTimeZone,
  } from '$lib/utils/preferences';

  const prefs = $derived(getPreferences(page.data.user));

  // Stable sample values so the preview is deterministic.
  const SAMPLE_NOW = new Date('2026-04-26T14:30:00Z');
  const SAMPLE_DEPARTURE = new Date('2026-04-26T08:31:00Z');
  const SAMPLE_ARRIVAL = new Date('2026-04-26T10:47:00Z');
  const SAMPLE_JOURNEY = {
    from: { tz: 'Europe/London', name: 'St Pancras' },
    to: { tz: 'Europe/Paris', name: 'Gare du Nord' },
  };

  // Day initials in the user's preferred week order.
  const dayNarrowFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'narrow',
  });
  const orderedWeek = $derived.by(() => {
    const start = getWeekStartsOn(prefs); // 0=Sun, 1=Mon
    // Reference Sunday: 2026-04-26 is a Sunday.
    const sundayIdx = new Date('2026-04-26T12:00:00Z').getUTCDay();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date('2026-04-26T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + ((i + start - sundayIdx + 7) % 7));
      return {
        initial: dayNarrowFormatter.format(d),
        isStart: i === 0,
      };
    });
  });

  const todayLabel = $derived(formatDate(SAMPLE_NOW, prefs));
  const nowLabel = $derived(formatTime(SAMPLE_NOW, prefs));

  const departureTz = $derived(
    resolveJourneyTimeZone(SAMPLE_JOURNEY, 'departure', prefs),
  );
  const arrivalTz = $derived(
    resolveJourneyTimeZone(SAMPLE_JOURNEY, 'arrival', prefs),
  );
  const departureLabel = $derived(
    formatTime(SAMPLE_DEPARTURE, prefs, departureTz),
  );
  const arrivalLabel = $derived(formatTime(SAMPLE_ARRIVAL, prefs, arrivalTz));
</script>

<div
  class="rounded-lg border border-dashed border-border/70 bg-muted/30 p-3 space-y-3"
>
  <div
    class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-none"
  >
    Preview
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex items-center gap-2.5">
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground"
      >
        <Calendar size={14} />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
          Today
        </div>
        <div class="text-sm font-semibold tabular-nums truncate">
          {todayLabel}
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2.5">
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground"
      >
        <Clock size={14} />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
          Now
        </div>
        <div class="text-sm font-semibold tabular-nums truncate">
          {nowLabel}
        </div>
      </div>
    </div>
  </div>

  <div>
    <div
      class="text-[10px] uppercase tracking-wider text-muted-foreground mb-1"
    >
      Week
    </div>
    <div class="flex gap-1">
      {#each orderedWeek as day}
        <div
          class={cn(
            'flex h-6 flex-1 items-center justify-center rounded text-[11px] font-medium',
            day.isStart
              ? 'bg-primary/15 text-primary'
              : 'bg-background text-muted-foreground',
          )}
        >
          {day.initial}
        </div>
      {/each}
    </div>
  </div>

  <div>
    <div
      class="text-[10px] uppercase tracking-wider text-muted-foreground mb-1"
    >
      Sample journey
    </div>
    <div class="flex items-center gap-2 rounded-md bg-background px-2.5 py-2">
      <TrainFront size={14} class="shrink-0 text-muted-foreground" />
      <span class="text-xs font-semibold tabular-nums">
        {SAMPLE_JOURNEY.from.name}
      </span>
      <span class="text-xs tabular-nums text-muted-foreground">
        {departureLabel}
      </span>
      <span class="text-muted-foreground/60">→</span>
      <span class="text-xs font-semibold tabular-nums">
        {SAMPLE_JOURNEY.to.name}
      </span>
      <span class="text-xs tabular-nums text-muted-foreground">
        {arrivalLabel}
      </span>
    </div>
  </div>
</div>
