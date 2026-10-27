<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { createCombobox, melt } from '@melt-ui/svelte';
  import { ChevronsUpDown } from '@o7/icon/lucide';
  import { writable } from 'svelte/store';
  import { fly } from 'svelte/transition';

  import type { Station } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { cn, toTitleCase } from '$lib/utils';
  import { stationSearchCache } from '$lib/utils/data/stations/cache';

  let {
    value = $bindable(null),
    placeholder = 'Search station by name or code',
    disabled = false,
    compact = false,
    invalid = false,
    onchange,
    onCreateNew,
  }: {
    value?: Station | null;
    placeholder?: string;
    disabled?: boolean;
    compact?: boolean;
    invalid?: boolean;
    onchange?: (station: Station | null) => void;
    onCreateNew?: () => void;
  } = $props();

  const selected = writable(
    value
      ? {
          label: value.name,
          value,
        }
      : undefined,
  );

  $effect(() => {
    if (value && $selected?.value?.id !== value.id) {
      selected.set({ label: value.name, value });
    }
  });

  const {
    elements: { menu, input, option },
    states: { open, inputValue, touchedInput },
  } = createCombobox<Station>({
    forceVisible: true,
    selected,
    onSelectedChange: ({ next }) => {
      const v = next?.value ?? null;
      value = v;
      onchange?.(v);
      return next;
    },
  });

  $effect(() => {
    if (!$open) {
      $inputValue = $selected?.label ?? '';
    }
  });

  let debounceTimer: ReturnType<typeof setTimeout>;
  const debounce = (callback: () => void) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(callback, 450);
  };

  let stations: Station[] = $state([]);
  let loading = $state(false);
  let requestId = 0;

  const fetchStations = async (query: string, currentRequestId: number) => {
    const key = query.toLowerCase();
    const results = await api.autocomplete.station.query(query);
    stationSearchCache.set(key, results);
    if (currentRequestId === requestId && $inputValue === query) {
      stations = results;
      loading = false;
    }
  };

  $effect(() => {
    if ($touchedInput && $inputValue !== '') {
      const query = $inputValue;
      const key = query.toLowerCase();
      const cached = stationSearchCache.get(key);
      if (cached) {
        stations = cached;
        loading = false;
        return;
      }
      requestId += 1;
      const currentRequestId = requestId;
      loading = true;
      debounce(async () => {
        await fetchStations(query, currentRequestId);
      });
    } else if ($inputValue === '' || !$open) {
      stations = [];
      loading = false;
    }
  });

  // Ensure results are repopulated when the input is focused/opened with a prefilled value
  $effect(() => {
    if ($open && !$touchedInput && $inputValue !== '') {
      const query = $inputValue;
      const key = query.toLowerCase();
      const cached = stationSearchCache.get(key);
      if (cached) {
        stations = cached;
        loading = false;
        return;
      }
      requestId += 1;
      const currentRequestId = requestId;
      loading = true;
      (async () => {
        try {
          await fetchStations(query, currentRequestId);
        } finally {
          if (currentRequestId === requestId) {
            loading = false;
          }
        }
      })();
    }
  });
</script>

<div class={cn('w-full', { 'opacity-50 pointer-events-none': disabled })}>
  <div class="relative">
    <input
      use:melt={$input}
      {placeholder}
      aria-invalid={invalid ? 'true' : undefined}
      class="pr-10 border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
    />
    <div
      class="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
    >
      <ChevronsUpDown size={16} class="opacity-50" />
    </div>
  </div>

  {#if $open}
    <ul
      class="pointer-events-auto z-5000 flex max-h-[300px] flex-col overflow-hidden rounded-lg mt-1"
      use:melt={$menu}
      transition:fly={{ duration: 150, y: -5 }}
    >
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class={cn(
          'flex max-h-full flex-col gap-1 overflow-y-auto bg-popover text-card-foreground',
          {
            'p-1': compact,
          },
        )}
        tabindex="0"
        use:autoAnimate
      >
        {#each stations as station (station.id)}
          <li
            use:melt={$option({
              value: station,
              label: station.name,
              disabled: loading,
            })}
            class={cn(
              'relative cursor-pointer scroll-my-2 rounded-md p-2 dark:bg-dark-1 border data-highlighted:bg-zinc-300 dark:data-highlighted:bg-dark-2',
              'transition-[filter]',
              {
                'pointer-events-none blur-xs': loading,
              },
            )}
          >
            <div class="flex flex-row gap-2 justify-between">
              <div class="flex flex-col overflow-hidden">
                <span class={cn('truncate', { 'text-sm font-medium': compact })}
                  >{toTitleCase(station.name)}</span
                >
                <p
                  class={cn('truncate text-sm text-muted-foreground', {
                    'text-xs': compact,
                  })}
                >
                  {station.municipality ?? station.country}
                </p>
              </div>
              <div
                class={cn('shrink-0', { 'w-12': !compact, 'w-10': compact })}
              >
                <img
                  src="https://flagcdn.com/{station.country.toLowerCase()}.svg"
                  alt={station.country}
                  class={cn('aspect-video h-full', { 'rounded-sm': compact })}
                />
              </div>
            </div>
          </li>
        {:else}
          {#if loading || !$inputValue}
            <li
              class="relative cursor-default scroll-my-2 rounded-md p-2 bg-popover dark:bg-dark-1 border text-sm text-muted-foreground"
            >
              {#if loading}
                {compact ? 'Searching...' : 'Searching stations...'}
              {:else}
                {compact ? 'Type to search' : 'Start typing to search...'}
              {/if}
            </li>
          {:else if onCreateNew}
            <button
              onclick={() => {
                open.set(false);
                onCreateNew?.();
              }}
              class="flex flex-col relative cursor-pointer scroll-my-2 rounded-md p-2 bg-popover dark:bg-dark-1 border text-left hover:bg-accent transition-colors"
            >
              <span class="text-sm">No results found</span>
              <span class="text-xs opacity-75">Create a new station?</span>
            </button>
          {:else}
            <li
              class="relative cursor-default scroll-my-2 rounded-md p-2 bg-popover dark:bg-dark-1 border text-sm text-muted-foreground"
            >
              No {compact ? 'results' : 'stations found'}
            </li>
          {/if}
        {/each}
      </div>
    </ul>
  {/if}
</div>
