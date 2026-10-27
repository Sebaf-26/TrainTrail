<script lang="ts">
  import PieChart from './PieChart.svelte';

  import {
    JOURNEY_CHARTS,
    type JourneyChartKey,
  } from '$lib/stats/aggregations';
  import { type JourneyData } from '$lib/utils';

  let {
    journeys,
    onOpenChart,
    seatUserId,
  }: {
    journeys: JourneyData[];
    onOpenChart?: (key: JourneyChartKey) => void;
    seatUserId?: string;
  } = $props();

  const ctx = $derived.by(() => ({
    userId: seatUserId,
  }));

  const seatDistribution = $derived.by(() =>
    JOURNEY_CHARTS['seat'].aggregate(journeys, ctx),
  );
  const seatClassDistribution = $derived.by(() =>
    JOURNEY_CHARTS['seat-class'].aggregate(journeys, ctx),
  );
  const reasonDistribution = $derived.by(() =>
    JOURNEY_CHARTS['reason'].aggregate(journeys, ctx),
  );
  const continentDistribution = $derived.by(() =>
    JOURNEY_CHARTS['continents'].aggregate(journeys, ctx),
  );

  const topOperatorDistribution = $derived.by(() =>
    JOURNEY_CHARTS['operators'].aggregate(journeys, ctx, { limit: 5 }),
  );
  const topTrainDistribution = $derived.by(() =>
    JOURNEY_CHARTS['train-models'].aggregate(journeys, ctx, { limit: 5 }),
  );
  const topUnitNumberDistribution = $derived.by(() =>
    JOURNEY_CHARTS['unit-numbers'].aggregate(journeys, ctx, { limit: 5 }),
  );
  const topStationDistribution = $derived.by(() =>
    JOURNEY_CHARTS['stations'].aggregate(journeys, ctx, { limit: 5 }),
  );
  const topRouteDistribution = $derived.by(() =>
    JOURNEY_CHARTS['routes'].aggregate(journeys, ctx, { limit: 5 }),
  );
</script>

<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
  <div class="cursor-pointer" onclick={() => onOpenChart?.('seat-class')}>
    <PieChart data={seatClassDistribution} title="Seat Class" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('seat')}>
    <PieChart data={seatDistribution} title="Seat Preference" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('reason')}>
    <PieChart data={reasonDistribution} title="Journey Reasons" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('continents')}>
    <PieChart data={continentDistribution} title="Continents" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('operators')}>
    <PieChart data={topOperatorDistribution} title="Top Operators" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('train-models')}>
    <PieChart data={topTrainDistribution} title="Top Train Models" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('unit-numbers')}>
    <PieChart data={topUnitNumberDistribution} title="Top Specific Train" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('stations')}>
    <PieChart data={topStationDistribution} title="Top Visited Stations" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('routes')}>
    <PieChart data={topRouteDistribution} title="Top Routes" />
  </div>
</div>
