<script lang="ts">
  import { scaleBand } from 'd3-scale';
  import {
    Area,
    Axis,
    Chart,
    LinearGradient,
    Points,
    Spline,
    Svg,
    Tooltip,
  } from 'layerchart';

  import { MONTHS, SHORT_MONTHS } from '$lib/data/datetime';
  import type { JourneyData } from '$lib/utils';
  import { supportsMonthBreakdown } from '$lib/utils/datetime';

  let { journeys }: { journeys: JourneyData[] } = $props();

  const journeysPerMonth = $derived.by(() => {
    const data = journeys;
    if (!data) return;

    const months = Array.from({ length: 12 }, (_, i) => i);
    return months.map((month) => {
      const monthJourneys = data.filter(
        (journey) =>
          supportsMonthBreakdown(journey.datePrecision) &&
          journey.date?.getMonth() === month,
      );
      return {
        month,
        journeys: monthJourneys.length,
      };
    });
  });
</script>

<div class="w-full h-[200px] p-4 border rounded">
  <Chart
    data={journeysPerMonth}
    x="month"
    xScale={scaleBand().padding(0.4)}
    y="journeys"
    yNice={2}
    padding={{ left: 16, bottom: 16 }}
  >
    <Svg>
      <Axis
        placement="left"
        grid
        rule
        ticks={(scale) => scale.ticks?.().filter(Number.isInteger)}
        format="integer"
      />
      <Axis
        placement="bottom"
        format={(i) => {
          return SHORT_MONTHS[i] ?? '';
        }}
        rule
      />
      <Spline class="stroke-2 stroke-primary" />
      <LinearGradient class="from-primary/70 to-primary/0" vertical>
        {#snippet children({ gradient })}
          <Area fill={gradient} />
          <Points r={5} class="fill-primary" />
        {/snippet}
      </LinearGradient>
    </Svg>
    <Tooltip.Root x="data" y="data">
      {#snippet children({ data })}
        <Tooltip.Header>{MONTHS[data.month]}</Tooltip.Header>
        <Tooltip.Item label="Journeys" value={data.journeys} />
      {/snippet}
    </Tooltip.Root>
  </Chart>
</div>
