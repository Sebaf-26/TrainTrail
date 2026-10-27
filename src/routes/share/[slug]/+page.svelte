<script lang="ts">
  import type { inferRouterOutputs } from '@trpc/server';
  import { ChartPie } from '@o7/icon/lucide';
  import { DirectionsRailway } from '@o7/icon/material/solid';
  import { writable } from 'svelte/store';

  import { page } from '$app/state';
  import { createDefaultFilters } from '$lib/components/journey-filters/model';
  import type { JourneyFilters } from '$lib/components/journey-filters/types';
  import { Map } from '$lib/components/map';
  import type { Journey, JourneyPassenger } from '$lib/db/types';
  import type { AppRouter } from '$lib/server/routes/_app';
  import type { JourneyTrackRow } from '$lib/track/schema';
  import { ListJourneysModal, StatisticsModal } from '$lib/components/modals';
  import { clearJourneyListFocus, focusJourneyInList } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { prepareJourneyData } from '$lib/utils';

  type ShareJourney =
    inferRouterOutputs<AppRouter>['share']['public']['journeys'][number];

  function normalizeSharedJourney(journey: ShareJourney) {
    return {
      ...journey,
      date: journey.date ?? null,
      datePrecision: journey.datePrecision ?? 'day',
      departure: journey.departure ?? null,
      arrival: journey.arrival ?? null,
      departureScheduled: journey.departureScheduled ?? null,
      arrivalScheduled: journey.arrivalScheduled ?? null,
      departurePlatform: null,
      arrivalPlatform: null,
      trainNumber: journey.trainNumber ?? null,
      unitNumber: journey.unitNumber ?? null,
      note: null,
      operator: journey.operator ?? null,
      train: journey.train ?? null,
      passengers: journey.passengers.map((passenger) => ({
        ...passenger,
        user:
          'user' in passenger
            ? (passenger.user as JourneyPassenger['user'])
            : null,
      })),
    };
  }

  const shareInput = writable({ slug: page.params.slug ?? '' });

  $effect(() => {
    shareInput.set({ slug: page.params.slug ?? '' });
  });

  const shareQuery = trpc.share.public.query(shareInput);

  const journeys = $derived.by(() => {
    const data = $shareQuery.data;
    if (!data?.journeys?.length) return [];

    return prepareJourneyData(
      data.journeys.map(normalizeSharedJourney) as unknown as Journey[],
    );
  });

  const journeyTracks = $derived.by((): JourneyTrackRow[] => {
    const data = $shareQuery.data;
    if (!data?.journeys?.length) return [];

    return data.journeys.flatMap((journey) =>
      journey.track
        ? [
            {
              journeyId: journey.id,
              ...journey.track,
              pointCount: journey.track.coordinates.length,
            },
          ]
        : [],
    );
  });

  const trackedJourneyIds = $derived(
    new Set(journeyTracks.map((track) => track.journeyId)),
  );

  let showJourneyList = $state(false);
  let showStatistics = $state(false);
  let filters: JourneyFilters = $state(createDefaultFilters());

  const shareSettings = $derived($shareQuery.data?.settings);

  const openSharedJourneyInList = (journeyId: number) => {
    focusJourneyInList(journeyId);
    showJourneyList = true;
  };

  $effect(() => {
    return () => {
      clearJourneyListFocus();
    };
  });
</script>

<svelte:head>
  <title>Shared Journey Map - TrainTrail</title>
  <meta name="description" content="View shared journey data on TrainTrail" />
</svelte:head>

{#if shareSettings && journeys.length > 0}
  <!-- Navigation bar for accessible modals -->
  {#if shareSettings.showJourneyList || shareSettings.showStats}
    <nav
      class="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b"
    >
      <div
        class="container mx-auto px-4 py-3 flex items-center justify-between"
      >
        <div class="flex items-center space-x-2">
          <div class="text-lg font-semibold">Shared Journeys</div>
          <div class="text-sm text-muted-foreground">
            ({journeys.length} journeys)
          </div>
        </div>
        <div class="flex items-center space-x-2">
          {#if shareSettings.showJourneyList}
            <button
              onclick={() => (showJourneyList = true)}
              class="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
            >
              Journey List
            </button>
          {/if}
          {#if shareSettings.showStats}
            <button
              onclick={() => (showStatistics = true)}
              class="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
            >
              Statistics
            </button>
          {/if}
        </div>
      </div>
    </nav>
  {/if}

  {#if shareSettings.showMap}
    <div
      class={shareSettings.showJourneyList || shareSettings.showStats
        ? 'h-full pt-14'
        : 'h-full'}
    >
      <Map {journeys} filteredJourneys={journeys} {journeyTracks} />
    </div>
  {:else}
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center flex flex-col items-center space-y-4 max-w-md">
        <ChartPie size={64} class="text-primary" />
        <h1 class="text-2xl font-bold">Shared Journey Data</h1>
        <p class="text-muted-foreground">
          This share includes {journeys.length} journeys.
          {#if shareSettings.showJourneyList || shareSettings.showStats}
            Use the buttons above to explore the data.
          {:else}
            The map view is not available for this share.
          {/if}
        </p>
      </div>
    </div>
  {/if}

  {#if shareSettings.showJourneyList}
    <ListJourneysModal
      bind:open={showJourneyList}
      {journeys}
      filteredJourneys={journeys}
      {trackedJourneyIds}
      readonly={true}
    />
  {/if}

  {#if shareSettings.showStats}
    <StatisticsModal
      bind:open={showStatistics}
      {journeys}
      filteredJourneys={journeys}
      {filters}
      showFilters={false}
      showCountryStats={false}
      onOpenJourney={shareSettings.showJourneyList
        ? openSharedJourneyInList
        : undefined}
    />
  {/if}
{:else if shareSettings}
  <div class="flex items-center justify-center min-h-screen">
    <div class="flex flex-col items-center text-center space-y-4 max-w-md">
      <DirectionsRailway size={64} class="text-primary" />
      <h1 class="text-2xl font-bold">No Journeys to Display</h1>
      <p class="text-muted-foreground">
        This share doesn't contain any journey data, or the filters applied
        result in no visible journeys.
      </p>
    </div>
  </div>
{/if}
