<script lang="ts">
  import { Ruler } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import {
    convertDistance,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';

  const prefs = $derived(getPreferences(page.data.user));

  // Recognisable, non-trivial sample value.
  const SAMPLE_KM = 477; // ~Milano Centrale to Roma Termini great-circle

  const distance = $derived({
    value: Math.round(convertDistance(SAMPLE_KM, prefs)).toLocaleString(),
    unit: distanceUnitLabel(prefs),
  });
</script>

<div class="rounded-lg border border-dashed border-border/70 bg-muted/30 p-3">
  <div
    class="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-none"
  >
    Preview
  </div>
  <div class="grid grid-cols-2 gap-3">
    <div class="flex items-center gap-2.5">
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground"
      >
        <Ruler size={14} />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
          Distance
        </div>
        <div class="flex items-baseline gap-1 truncate">
          <span class="text-sm font-semibold tabular-nums">
            {distance.value}
          </span>
          <span class="text-xs text-muted-foreground">{distance.unit}</span>
        </div>
      </div>
    </div>
  </div>
</div>
