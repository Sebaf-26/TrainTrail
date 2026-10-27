<script lang="ts">
  import type { prepareVisitedStations } from '$lib/utils';

  type VisitedStation = ReturnType<typeof prepareVisitedStations>[number];

  let { station }: { station: VisitedStation } = $props();
</script>

<div class="flex items-start gap-3 px-4 py-4">
  <img
    src="https://flagcdn.com/{station.country.toLowerCase()}.svg"
    alt={station.country}
    class="h-8 w-11 shrink-0 rounded object-cover shadow-sm"
  />
  <div class="min-w-0 flex-1">
    <h2 class="text-xl leading-tight font-semibold tracking-tight">
      {station.name}
    </h2>
    <p class="mt-0.5 truncate text-xs text-muted-foreground">
      {station.municipality
        ? `${station.municipality}, ${station.country}`
        : station.country}
    </p>
  </div>
</div>
