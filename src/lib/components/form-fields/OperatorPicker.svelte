<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { createCombobox, melt } from '@melt-ui/svelte';
  import { ChevronsUpDown, CircleX } from '@o7/icon/lucide';
  import { writable } from 'svelte/store';
  import { fly } from 'svelte/transition';

  import { OperatorIcon } from '$lib/components/display';
  import type { Operator } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { cn, toTitleCase } from '$lib/utils';
  import { operatorSearchCache } from '$lib/utils/data/operators';

  let {
    value = $bindable(null),
    placeholder = 'Search operator by name or code',
    disabled = false,
    compact = false,
    onchange,
    onCreateNew,
  }: {
    value?: Operator | null;
    placeholder?: string;
    disabled?: boolean;
    compact?: boolean;
    onchange?: (operator: Operator | null) => void;
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
  } = createCombobox<Operator>({
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

  let operators: Operator[] = $state([]);
  let loading = $state(false);

  $effect(() => {
    if ($touchedInput && $inputValue !== '' && !loading) {
      const key = $inputValue.toLowerCase();
      const cached = operatorSearchCache.get(key);
      if (cached) {
        operators = cached;
        return;
      }
      const query = $inputValue;
      debounce(async () => {
        loading = true;
        try {
          operators = await api.autocomplete.operator.query(query);
          operatorSearchCache.set(key, operators);
        } finally {
          loading = false;
        }
      });
    } else if (!loading && ($inputValue === '' || !$open)) {
      operators = [];
    }
  });

  // Ensure results are repopulated when the input is focused/opened with a prefilled value
  $effect(() => {
    if ($open && !$touchedInput && $inputValue !== '' && !loading) {
      const key = $inputValue.toLowerCase();
      const cached = operatorSearchCache.get(key);
      if (cached) {
        operators = cached;
        return;
      }
      loading = true;
      (async () => {
        try {
          operators = await api.autocomplete.operator.query($inputValue);
          operatorSearchCache.set(key, operators);
        } finally {
          loading = false;
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
      class="pr-10 border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
    />
    {#if $open && $selected}
      <button
        transition:fly={{ duration: 200, x: 20 }}
        type="button"
        onclick={() => {
          // @ts-expect-error - This is totally fine
          $selected = undefined;
          value = null;
          $inputValue = '';
          onchange?.(null);
        }}
        class="cursor-pointer absolute right-10 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        <CircleX size={16} />
      </button>
    {/if}
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
        {#each operators as operator (operator.id)}
          <li
            use:melt={$option({
              value: operator,
              label: operator.name,
            })}
            class={cn(
              'relative cursor-pointer scroll-my-2 rounded-md p-2 dark:bg-dark-1 border data-highlighted:bg-zinc-300 dark:data-highlighted:bg-dark-2',
            )}
          >
            <div class="flex items-center gap-2 overflow-hidden">
              <OperatorIcon {operator} size={compact ? 20 : 36} />
              <div class="flex flex-col overflow-hidden">
                <span class={cn('truncate', { 'text-sm font-medium': compact })}
                  >{toTitleCase(operator.name)}</span
                >
                <p
                  class={cn('text-sm text-muted-foreground', {
                    'text-xs': compact,
                  })}
                >
                  {#if operator.code}
                    <span>Code</span>
                    <b>{operator.code}</b>
                  {:else}
                    No code
                  {/if}
                </p>
              </div>
            </div>
          </li>
        {:else}
          {#if loading || !$inputValue}
            <li
              class="relative cursor-default scroll-my-2 rounded-md p-2 bg-popover dark:bg-dark-1 border text-sm text-muted-foreground"
            >
              {#if loading}
                {compact ? 'Searching...' : 'Searching operators...'}
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
              <span class="text-xs opacity-75">Create a new operator?</span>
            </button>
          {:else}
            <li
              class="relative cursor-default scroll-my-2 rounded-md p-2 bg-popover dark:bg-dark-1 border text-sm text-muted-foreground"
            >
              No {compact ? 'results' : 'operators found'}
            </li>
          {/if}
        {/each}
      </div>
    </ul>
  {/if}
</div>
