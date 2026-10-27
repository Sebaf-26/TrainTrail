<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import {
    ArrowLeftRight,
    ArrowLeftToLine,
    ArrowRightFromLine,
    MapPin,
    TrainFront,
    X,
  } from '@o7/icon/lucide';
  import { isBefore, isAfter } from 'date-fns';
  import { tick } from 'svelte';

  import DeleteJourneyModal from './DeleteJourneyModal.svelte';
  import EditJourneyAction from './EditJourneyAction.svelte';
  import EmptyJourneysState from './EmptyJourneysState.svelte';
  import { buildJourneyIndicators } from './journey-indicators';
  import JourneyIndicators from './JourneyIndicators.svelte';
  import {
    buildJourneyListYears,
    paginateJourneyListYears,
    sortByDepartureDesc,
  } from './journey-list-groups';
  import { createJourneyListAccess } from './journey-list-access';
  import MobileJourneyList from './MobileJourneyList.svelte';
  import PastJourneysDivider from './PastJourneysDivider.svelte';
  import Toolbar from './Toolbar.svelte';

  import { page as appPage } from '$app/state';
  import type { Station } from '$lib/db/types';
  import { OperatorIcon, TimeDisplay } from '$lib/components/display';
  import {
    clearTempFilters as clearTempFilterValues,
    hasTempFilters as hasActiveTempFilters,
    routeMatchesEndpoints,
    type JourneyFilters,
    type TempFilters,
  } from '$lib/components/journey-filters/types';
  import { AddJourneyModal, EditJourneyModal } from '$lib/components/modals';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Modal } from '$lib/components/ui/modal';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { LabelledSeparator, Separator } from '$lib/components/ui/separator';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { NavigateJourneys } from '$lib/journey-navigation';
  import { canShowJourneyOnMap } from '$lib/journey-visibility';
  import { journeyAddedState, journeyListFocusState } from '$lib/state.svelte';
  import {
    cn,
    cancelHighlight,
    formatSeatForUser,
    getJourneyPassengerLabels,
    highlightElement,
    scrollElementIntoView,
    type JourneyData,
  } from '$lib/utils';
  import { formatTrain } from '$lib/utils/data/train';
  import { Duration, parseLocalizeISO } from '$lib/utils/datetime';
  import { formatJourneyDate, getPreferences } from '$lib/utils/preferences';
  import { isMediumScreen } from '$lib/utils/size';

  let {
    open = $bindable<boolean>(),
    filters = $bindable<JourneyFilters | undefined>(),
    tempFilters = $bindable<TempFilters | undefined>(),
    journeys,
    filteredJourneys,
    focusedJourneyOutsideFilters = false,
    deleteJourney,
    readonly = false,
    seatUserId,
    showPassengerDetails = false,
    trackedJourneyIds,
    onNavigate,
  }: {
    open?: boolean;
    filters?: JourneyFilters;
    tempFilters?: TempFilters;
    journeys: JourneyData[];
    filteredJourneys: JourneyData[];
    focusedJourneyOutsideFilters?: boolean;
    deleteJourney?: (id: number) => Promise<void>;
    readonly?: boolean;
    seatUserId?: string;
    showPassengerDetails?: boolean;
    trackedJourneyIds?: Set<number>;
    onNavigate?: NavigateJourneys;
  } = $props();

  const prefs = $derived(getPreferences(appPage.data.user));
  const access = $derived(
    createJourneyListAccess({
      authorization: appPage.data.authorization,
      userId: appPage.data.user?.id ?? null,
      readonly,
    }),
  );
  const canCreateJourney = $derived(access.canCreateJourney);
  const canUpdateJourney = (journey: JourneyData) =>
    access.canUpdateJourney(journey);
  const canDeleteJourney = (journey: JourneyData) =>
    access.canDeleteJourney(journey);
  const canBulkDelete = $derived(access.canBulkDelete(filteredJourneys));

  const formattedJourneys = $derived.by(() => {
    const data = filteredJourneys;
    if (!data) return [];

    return sortByDepartureDesc(
      data.map((f) => {
        const depDate = f.departure;
        const arrDate = f.arrival;

        // Compare actual vs scheduled times
        const depScheduled =
          f.raw.departureScheduled && f.from
            ? parseLocalizeISO(f.raw.departureScheduled, f.from.tz)
            : null;
        const arrScheduled =
          f.raw.arrivalScheduled && f.to
            ? parseLocalizeISO(f.raw.arrivalScheduled, f.to.tz)
            : null;

        let depStatus: 'early' | 'late' | null = null;
        if (depDate && depScheduled) {
          if (isBefore(depDate, depScheduled)) depStatus = 'early';
          else if (isAfter(depDate, depScheduled)) depStatus = 'late';
        }

        let arrStatus: 'early' | 'late' | null = null;
        if (arrDate && arrScheduled) {
          if (isBefore(arrDate, arrScheduled)) arrStatus = 'early';
          else if (isAfter(arrDate, arrScheduled)) arrStatus = 'late';
        }

        return {
          ...f,
          from: f.from,
          to: f.to,
          durationDisplay: f.duration
            ? Duration.fromSeconds(f.duration).toString()
            : '',
          hasDateDisplay: !!f.date,
          depAt: (depDate ?? depScheduled) as Date | null,
          depFallback:
            !(depDate ?? depScheduled) && f.date
              ? formatJourneyDate(f.date, f.datePrecision, prefs)
              : null,
          arrAt: (arrDate ?? arrScheduled) as Date | null,
          depStatus,
          arrStatus,
          seat: formatSeatForUser(f, seatUserId),
          passengerLabels: showPassengerDetails
            ? getJourneyPassengerLabels(f)
            : [],
          indicators: buildJourneyIndicators(f, {
            hasTrack: trackedJourneyIds?.has(f.id) ?? false,
            viewerId: seatUserId ?? null,
            includePassengers: !showPassengerDetails,
          }),
        };
      }),
    );
  });

  const journeysPerPage = 20;
  let page = $state(1);
  let journeyListReferenceTime = $state(new Date());

  $effect(() => {
    if (open) journeyListReferenceTime = new Date();
  });

  const journeyListPages = $derived.by(() => {
    const years = buildJourneyListYears(
      formattedJourneys,
      journeyListReferenceTime,
    );
    return paginateJourneyListYears(years, journeysPerPage);
  });
  const currentJourneyListPage = $derived(journeyListPages[page - 1]);
  const journeysByYear = $derived(currentJourneyListPage?.years ?? []);
  const showingFrom = $derived(
    currentJourneyListPage ? currentJourneyListPage.firstJourneyIndex + 1 : 0,
  );
  const showingTo = $derived(
    currentJourneyListPage
      ? currentJourneyListPage.firstJourneyIndex +
          currentJourneyListPage.journeys.length
      : 0,
  );

  let selecting = $state(false);
  let selectedJourneys = $state<number[]>([]);
  let handledFocusRequest = 0;

  // Add journey state
  let addJourneyOpen = $state(false);

  $effect(() => {
    if (journeyAddedState.added && addJourneyOpen) {
      addJourneyOpen = false;
    }
  });

  $effect(() => {
    if (!open || journeyListFocusState.request === handledFocusRequest) return;

    const journeyId = journeyListFocusState.journeyId;
    handledFocusRequest = journeyListFocusState.request;
    if (!journeyId) return;

    let cancelled = false;
    let highlightedRow: HTMLElement | null = null;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const schedule = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!cancelled) callback();
      }, delay);
      timers.add(timer);
    };

    const targetPage = journeyListPages.findIndex((candidate) =>
      candidate.journeys.some((journey) => journey.id === journeyId),
    );
    if (targetPage >= 0) page = targetPage + 1;

    // Poll until the row is mounted (on mobile the list opens in a drawer that
    // animates in, so it isn't in the DOM for the first few frames), then scroll
    // to it and highlight. Re-scroll once more after a beat because the desktop
    // grid paginates via auto-animate, so the row's position isn't final yet.
    const focusRow = (attempts = 0) => {
      const row = document.getElementById(`journey-list-row-${journeyId}`);
      if (row && row.getBoundingClientRect().height > 0) {
        highlightedRow = row;
        highlightElement(row, {
          duration: 1900,
          pulses: 3,
          scrollOffset: 0,
        }).catch(() => {});
        schedule(() => scrollElementIntoView(row), 300);
        return;
      }
      if (attempts < 25) schedule(() => focusRow(attempts + 1), 80);
    };

    tick().then(() => {
      if (!cancelled) focusRow();
    });

    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (highlightedRow) cancelHighlight(highlightedRow);
    };
  });

  // Mobile edit state
  let mobileEditJourney = $state<JourneyData | null>(null);
  let mobileEditOpen = $state(false);

  // Reference to MobileJourneyList for resetting swipeable rows
  let mobileJourneyListRef: MobileJourneyList | undefined = $state();

  const handleMobileEdit = (journey: { id: number }) => {
    const originalJourney = filteredJourneys.find((f) => f.id === journey.id);
    if (originalJourney) {
      mobileEditJourney = originalJourney;
      mobileEditOpen = true;
    }
  };

  // Delete state (used for both mobile and desktop)
  type DeleteJourney = {
    id: number;
    from: (typeof filteredJourneys)[0]['from'];
    to: (typeof filteredJourneys)[0]['to'];
    operator: (typeof filteredJourneys)[0]['operator'];
  };
  let deleteJourneyData = $state<DeleteJourney | null>(null);
  let deleteModalOpen = $state(false);

  // Track previous modal state to detect close transitions
  let prevModalOpen = $state(false);

  // Reset swipeable rows when modals close (transition from open -> closed)
  $effect(() => {
    const isOpen = mobileEditOpen || deleteModalOpen;
    if (prevModalOpen && !isOpen) {
      mobileJourneyListRef?.resetAllRows();
    }
    prevModalOpen = isOpen;
  });

  const handleDelete = (journey: { id: number }) => {
    const originalJourney = filteredJourneys.find((f) => f.id === journey.id);
    if (originalJourney) {
      deleteJourneyData = {
        id: originalJourney.id,
        from: originalJourney.from,
        to: originalJourney.to,
        operator: originalJourney.operator,
      };
      deleteModalOpen = true;
    }
  };

  const confirmDelete = async () => {
    if (deleteJourneyData !== null) {
      await deleteJourney?.(deleteJourneyData.id);
      deleteJourneyData = null;
    }
  };

  const showJourneyOnMap = (journey: JourneyData) => {
    if (!canShowJourneyOnMap(journey)) return;
    onNavigate?.({
      destination: 'map',
      focus: { type: 'journey', journeyId: journey.id },
    });
  };

  const hasTempFilters = $derived.by(() => hasActiveTempFilters(tempFilters));

  const clearTempFilters = () => {
    if (!tempFilters) return;
    clearTempFilterValues(tempFilters);
  };

  const findStationById = (stationId: string) => {
    const journey = journeys.find(
      (f) =>
        f.from?.id.toString() === stationId ||
        f.to?.id.toString() === stationId,
    );
    return journey?.from?.id.toString() === stationId
      ? journey.from
      : journey?.to;
  };

  const tempFilterStation = $derived.by(() => {
    if (tempFilters?.departureStations.length) {
      return {
        label: 'Departures',
        station: findStationById(tempFilters.departureStations[0]!),
      };
    }
    if (tempFilters?.arrivalStations.length) {
      return {
        label: 'Arrivals',
        station: findStationById(tempFilters.arrivalStations[0]!),
      };
    }
    if (tempFilters?.stationsEither.length) {
      return {
        label: 'Station',
        station: findStationById(tempFilters.stationsEither[0]!),
      };
    }
    return null;
  });

  const tempFilterRoute = $derived.by(() => {
    if (!tempFilters?.routes.length) return null;
    const route = tempFilters.routes[0]!;
    const journey = journeys.find((f) =>
      routeMatchesEndpoints(f.from?.id, f.to?.id, route),
    );
    if (!journey?.from || !journey.to) return null;
    return {
      from: journey.from,
      to: journey.to,
    };
  });
</script>

<Modal
  bind:open
  class="md:max-w-full flex flex-col md:h-full md:rounded-none!"
  drawerNoPadding
>
  <div class="max-md:max-h-[calc(100dvh-200px)] max-md:overflow-auto">
    <div class="flex flex-col gap-2 max-md:px-4 max-md:py-4">
      {#if hasTempFilters}
        <div class="flex flex-col gap-1">
          {#if tempFilterStation?.station}
            <h3 class="text-sm font-thin text-muted-foreground">
              {tempFilterStation.label}
            </h3>
            <h2
              class="flex items-center gap-2 text-2xl font-bold tracking-tight"
            >
              <img
                src="https://flagcdn.com/{tempFilterStation.station.country.toLowerCase()}.svg"
                alt={tempFilterStation.station.country}
                class="h-5 w-8"
              />
              {tempFilterStation.station.name}
              {#if tempFilterStation.station.municipality}
                <span class="text-base font-normal text-muted-foreground">
                  {tempFilterStation.station.municipality}
                </span>
              {/if}
            </h2>
          {:else if tempFilterRoute}
            <h3 class="text-sm font-thin text-muted-foreground">Route</h3>
            <h2
              class="text-2xl font-bold tracking-tight flex items-center gap-2"
            >
              <img
                src="https://flagcdn.com/{tempFilterRoute.from.country.toLowerCase()}.svg"
                alt={tempFilterRoute.from.country}
                class="w-6 h-4"
              />
              {tempFilterRoute.from.name}
              <ArrowLeftRight class="text-muted-foreground" />
              <img
                src="https://flagcdn.com/{tempFilterRoute.to.country.toLowerCase()}.svg"
                alt={tempFilterRoute.to.country}
                class="w-6 h-4"
              />
              {tempFilterRoute.to.name}
            </h2>
          {/if}
        </div>
      {:else}
        <h2 class="text-3xl font-bold tracking-tight">All Journeys</h2>
      {/if}

      {#if focusedJourneyOutsideFilters}
        <p class="text-xs text-muted-foreground">
          Selected journey is shown outside the active filters.
        </p>
      {/if}

      {#if filters}
        <Toolbar
          bind:filters
          bind:tempFilters
          bind:journeys
          bind:selecting
          bind:selectedJourneys
          bind:page
          pageCount={journeyListPages.length}
          {showingFrom}
          {showingTo}
          {hasTempFilters}
          numOfJourneys={filteredJourneys.length}
          canSelect={canBulkDelete}
          modalOpen={open &&
            !addJourneyOpen &&
            !mobileEditOpen &&
            !deleteModalOpen}
          onAddJourney={!canCreateJourney
            ? undefined
            : () => {
                addJourneyOpen = true;
              }}
        />
      {/if}
    </div>
    {#if journeysByYear.length === 0}
      <EmptyJourneysState
        {journeys}
        {hasTempFilters}
        onShowAllJourneys={hasTempFilters ? clearTempFilters : undefined}
        onAddJourney={!canCreateJourney
          ? undefined
          : () => {
              addJourneyOpen = true;
            }}
      />
    {:else if !$isMediumScreen}
      <MobileJourneyList
        bind:this={mobileJourneyListRef}
        {journeysByYear}
        selecting={canBulkDelete ? selecting : false}
        bind:selectedJourneys
        onEdit={handleMobileEdit}
        onDelete={handleDelete}
        {canUpdateJourney}
        {canDeleteJourney}
        onShowOnMap={readonly || !onNavigate ? undefined : showJourneyOnMap}
        {readonly}
      />
      <div class="h-[130px] sm:h-[90px]"></div>
    {:else}
      <ScrollArea type="hover">
        <div
          class={cn(
            'hidden gap-y-2 md:grid md:grid-cols-[max-content_32px_minmax(16rem,1fr)_12px_auto] lg:grid-cols-[max-content_12px_minmax(0,12rem)_12px_minmax(16rem,1fr)_12px_auto] xl:grid-cols-[max-content_12px_minmax(0,12rem)_12px_minmax(0,12rem)_12px_minmax(18rem,1fr)_12px_auto]',
            {
              'gap-y-4': showPassengerDetails,
            },
          )}
          use:autoAnimate
        >
          {#each journeysByYear as { year, groups } (year)}
            {#if groups[0]?.startsPastSection}
              <PastJourneysDivider class="col-span-full" />
            {/if}
            {#if year !== 0}
              <LabelledSeparator class="col-span-full mt-4">
                <h3
                  class="border px-4 py-1 rounded-full border-dashed text-sm font-medium leading-7"
                >
                  {year}
                </h3>
              </LabelledSeparator>
            {/if}
            {#each groups as group, groupIndex (group.key)}
              {#if group.startsPastSection && groupIndex > 0}
                <PastJourneysDivider class="col-span-full" />
              {/if}
              <!-- Legs connected by a change of train share one block: the grid gap and
                   the borders between them are dropped. -->
              <div class="col-span-full grid grid-cols-subgrid gap-y-0">
                {#each group.journeys as journey, legIndex (journey.id)}
                  {@const continuesAbove = legIndex > 0}
                  {@const continuesBelow = legIndex < group.journeys.length - 1}
                  {@const outlined = canBulkDelete && selecting}
                  <div
                    id="journey-list-row-{journey.id}"
                    class="relative col-span-full grid grid-cols-subgrid scroll-mt-24 rounded-lg"
                  >
                    {#if showPassengerDetails && journey.passengerLabels.length}
                      {@render passengerBadge(journey.passengerLabels)}
                    {/if}
                    <Card
                      onclick={() => {
                        if (canBulkDelete && selecting) {
                          if (selectedJourneys.includes(journey.id)) {
                            selectedJourneys = selectedJourneys.filter(
                              (id) => id !== journey.id,
                            );
                          } else {
                            selectedJourneys = [
                              ...selectedJourneys,
                              journey.id,
                            ];
                          }
                        }
                      }}
                      level="2"
                      class={cn(
                        'col-span-full grid grid-cols-subgrid items-center p-3',
                        {
                          'rounded-t-none': continuesAbove,
                          'rounded-b-none': continuesBelow,
                          // Legs of one trip drop the borders that would sit
                          // between them, and the block keeps a single drop
                          // shadow cast by its bottom-most leg. While selecting,
                          // every card keeps its own outline instead.
                          'border-t-0': continuesAbove && !outlined,
                          'border-b-0 shadow-none': continuesBelow && !outlined,
                          'cursor-pointer border-zinc-600 border-dotted border-2':
                            outlined,
                          'border-destructive border-solid':
                            outlined && selectedJourneys.includes(journey.id),
                        },
                      )}
                    >
                      {#if journey.hasDateDisplay}
                        <div class="flex min-w-max items-center">
                          <div class="flex w-11 shrink-0 justify-center">
                            <OperatorIcon
                              operator={journey.operator}
                              size={36}
                              fallback="train"
                            />
                          </div>
                          <Separator orientation="vertical" class="mx-3 h-10" />
                          <div
                            class="flex min-w-max shrink-0 flex-col whitespace-nowrap"
                          >
                            {@render journeyTimes(journey)}
                          </div>
                        </div>
                      {:else}
                        <div aria-hidden="true"></div>
                      {/if}
                      <div aria-hidden="true"></div>
                      <div class="hidden min-w-0 flex-col lg:flex">
                        {@render seatAndOperator(journey)}
                      </div>
                      <div class="hidden lg:block" aria-hidden="true"></div>
                      <div class="hidden min-w-0 flex-col xl:flex">
                        {@render journeyAndUnitNumber(journey)}
                      </div>
                      <div class="hidden xl:block" aria-hidden="true"></div>
                      <div class="flex min-w-0 px-8 xl:px-12">
                        <div
                          class="w-full grid grid-cols-[auto_1fr_auto] gap-3"
                        >
                          {@render station(journey.from)}
                          <div class="h-full flex flex-col justify-center">
                            <div class="relative">
                              <div
                                class="relative w-full h-px border-b border-dashed border-dark-2 dark:border-zinc-500"
                              >
                                <div
                                  class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-1 bg-card dark:bg-dark-2 text-dark-2 dark:text-zinc-500"
                                >
                                  <div class="flex flex-col items-center">
                                    <TrainFront size="20" />
                                    <span class="text-xs"
                                      >{journey.durationDisplay}</span
                                    >
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {@render station(journey.to)}
                        </div>
                      </div>
                      <div aria-hidden="true"></div>
                      <div
                        class="hidden items-center justify-end gap-3 md:flex"
                      >
                        <JourneyIndicators indicators={journey.indicators} />
                        {#if !readonly}
                          {@render actions(journey)}
                        {/if}
                      </div>
                    </Card>
                  </div>
                {/each}
              </div>
            {/each}
          {/each}
        </div>
        <div class="h-[90px]"></div>
      </ScrollArea>
    {/if}
  </div>

  <!-- Add Journey Modal -->
  <AddJourneyModal bind:open={addJourneyOpen} />

  <!-- Mobile Edit Modal -->
  {#if mobileEditJourney}
    {#key mobileEditJourney.id}
      <EditJourneyModal
        journey={mobileEditJourney}
        bind:open={mobileEditOpen}
        showTrigger={false}
      />
    {/key}
  {/if}

  <!-- Delete Confirmation -->
  <DeleteJourneyModal
    bind:open={deleteModalOpen}
    journey={deleteJourneyData}
    onConfirm={confirmDelete}
  />
</Modal>

{#snippet journeyTimes(journey: (typeof formattedJourneys)[number])}
  <div class="flex items-center" data-testid="journey-time-departure">
    <ArrowRightFromLine size="16" class="mr-1" />
    {#if journey.depAt}
      <TimeDisplay
        date={journey.depAt}
        dateStyle="compact"
        stationTz={journey.from?.tz}
        stationLabel={journey.from?.name}
        side="right"
        class={cn('text-sm', {
          'text-green-600 dark:text-green-400': journey.depStatus === 'early',
          'text-red-600 dark:text-red-400': journey.depStatus === 'late',
        })}
      />
    {:else if journey.depFallback}
      <p class="text-sm">{journey.depFallback}</p>
    {/if}
  </div>
  <div class="flex items-center" data-testid="journey-time-arrival">
    {#if journey.arrAt}
      <ArrowLeftToLine size="16" class="mr-1" />
      <TimeDisplay
        date={journey.arrAt}
        dateStyle="compact"
        stationTz={journey.to?.tz}
        stationLabel={journey.to?.name}
        side="right"
        class={cn('text-sm overflow-hidden text-ellipsis whitespace-nowrap', {
          'text-green-600 dark:text-green-400': journey.arrStatus === 'early',
          'text-red-600 dark:text-red-400': journey.arrStatus === 'late',
        })}
      />
    {/if}
    <p class="text-sm text-transparent">.</p>
  </div>
{/snippet}

{#snippet seatAndOperator(journey: (typeof formattedJourneys)[number])}
  {#if journey.seat || journey.operator}
    <Tooltip.AutoTooltip
      text={journey.seat ?? journey.operator?.name ?? ''}
      class="text-sm truncate"
    />
  {:else}
    <p class="text-sm text-transparent">.</p>
  {/if}
  {#if journey.operator && journey.seat}
    <Tooltip.AutoTooltip
      text={journey.operator.name}
      class="text-sm text-muted-foreground truncate"
    />
  {:else}
    <p class="text-sm text-transparent">.</p>
  {/if}
{/snippet}

{#snippet journeyAndUnitNumber(journey: (typeof formattedJourneys)[number])}
  {@const hasTrainDetails = journey.train || journey.unitNumber}
  {#if journey.trainNumber || hasTrainDetails}
    <Tooltip.AutoTooltip
      text={journey.trainNumber ?? formatTrain(journey)}
      class="text-sm truncate"
    />
  {:else}
    <p class="text-sm text-transparent">.</p>
  {/if}
  {#if journey.trainNumber && hasTrainDetails}
    <Tooltip.AutoTooltip
      text={formatTrain(journey)}
      class="text-sm text-muted-foreground truncate"
    />
  {:else}
    <p class="text-sm text-transparent">.</p>
  {/if}
{/snippet}

{#snippet actions(journey: (typeof formattedJourneys)[number])}
  <div class="flex items-center gap-2">
    {#if onNavigate && canShowJourneyOnMap(journey)}
      <Button
        variant="outline"
        size="icon"
        disabled={selecting}
        aria-label="Show on map"
        title="Show on map"
        onclick={() => showJourneyOnMap(journey)}
      >
        <MapPin size="20" />
      </Button>
    {/if}
    {#if canUpdateJourney(journey)}
      <EditJourneyAction {journey} triggerDisabled={selecting} />
    {/if}
    {#if canDeleteJourney(journey)}
      <Button
        variant="outline"
        size="icon"
        disabled={selecting}
        aria-label="Delete journey"
        title="Delete journey"
        onclick={() => handleDelete(journey)}
      >
        <X size="24" />
      </Button>
    {/if}
  </div>
{/snippet}

{#snippet passengerBadge(passengers: string[])}
  {@const label =
    passengers.length > 1
      ? `${passengers[0]} +${passengers.length - 1}`
      : passengers[0]}
  {@const needsTooltip = passengers.length > 1}
  <Badge
    variant="secondary"
    class="absolute right-3 -top-2.5 z-10 max-w-32 truncate text-[11px] shadow-sm"
  >
    {#if needsTooltip}
      <Tooltip.Root disableHoverableContent delayDuration={0}>
        <Tooltip.Trigger class="truncate">{label}</Tooltip.Trigger>
        <Tooltip.Content>{passengers.join(', ')}</Tooltip.Content>
      </Tooltip.Root>
    {:else}
      {label}
    {/if}
  </Badge>
{/snippet}

{#snippet station(station: Station | null)}
  <div class="w-28 xl:w-36 flex flex-col items-center justify-center">
    <Tooltip.AutoTooltip
      text={station?.name || 'Deleted station'}
      class="w-full text-center text-sm font-bold truncate"
    />
    <Tooltip.AutoTooltip
      text={station?.municipality || station?.country || ''}
      class="w-full text-center text-xs text-muted-foreground truncate"
    />
  </div>
{/snippet}
