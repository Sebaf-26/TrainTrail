<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { createCombobox, melt } from '@melt-ui/svelte';
  import { CircleX, ChevronsUpDown } from '@o7/icon/lucide';
  import { fly } from 'svelte/transition';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';

  import * as Form from '$lib/components/ui/form';
  import type { Train } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import type { journeySchema } from '$lib/zod/journey';
  import CreateTrain from '$lib/components/modals/settings/pages/data-page/train/CreateTrain.svelte';
  import { trainSearchCache } from '$lib/utils/data/train';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof journeySchema>>;
  } = $props();
  const { form: formData } = form;

  type FormTrain = NonNullable<z.infer<typeof journeySchema>['train']>;

  const {
    elements: { menu, input, option },
    states: { open, inputValue, touchedInput, selected },
  } = createCombobox<FormTrain>({
    forceVisible: true,
    defaultSelected: $formData.train
      ? {
          label: $formData.train.name || 'Unknown Train',
          value: $formData.train,
        }
      : undefined,
    onSelectedChange: ({ next }) => {
      if (next?.value) {
        $formData.train = next.value;
      } else {
        $formData.train = null;
      }
      return next;
    },
  });

  // If the field is updated externally, update the selected value
  formData.subscribe(() => {
    if (
      $formData.train?.id === $selected?.value.id ||
      (!$formData.train && !$selected?.value)
    ) {
      return;
    }

    selected.set(
      $formData.train
        ? {
            label: $formData.train?.name || 'Unknown Train',
            value: $formData.train,
          }
        : undefined,
    );
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

  let train: Train[] = $state([]);
  let loading = $state(false);

  $effect(() => {
    if ($touchedInput && $inputValue !== '' && !loading) {
      const key = $inputValue.toLowerCase();
      const cached = trainSearchCache.get(key);
      if (cached) {
        train = cached;
        return;
      }

      loading = true;
      debounce(async () => {
        train = await api.autocomplete.train.query($inputValue);
        trainSearchCache.set(key, train);
        loading = false;
      });
    } else if (!loading && ($inputValue === '' || !$open)) {
      train = [];
    }
  });

  // Ensure results are repopulated when the input is focused/opened with a prefilled value
  $effect(() => {
    if ($open && !$touchedInput && $inputValue !== '' && !loading) {
      const key = $inputValue.toLowerCase();
      const cached = trainSearchCache.get(key);
      if (cached) {
        train = cached;
        return;
      }

      loading = true;
      (async () => {
        try {
          train = await api.autocomplete.train.query($inputValue);
          trainSearchCache.set(key, train);
        } finally {
          loading = false;
        }
      })();
    }
  });

  const isAdmin = $derived(
    hasClientPermission(page.data.authorization, 'data.trains.manage'),
  );

  let createTrain = $state(false);
</script>

<Form.Field {form} name="train" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Train</Form.Label>
      <div class="relative">
        <input
          use:melt={$input}
          class="pr-16 border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
          placeholder="Select train"
        />
        {#if $open && $selected}
          <button
            transition:fly={{ duration: 200, x: 20 }}
            type="button"
            onclick={() => {
              $selected = undefined;
              $formData.train = null;
              $inputValue = '';
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
      <input hidden bind:value={$formData.train} name={props.name} />
    {/snippet}
  </Form.Control>
  {#if $open}
    <ul
      class="pointer-events-auto z-5000 flex max-h-[300px] flex-col overflow-hidden rounded-lg"
      use:melt={$menu}
      transition:fly={{ duration: 150, y: -5 }}
    >
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        use:autoAnimate
        class="flex max-h-full flex-col gap-1 overflow-y-auto bg-popover text-card-foreground"
        tabindex="0"
      >
        {#each train as entry (entry.id)}
          <li
            use:melt={$option({
              value: entry,
              label: entry.name,
            })}
            class="relative cursor-pointer scroll-my-2 rounded-md p-2 dark:bg-dark-1 border data-highlighted:bg-zinc-300 dark:data-highlighted:bg-dark-2"
          >
            <div class="flex flex-col">
              <span class="truncate">{entry.name}</span>
              <span class="text-sm opacity-75">{entry.code || 'No code'}</span>
            </div>
          </li>
        {:else}
          {#if loading || !$inputValue}
            <li
              class="relative cursor-pointer scroll-my-2 rounded-md p-2
        bg-popover dark:bg-dark-1 border"
            >
              {#if loading}
                Loading train...
              {:else}
                Start typing to search...
              {/if}
            </li>
          {:else if isAdmin}
            <button
              onclick={() => {
                open.set(false);
                createTrain = true;
              }}
              class="flex flex-col relative cursor-pointer scroll-my-2 rounded-md p-2
          bg-popover dark:bg-dark-1 border text-left"
            >
              <span>No results found</span>
              <span class="text-sm opacity-75">Create a new train?</span>
            </button>
          {:else}
            <li
              class="relative cursor-pointer scroll-my-2 rounded-md p-2
          bg-popover dark:bg-dark-1 border"
            >
              No train found
            </li>
          {/if}
        {/each}
      </div>
    </ul>
  {/if}
  <Form.FieldErrors />
</Form.Field>

{#if isAdmin}
  <CreateTrain bind:open={createTrain} withoutTrigger />
{/if}
