<script lang="ts">
  import { tick } from 'svelte';
  import { writable } from 'svelte/store';
  import { toast } from 'svelte-sonner';

  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';
  import {
    createDefaultFilters,
    matchesJourney,
    matchesLocationFilters,
    matchesNonLocationFilters,
  } from '$lib/components/journey-filters/model';
  import {
    createDefaultTempFilters,
    hasTempFilters as hasActiveTempFilters,
    type JourneyFilters,
    type TempFilters,
  } from '$lib/components/journey-filters/types';
  import { Map } from '$lib/components/map';
  import { MapDetailsPane } from '$lib/components/map-details';
  import { ListJourneysModal, StatisticsModal } from '$lib/components/modals';
  import JourneysOnboarding from '$lib/components/onboarding/JourneysOnboarding.svelte';
  import { createJourneyNavigator } from '$lib/journey-navigation';
  import { includeFocusedJourneyInList } from '$lib/journey-visibility';
  import { waitForModalHistoryIdle } from '$lib/components/ui/modal/modal-history';
  import {
    closeMapDetails,
    journeyScopeState,
    focusJourneyInList,
    mapDetailsState,
    openJourneyDetails,
    openModalsState,
    setJourneyScope,
  } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { invalidateJourneyData } from '$lib/trpc/invalidation';
  import { Card } from '$lib/components/ui/card';
  import type { JourneyScope } from '$lib/journey-scope';
  import { prepareJourneyData } from '$lib/utils';

  const user = $derived(page.data.user);
  const canReadOwnJourneysAtLoad = hasClientPermission(
    page.data.authorization,
    'journey.read.own',
  );
  const canReadOwnJourneys = $derived(
    hasClientPermission(page.data.authorization, 'journey.read.own'),
  );
  const canReadAnyJourneys = $derived(
    hasClientPermission(page.data.authorization, 'journey.read.any'),
  );
  const canOnboardJourneys = $derived(
    hasClientPermission(page.data.authorization, 'journey.create.own') ||
      hasClientPermission(page.data.authorization, 'journey.import.own'),
  );

  const journeyListInput = writable<JourneyScope>({ scope: 'mine' });

  $effect(() => {
    let scope = journeyScopeState.current;
    if (scope.scope !== 'mine' && !canReadAnyJourneys) {
      scope = { scope: 'mine' };
      setJourneyScope(scope);
    }
    journeyListInput.set(scope);
  });

  const rawJourneys = trpc.journey.list.query(journeyListInput, {
    enabled: canReadOwnJourneysAtLoad,
  });
  const rawJourneyTracks = trpc.journeyTrack.list.query(journeyListInput, {
    enabled: canReadOwnJourneysAtLoad,
  });
  const rawVisitedCountries = trpc.visitedCountries.list.query(undefined, {
    enabled: canReadOwnJourneysAtLoad,
  });

  const journeys = $derived.by(() => {
    const data = $rawJourneys.data;
    if (!data || !data.length) return [];

    return prepareJourneyData(data);
  });

  $effect(() => {
    const selection = mapDetailsState.selection;
    if ($rawJourneys.isLoading || selection?.type !== 'journey') return;
    if (journeys.some((journey) => journey.id === selection.journeyId)) return;
    closeMapDetails();
  });

  const visitedCountriesData = $derived.by(() => {
    const data = $rawVisitedCountries.data;
    if (!data || !data.length) return [];

    return data;
  });

  const journeyTracks = $derived.by(() => {
    const data = $rawJourneyTracks.data;
    if (!data || !data.length) return [];

    return data;
  });

  const trackedJourneyIds = $derived(
    new Set(journeyTracks.map((track) => track.journeyId)),
  );

  let filters: JourneyFilters = $state(createDefaultFilters());
  let tempFilters: TempFilters = $state(createDefaultTempFilters());

  const effectiveSeatUserId = $derived.by(() => {
    if (journeyScopeState.current.scope === 'all') return undefined;
    if (journeyScopeState.current.scope === 'user') {
      return journeyScopeState.current.userId;
    }
    return user?.id;
  });

  const showPassengerDetails = $derived(
    journeyScopeState.current.scope !== 'mine',
  );
  const showCountryStats = $derived(journeyScopeState.current.scope === 'mine');
  let focusedListJourneyId = $state<number | null>(null);

  $effect(() => {
    if (!openModalsState.listJourneys) {
      tempFilters = createDefaultTempFilters();
      focusedListJourneyId = null;
    }
  });

  const filteredJourneys = $derived.by(() => {
    return journeys.filter((journey) => matchesJourney(journey, filters));
  });

  const filteredDrilldownJourneys = $derived.by(() => {
    const locationFilters = hasActiveTempFilters(tempFilters)
      ? tempFilters
      : filters;

    return journeys.filter(
      (journey) =>
        matchesLocationFilters(journey, locationFilters) &&
        matchesNonLocationFilters(journey, filters),
    );
  });

  const focusedListResult = $derived.by(() =>
    includeFocusedJourneyInList(
      filteredDrilldownJourneys,
      journeys,
      focusedListJourneyId,
    ),
  );
  const drilldownJourneys = $derived(focusedListResult.journeys);
  const focusedJourneyOutsideFilters = $derived(
    focusedListResult.focusedJourneyOutsideFilters,
  );

  const invalidator = {
    onSuccess: () => {
      void invalidateJourneyData();
    },
  };
  const deleteJourneyMutation = trpc.journey.delete.mutation(invalidator);

  const deleteJourney = async (id: number) => {
    const toastId = toast.loading('Deleting journey...');
    try {
      await $deleteJourneyMutation.mutateAsync(id);
      toast.success('Journey deleted', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete journey', { id: toastId });
    }
  };

  const navigateJourneys = createJourneyNavigator({
    getState: () => ({
      tempFilters,
      focusedListJourneyId,
      listOpen: openModalsState.listJourneys,
      statisticsOpen: openModalsState.statistics,
    }),
    commitState: (next) => {
      tempFilters = next.tempFilters;
      focusedListJourneyId = next.focusedListJourneyId;
      Object.assign(openModalsState, {
        listJourneys: next.listOpen,
        statistics: next.statisticsOpen,
      });
    },
    focusJourneyInList,
    waitForModalClose: async () => {
      await tick();
      await waitForModalHistoryIdle();
    },
    openJourneyDetails,
  });

  const openStatisticsJourney = (journeyId: number) => {
    return navigateJourneys({
      destination: 'list',
      focus: { type: 'journey', journeyId },
    });
  };
</script>

{#if canReadOwnJourneys}
  {#if !$rawJourneys.isLoading && canOnboardJourneys}
    <JourneysOnboarding journeysCount={journeys.length} />
  {/if}
  <ListJourneysModal
    bind:open={openModalsState.listJourneys}
    bind:filters
    bind:tempFilters
    {journeys}
    filteredJourneys={drilldownJourneys}
    {focusedJourneyOutsideFilters}
    {deleteJourney}
    seatUserId={effectiveSeatUserId}
    {showPassengerDetails}
    {trackedJourneyIds}
    onNavigate={navigateJourneys}
  />
  <StatisticsModal
    bind:open={openModalsState.statistics}
    {journeys}
    {filteredJourneys}
    bind:filters
    visitedCountries={showCountryStats ? visitedCountriesData : []}
    seatUserId={effectiveSeatUserId}
    {showCountryStats}
    onOpenJourney={openStatisticsJourney}
  />

  <Map
    bind:filters
    bind:tempFilters
    {journeys}
    {filteredJourneys}
    {journeyTracks}
    onNavigate={navigateJourneys}
  />
  <MapDetailsPane
    {journeys}
    bind:filters
    seatUserId={effectiveSeatUserId}
    onNavigate={navigateJourneys}
  />
{:else}
  <Map
    bind:filters
    bind:tempFilters
    journeys={[]}
    filteredJourneys={[]}
    journeyTracks={[]}
    onNavigate={navigateJourneys}
  />
  <div
    class="pointer-events-none fixed inset-0 z-10 grid place-items-center p-6"
  >
    <Card level="2" class="max-w-md p-6 text-center shadow-lg">
      <h1 class="text-lg font-semibold">Journey access is unavailable</h1>
      <p class="mt-2 text-sm text-muted-foreground">
        Your role does not grant access to journey data. You can still use the
        settings and tools available to your role.
      </p>
    </Card>
  </div>
{/if}
