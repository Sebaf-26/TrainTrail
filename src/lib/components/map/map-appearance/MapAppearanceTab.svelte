<script lang="ts">
  import { mode } from 'mode-watcher';
  import { base } from '$app/paths';

  import AppearanceTile from '../AppearanceTile.svelte';
  import {
    BASEMAP_OPTIONS,
    PROJECTION_OPTIONS,
  } from '../map-appearance-options';

  import { mapPreferences } from '$lib/map/map-preferences.svelte';

  const basemapPreviewTheme = $derived(
    mode.current === 'dark' ? 'dark' : 'light',
  );
</script>

<div class="divide-y divide-border/60">
  <section class="space-y-3 px-4 py-4">
    <h3
      class="text-muted-foreground text-[10px] font-medium uppercase tracking-wider"
    >
      Basemap
    </h3>
    <div class="grid grid-cols-2 gap-2">
      {#each BASEMAP_OPTIONS as option (option.value)}
        <AppearanceTile
          selected={mapPreferences.basemap === option.value}
          onclick={() => (mapPreferences.basemap = option.value)}
          label={option.label}
          labelOutside
        >
          {#snippet illustration()}
            <img
              src={option.value === 'satellite'
                ? `${base}/basemap-previews/satellite.jpg`
                : `${base}/basemap-previews/default-${basemapPreviewTheme}.png`}
              alt=""
              draggable="false"
              class="size-full object-cover"
            />
          {/snippet}
        </AppearanceTile>
      {/each}
    </div>
  </section>

  <section class="space-y-3 px-4 py-4">
    <h3
      class="text-muted-foreground text-[10px] font-medium uppercase tracking-wider"
    >
      Projection
    </h3>
    <div class="grid grid-cols-2 gap-2">
      {#each PROJECTION_OPTIONS as option (option.value)}
        <AppearanceTile
          selected={mapPreferences.projection === option.value}
          onclick={() => (mapPreferences.projection = option.value)}
          label={option.label}
        >
          {#snippet illustration()}
            <svg viewBox="0 0 72 32" class="h-full w-full" aria-hidden="true">
              {#if option.value === 'mercator'}
                <g
                  fill="none"
                  stroke="currentColor"
                  stroke-width="0.75"
                  stroke-opacity="0.4"
                  class="text-muted-foreground"
                >
                  <path d="M14 4 V28 M25 4 V28 M36 4 V28 M47 4 V28 M58 4 V28" />
                  <path d="M6 10.5 H66 M6 21.5 H66" />
                </g>
                <path
                  d="M14 22 Q36 7 58 12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  class="text-primary"
                />
              {:else}
                <g fill="none" stroke="currentColor">
                  <circle
                    cx="36"
                    cy="16"
                    r="13"
                    stroke-width="1"
                    stroke-opacity="0.6"
                    class="text-muted-foreground"
                  />
                  <ellipse
                    cx="36"
                    cy="16"
                    rx="6"
                    ry="13"
                    stroke-width="0.75"
                    stroke-opacity="0.4"
                    class="text-muted-foreground"
                  />
                  <path
                    d="M23 16 H49 M25 10 Q36 8 47 10 M25 22 Q36 24 47 22"
                    stroke-width="0.75"
                    stroke-opacity="0.4"
                    class="text-muted-foreground"
                  />
                  <path
                    d="M28 22.5 Q33 8 45.5 10"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    class="text-primary"
                  />
                </g>
              {/if}
            </svg>
          {/snippet}
        </AppearanceTile>
      {/each}
    </div>
  </section>
</div>
