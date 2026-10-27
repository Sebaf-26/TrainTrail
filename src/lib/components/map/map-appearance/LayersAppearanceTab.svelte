<script lang="ts">
  import { Switch } from '$lib/components/ui/switch';
  import { mapPreferences } from '$lib/map/map-preferences.svelte';
</script>

<div class="divide-y divide-border/60">
  <section class="space-y-3 px-4 py-4">
    <h3
      class="text-muted-foreground text-[10px] font-medium uppercase tracking-wider"
    >
      Environment
    </h3>
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-medium leading-none">Time of day</p>
        <p class="text-muted-foreground mt-1 text-[11px]">
          Live day/night shading
        </p>
      </div>
      <Switch
        size="small"
        checked={mapPreferences.timeOfDayEnabled}
        onCheckedChange={(value) => (mapPreferences.timeOfDayEnabled = value)}
      />
    </div>
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-medium leading-none">Rain radar</p>
        <p class="text-muted-foreground mt-1 text-[11px]">
          Latest RainViewer precipitation
        </p>
      </div>
      <Switch
        size="small"
        checked={mapPreferences.rainViewerEnabled}
        onCheckedChange={(value) => (mapPreferences.rainViewerEnabled = value)}
      />
    </div>
  </section>
</div>
