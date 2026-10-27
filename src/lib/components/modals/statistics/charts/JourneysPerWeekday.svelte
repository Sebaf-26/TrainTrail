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

  import type { JourneyData } from '$lib/utils';
  import {
    getStartOfWeekDay,
    supportsWeekdayBreakdown,
  } from '$lib/utils/datetime';

  let { journeys }: { journeys: JourneyData[] } = $props();

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const journeysPerWeekday = $derived.by(() => {
    const data = journeys;
    if (!data) return;

    const firstDay = getStartOfWeekDay();

    const weekdays = Array.from({ length: 7 }, (_, i) => (i + firstDay) % 7);

    return weekdays.map((weekday) => {
      const weekdayJourneys = data.filter(
        (journey) =>
          supportsWeekdayBreakdown(journey.datePrecision) &&
          journey.date?.getDay() === weekday,
      );
      return {
        weekday,
        journeys: weekdayJourneys.length,
      };
    });
  });
</script>

<div class="w-full h-[200px] p-4 border rounded">
  <Chart
    data={journeysPerWeekday}
    x="weekday"
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
          return WEEKDAYS[i] ?? '';
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
        <Tooltip.Header>{WEEKDAYS[data.weekday]}</Tooltip.Header>
        <Tooltip.Item label="Journeys" value={data.journeys} />
      {/snippet}
    </Tooltip.Root>
  </Chart>
</div>
