<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import {
    ChevronLeft,
    ChevronRight,
    SquareDashedMousePointer,
    X,
  } from '@o7/icon/lucide';
  import { Plus } from '@o7/icon/lucide';
  import { Portal } from 'bits-ui';
  import { toast } from 'svelte-sonner';

  import { page as pageState } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';
  import type { JourneyScope } from '$lib/journey-scope';

  import AnimatedSizeContainer from '$lib/components/ui/animated-size-container.svelte';
  import {
    clearTempFilters,
    type JourneyFilters,
    type TempFilters,
  } from '$lib/components/journey-filters/types';
  import ResponsiveFilters from '$lib/components/journey-filters/ResponsiveFilters.svelte';
  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import * as Popover from '$lib/components/ui/popover';
  import { getModalContext } from '$lib/components/ui/modal/Modal.svelte';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import * as Select from '$lib/components/ui/select';
  import { journeyScopeState, setJourneyScope } from '$lib/state.svelte';
  import { api } from '$lib/trpc';
  import { invalidateJourneyData } from '$lib/trpc/invalidation';
  import type { JourneyData } from '$lib/utils';

  let {
    journeys = $bindable(),
    filters = $bindable(),
    tempFilters = $bindable(),
    page = $bindable(),
    pageCount,
    showingFrom,
    showingTo,
    numOfJourneys,
    selecting = $bindable(),
    selectedJourneys = $bindable(),
    hasTempFilters = false,
    onAddJourney,
    canSelect = true,
    modalOpen = true,
  }: {
    journeys: JourneyData[];
    filters: JourneyFilters;
    tempFilters?: TempFilters;
    page: number;
    pageCount: number;
    showingFrom: number;
    showingTo: number;
    numOfJourneys: number;
    selecting: boolean;
    selectedJourneys: number[];
    hasTempFilters?: boolean;
    onAddJourney?: () => void;
    canSelect?: boolean;
    modalOpen?: boolean;
  } = $props();

  const users = $derived(pageState.data.users);
  const selectedUserId = $derived(
    journeyScopeState.current.scope === 'user'
      ? journeyScopeState.current.userId
      : undefined,
  );
  const isAdmin = $derived(
    hasClientPermission(pageState.data.authorization, 'journey.read.any'),
  );

  const modalCtx = getModalContext();
  const toolbarStyle = $derived.by(() => {
    const z = modalCtx?.getContentZIndex();
    return z !== undefined ? `z-index: ${z + 1};` : undefined;
  });

  const updateScope = (scope: JourneyScope['scope']) => {
    const userId =
      journeyScopeState.current.scope === 'user'
        ? journeyScopeState.current.userId
        : users[0]?.id;
    if (scope === 'user') {
      if (!userId) return;
      setJourneyScope({ scope, userId });
    } else {
      setJourneyScope({ scope });
    }
    selecting = false;
    selectedJourneys = [];
    page = 1;
  };

  const scopeLabel = $derived.by(() => {
    if (journeyScopeState.current.scope === 'all') return 'Everyone';
    if (journeyScopeState.current.scope === 'user') {
      const scopedUser = users.find((u) => u.id === selectedUserId);
      return scopedUser ? scopedUser.displayName : 'One user';
    }
    return 'Mine';
  });

  // Ensure page is within bounds even after filtering
  $effect(() => {
    if (page > pageCount && pageCount !== 0) {
      page = pageCount;
    }
  });

  const deleteSelectedJourneys = async () => {
    const toastId = toast.loading('Deleting journeys');
    try {
      await api.journey.deleteMany.mutate(selectedJourneys);
      await invalidateJourneyData();
      toast.success('Journeys deleted', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete journeys', { id: toastId });
    }
    selectedJourneys = [];
    selecting = false;
  };
</script>

<!-- Top bar: filters + Select (desktop only) -->
<div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
  <div class="flex min-w-0 flex-wrap items-center gap-2">
    {#if hasTempFilters}
      <Button
        size="sm"
        variant="outline"
        class="flex-none"
        onclick={() => {
          if (tempFilters) {
            clearTempFilters(tempFilters);
          }
        }}
      >
        Show All Journeys
      </Button>
    {/if}
    <div class="min-w-0 flex-1">
      <ResponsiveFilters
        {journeys}
        bind:filters
        bind:tempFilters
        {hasTempFilters}
      />
    </div>
  </div>

  <div
    class={`flex flex-none items-center gap-2 justify-self-end ${selecting ? 'pointer-events-none opacity-0' : ''}`}
  >
    {#if isAdmin}
      <Popover.Root>
        <Popover.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="outline" size="sm">
              View: {scopeLabel}
            </Button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Content align="end" class="w-[320px] space-y-3 p-3">
          <div>
            <p class="text-sm font-medium">Journey visibility</p>
          </div>
          <RadioGroup.Root
            value={journeyScopeState.current.scope}
            onValueChange={(value) => {
              if (value === 'mine' || value === 'user' || value === 'all') {
                updateScope(value);
              }
            }}
            class={`grid gap-2 ${users.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}
          >
            <Label
              class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroup.Item value="mine" class="sr-only" />
              Mine
            </Label>
            {#if users.length > 0}
              <Label
                class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroup.Item value="user" class="sr-only" />
                User
              </Label>
            {/if}
            <Label
              class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroup.Item value="all" class="sr-only" />
              All
            </Label>
          </RadioGroup.Root>

          {#if journeyScopeState.current.scope === 'user' && users.length > 0}
            <div class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground">User</p>
              <Select.Root
                type="single"
                value={journeyScopeState.current.userId}
                onValueChange={(value) => {
                  if (value) setJourneyScope({ scope: 'user', userId: value });
                }}
              >
                <Select.Trigger>
                  {users.find((u) => u.id === selectedUserId)?.displayName ??
                    'Select a user'}
                </Select.Trigger>
                <Select.Content>
                  {#each users as user (user.id)}
                    <Select.Item value={user.id} label={user.displayName} />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          {/if}
        </Popover.Content>
      </Popover.Root>
    {/if}
    {#if canSelect}
      <Button
        onclick={() => {
          selecting = true;
          selectedJourneys = [];
        }}
        disabled={journeys.length === 0}
        class="hidden gap-2 sm:inline-flex"
        variant="outline"
        size="sm"
      >
        <SquareDashedMousePointer size={16} />
        Select
      </Button>
    {/if}
  </div>
</div>

<!-- Fixed bottom toolbar (always present when journeys exist) -->
{#if numOfJourneys > 0}
  <Portal>
    <div
      class={`pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-5 transition-opacity duration-150 ${modalOpen ? 'opacity-100' : 'opacity-0'}`}
      style={toolbarStyle}
    >
      <div class="pointer-events-auto w-full max-w-[768px]">
        <div
          class="overflow-hidden rounded-xl border bg-background [filter:drop-shadow(0_5px_8px_rgba(34,42,53,0.12))]"
        >
          <AnimatedSizeContainer
            height
            transition={{ type: 'spring', duration: 0.35, bounce: 0.08 }}
          >
            <div class="grid">
              <!-- Idle state: pagination -->
              <div
                class={`col-start-1 row-start-1 transition-[opacity,transform] duration-100 ${selecting ? 'pointer-events-none h-0 overflow-hidden opacity-0' : 'px-4 py-3.5'}`}
              >
                <!-- Row 1: "Viewing X-Y of Z journeys" + Previous/Next -->
                <div
                  class="flex items-center justify-between gap-2 text-sm leading-6 text-muted-foreground"
                >
                  <div>
                    <span class="hidden sm:inline-block">Viewing</span>
                    {' '}
                    {#if numOfJourneys > 0}
                      <span class="font-medium text-foreground tabular-nums">
                        <NumberFlow value={showingFrom} />-<NumberFlow
                          value={showingTo}
                        />
                      </span>
                      {' '}of{' '}
                    {/if}
                    <span class="font-medium text-foreground tabular-nums">
                      <NumberFlow value={numOfJourneys} />
                    </span>
                    {' '}{numOfJourneys === 1 ? 'journey' : 'journeys'}
                  </div>
                  <div class="flex items-center gap-2">
                    <Button
                      onclick={() => {
                        page = Math.max(1, page - 1);
                      }}
                      disabled={page === 1}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <Button
                      onclick={() => {
                        page = Math.min(pageCount, page + 1);
                      }}
                      disabled={page === pageCount || pageCount === 0}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
                <!-- Row 2 (mobile only): Create + Select -->
                <div class="flex items-center gap-2 pt-3 sm:hidden">
                  {#if onAddJourney}
                    <Button
                      onclick={onAddJourney}
                      class="flex-1 gap-2 text-center"
                      size="sm"
                    >
                      <Plus size={16} />
                      Add journey
                    </Button>
                  {/if}
                  {#if canSelect}
                    <Button
                      onclick={() => {
                        selecting = true;
                        selectedJourneys = [];
                      }}
                      disabled={journeys.length === 0}
                      class="gap-2 px-3.5"
                      variant="outline"
                      size="sm"
                    >
                      <SquareDashedMousePointer size={16} />
                      Select
                    </Button>
                  {/if}
                </div>
              </div>

              <!-- Select state -->
              <div
                class={`col-start-1 row-start-1 transition-[opacity,transform] duration-100 ${!selecting ? 'pointer-events-none h-0 overflow-hidden opacity-0' : 'px-4 py-3.5'}`}
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onclick={() => {
                        selecting = false;
                        selectedJourneys = [];
                      }}
                      class="rounded-md p-1.5 transition-colors duration-75 hover:bg-accent active:bg-accent"
                    >
                      <X class="size-4" />
                    </button>
                    <span
                      class="whitespace-nowrap text-sm font-medium text-muted-foreground"
                    >
                      <strong class="font-semibold text-foreground">
                        <NumberFlow value={selectedJourneys.length} />
                      </strong>
                      {' '}selected
                    </span>
                  </div>

                  <div
                    class={`flex items-center gap-1.5 transition-[transform,opacity] duration-150 ${selectedJourneys.length === 0 ? 'pointer-events-none translate-y-[50%] opacity-0' : 'translate-y-0 opacity-100'}`}
                  >
                    <Confirm
                      onConfirm={deleteSelectedJourneys}
                      title="Delete selected journeys"
                      description="Are you sure you want to delete the selected journeys? This will permanently delete the journeys as well as their passengers."
                      confirmText="Delete"
                    >
                      {#snippet triggerContent({ props })}
                        <Button
                          variant="destructiveOutline"
                          size="sm"
                          class="gap-1.5 px-2.5 text-xs"
                          {...props}
                          disabled={selectedJourneys.length === 0}
                        >
                          <X size={14} />
                          Delete
                        </Button>
                      {/snippet}
                    </Confirm>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSizeContainer>
        </div>
      </div>
    </div>
  </Portal>
{/if}
