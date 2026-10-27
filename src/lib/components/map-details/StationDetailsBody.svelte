<script lang="ts">
  import StationJourneysCard from '$lib/components/station-details/StationJourneysCard.svelte';
  import StationStatsCard from '$lib/components/station-details/StationStatsCard.svelte';
  import StationTimeCard from '$lib/components/station-details/StationTimeCard.svelte';
  import type { JourneyData, prepareVisitedStations } from '$lib/utils';

  type VisitedStation = ReturnType<typeof prepareVisitedStations>[number];

  let {
    station,
    relatedJourneys,
    onShowDepartures,
    onShowArrivals,
    onShowJourney,
  }: {
    station: VisitedStation;
    relatedJourneys: JourneyData[];
    onShowDepartures: () => void;
    onShowArrivals: () => void;
    onShowJourney: (journeyId: number) => void;
  } = $props();

  let now = $state(new Date());
  $effect(() => {
    const id = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(id);
  });
</script>

<StationStatsCard
  journeys={relatedJourneys}
  stationId={station.id}
  operatorCount={station.operators.length}
  {now}
/>
<StationTimeCard tz={station.tz} {now} />
<StationJourneysCard
  journeys={relatedJourneys}
  stationId={station.id}
  onShowAllDepartures={onShowDepartures}
  onShowAllArrivals={onShowArrivals}
  {onShowJourney}
/>
