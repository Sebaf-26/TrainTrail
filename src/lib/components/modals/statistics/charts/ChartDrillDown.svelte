<script lang="ts">
  import {
    ChartColumn,
    ChevronDown,
    MapPin,
    Route,
    TrainFront,
  } from '@o7/icon/lucide';
  import { PieChart } from 'layerchart';

  import JourneyCard from '../../list-journeys/JourneyCard.svelte';

  import { OperatorIcon } from '$lib/components/display';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import type { Operator, Station } from '$lib/db/types';
  import {
    type ChartKey,
    type JourneyChartKey,
    JOURNEY_CHARTS,
    COUNTRY_CHARTS,
    codeForStation,
    journeyMatchesChartBucket,
    routeLabelForJourney,
  } from '$lib/stats/aggregations';
  import { cn, type JourneyData } from '$lib/utils';

  const JOURNEY_PREVIEW_LIMIT = 5;

  let {
    chartKey,
    data,
    journeys,
    onBack,
    onOpenJourney,
    seatUserId,
  }: {
    chartKey: ChartKey;
    data: Record<string, number>;
    journeys: JourneyData[];
    onBack: () => void;
    onOpenJourney?: (journeyId: number) => void;
    seatUserId?: string;
  } = $props();

  type RowDetails = {
    operator?: Operator | null;
    station?: Station | null;
    routeStations?: { from: Station | null; to: Station | null };
    subtitle?: string | null;
    journeys: JourneyData[];
  };

  const chartDef = $derived(
    chartKey in JOURNEY_CHARTS
      ? JOURNEY_CHARTS[chartKey as keyof typeof JOURNEY_CHARTS]
      : COUNTRY_CHARTS[chartKey as keyof typeof COUNTRY_CHARTS],
  );
  const isJourneyChart = $derived(chartKey in JOURNEY_CHARTS);
  const totalCount = $derived(Object.values(data).reduce((a, b) => a + b, 0));
  const sortedEntries = $derived(
    Object.entries(data).sort(([keyA, a], [keyB, b]) => {
      if (keyA === 'No Data') return 1;
      if (keyB === 'No Data') return -1;
      return b - a;
    }),
  );

  let expandedKey: string | null = $state(null);
  let expandedJourneyListKeys: string[] = $state([]);

  const noData = $derived(totalCount === 0);
  const chartData = $derived.by(() => {
    if (noData) {
      return [{ label: 'No data', value: 1 }];
    }
    return sortedEntries.map(([key, value]) => ({
      label: key,
      value,
    }));
  });

  const getPercentage = (value: number) => {
    if (totalCount === 0) return 0;
    return Math.round((value / totalCount) * 100);
  };

  const colorAt = (index: number) =>
    [
      '#3b82f6',
      '#6366f1',
      '#8b5cf6',
      '#a855f7',
      '#d946ef',
      '#ec4899',
      '#f59e0b',
      '#10b981',
      '#06b6d4',
      '#8b5cf6',
    ][index % 10] as string;

  const colorNextAt = (index: number) =>
    [
      '#6366f1',
      '#8b5cf6',
      '#a855f7',
      '#d946ef',
      '#ec4899',
      '#f59e0b',
      '#10b981',
      '#06b6d4',
      '#8b5cf6',
      '#3b82f6',
    ][index % 10] as string;

  const rowColor = (key: string, index: number) =>
    key === 'Others' || key === 'No Data' ? '#71717a' : colorAt(index);

  const rowGradient = (key: string, index: number) =>
    key === 'Others' || key === 'No Data'
      ? '#71717a'
      : `linear-gradient(45deg, ${colorAt(index)}, ${colorNextAt(index)})`;

  const journeysForRow = (key: string): JourneyData[] => {
    if (!isJourneyChart) return [];

    return journeys.filter((journey) =>
      journeyMatchesChartBucket(journey, chartKey as JourneyChartKey, key, {
        userId: seatUserId,
      }),
    );
  };

  const stationForKey = (key: string) => {
    for (const journey of journeys) {
      if (codeForStation(journey.from) === key) return journey.from;
      if (codeForStation(journey.to) === key) return journey.to;
    }
    return null;
  };

  const operatorForKey = (key: string) =>
    journeys.find((journey) => journey.operator?.name === key)?.operator ??
    null;

  const routeStationsForKey = (key: string) => {
    const match = journeys.find(
      (journey) => routeLabelForJourney(journey) === key,
    );
    if (!match) return null;
    return { from: match.from, to: match.to };
  };

  const stationSubtitle = (station: Station | null) => {
    if (!station) return null;
    const location = [station.municipality, station.country?.toUpperCase()]
      .filter(Boolean)
      .join(', ');
    return location || station.name;
  };

  const rowDetailsFor = (key: string): RowDetails => {
    const matchingJourneys = journeysForRow(key);

    if (!isJourneyChart) {
      return { journeys: matchingJourneys };
    }

    switch (chartKey as JourneyChartKey) {
      case 'operators': {
        const operator = operatorForKey(key);
        return {
          operator,
          subtitle: operator?.code ?? null,
          journeys: matchingJourneys,
        };
      }
      case 'stations': {
        const station = stationForKey(key);
        return {
          station,
          subtitle: stationSubtitle(station),
          journeys: matchingJourneys,
        };
      }
      case 'routes': {
        const routeStations = routeStationsForKey(key);
        return {
          routeStations: routeStations ?? undefined,
          subtitle: routeStations
            ? `${routeStations.from?.name ?? 'Unknown'} to ${routeStations.to?.name ?? 'Unknown'}`
            : null,
          journeys: matchingJourneys,
        };
      }
      case 'train-models': {
        const train = journeys.find(
          (journey) => journey.train?.name === key,
        )?.train;
        return {
          subtitle: train?.code ?? null,
          journeys: matchingJourneys,
        };
      }
      case 'unit-numbers': {
        const train = journeys.find(
          (journey) => journey.unitNumber === key,
        )?.train;
        return {
          subtitle: train?.name ?? null,
          journeys: matchingJourneys,
        };
      }
      default:
        return { journeys: matchingJourneys };
    }
  };

  const rowDetails = $derived.by(
    () =>
      Object.fromEntries(
        sortedEntries.map(([key]) => [key, rowDetailsFor(key)]),
      ) as Record<string, RowDetails>,
  );

  const isJourneyListExpanded = (key: string) =>
    expandedJourneyListKeys.includes(key);

  const expandJourneyList = (key: string) => {
    if (isJourneyListExpanded(key)) {
      return;
    }
    expandedJourneyListKeys = [...expandedJourneyListKeys, key];
  };
</script>

<div class="min-h-[80vh]">
  <div class="border-b border-zinc-200 dark:border-zinc-700">
    <div class="flex flex-col justify-center p-6">
      <Button
        variant="link"
        size="sm"
        onclick={onBack}
        class="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 px-0 h-auto w-fit text-left font-normal underline-offset-2"
      >
        ← Back to Overview
      </Button>
      <h1 class="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
        {chartDef.title}
      </h1>
      <p class="text-lg text-zinc-600 dark:text-zinc-400 mt-1">
        {totalCount} total entries across {journeys.length} journeys
      </p>
    </div>
  </div>

  <div class="p-6">
    <div class="max-w-7xl mx-auto">
      <div class="grid lg:grid-cols-2 gap-8 items-start">
        <div class="space-y-6">
          <div
            class="rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
          >
            <div class="p-6 border-b border-zinc-200 dark:border-zinc-700">
              <h2
                class="text-xl font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Distribution Overview
              </h2>
            </div>
            <div class="p-6">
              <div class="h-[400px] flex items-center justify-center">
                <PieChart
                  data={chartData}
                  key="label"
                  value="value"
                  cRange={noData
                    ? ['#3b82f650']
                    : chartData.map((d, i) => rowColor(d.label, i))}
                />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div
              class="rounded-lg shadow border border-zinc-200 dark:border-zinc-700 p-4"
            >
              <div class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {sortedEntries.length}
              </div>
              <div class="text-sm text-zinc-600 dark:text-zinc-400">
                Unique Categories
              </div>
            </div>
            <div
              class="rounded-lg shadow border border-zinc-200 dark:border-zinc-700 p-4"
            >
              <div class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {totalCount}
              </div>
              <div class="text-sm text-zinc-600 dark:text-zinc-400">
                Total Count
              </div>
            </div>
          </div>
        </div>

        <div
          class="rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
        >
          <div class="p-6 border-b border-zinc-200 dark:border-zinc-700">
            <h2 class="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Detailed Breakdown
            </h2>
            <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              All {sortedEntries.length} categories ranked by frequency
            </p>
          </div>
          <div class="max-h-[500px] overflow-y-auto">
            {#if noData}
              <div
                class="p-8 flex flex-col items-center text-zinc-500 dark:text-zinc-400"
              >
                <ChartColumn class="mb-2" />
                <p class="text-lg font-medium">No data available</p>
                <p class="text-sm">
                  This chart will populate as you add more journeys
                </p>
              </div>
            {:else}
              <div class="divide-y divide-zinc-200 dark:divide-zinc-700">
                {#each sortedEntries as [key, value], index (key)}
                  {@const details = rowDetails[key] ?? { journeys: [] }}
                  {@const percentage = getPercentage(value)}
                  <div
                    class="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                  >
                    <button
                      type="button"
                      class="w-full p-4 text-left"
                      onclick={() => {
                        if (isJourneyChart) {
                          expandedKey = expandedKey === key ? null : key;
                        }
                      }}
                    >
                      <div class="flex items-center justify-between gap-4">
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="flex-shrink-0">
                            {@render rowIcon(key, index, details)}
                          </div>
                          <div class="min-w-0">
                            <div
                              class="font-medium text-zinc-900 dark:text-zinc-100 truncate"
                            >
                              {key}
                            </div>
                            <div
                              class="text-sm text-zinc-600 dark:text-zinc-400 truncate"
                            >
                              {#if details.subtitle}
                                {details.subtitle}
                              {:else if key !== 'No Data'}
                                Rank #{index + 1}
                              {:else}
                                Missing details
                              {/if}
                            </div>
                          </div>
                        </div>
                        <div class="flex items-center gap-3 shrink-0">
                          <div class="text-right">
                            <div
                              class="font-bold text-lg text-zinc-900 dark:text-zinc-100"
                            >
                              {value}
                            </div>
                            <div
                              class="text-sm text-zinc-600 dark:text-zinc-400"
                            >
                              {percentage}%
                            </div>
                          </div>
                          {#if isJourneyChart}
                            <ChevronDown
                              size={20}
                              class={cn(
                                'text-zinc-500 transition-transform',
                                expandedKey === key && 'rotate-180',
                              )}
                            />
                          {/if}
                        </div>
                      </div>
                      <div class="mt-2">
                        <div
                          class="w-full bg-zinc-200 dark:bg-zinc-600 rounded-full h-2"
                        >
                          <div
                            class="h-2 rounded-full bg-gradient-to-r transition-all duration-300"
                            style="width: {percentage}%; background: {rowGradient(
                              key,
                              index,
                            )}"
                          ></div>
                        </div>
                      </div>
                    </button>

                    {#if expandedKey === key && isJourneyChart}
                      {@const journeyListExpanded = isJourneyListExpanded(key)}
                      {@const visibleJourneys = journeyListExpanded
                        ? details.journeys
                        : details.journeys.slice(0, JOURNEY_PREVIEW_LIMIT)}
                      {@const hiddenJourneyCount =
                        details.journeys.length - visibleJourneys.length}
                      <div class="px-4 pb-4">
                        <div
                          class="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden"
                        >
                          <div
                            class="px-4 py-3 flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700"
                          >
                            <p
                              class="text-sm font-medium text-zinc-900 dark:text-zinc-100"
                            >
                              Matching Journeys
                            </p>
                            <Badge variant="outline">
                              {details.journeys.length}
                            </Badge>
                          </div>
                          {#if details.journeys.length}
                            <div
                              class="divide-y divide-zinc-200 dark:divide-zinc-700"
                            >
                              {#each visibleJourneys as journey (journey.id)}
                                {#if onOpenJourney}
                                  <button
                                    type="button"
                                    class="w-full p-4 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                                    onclick={() => onOpenJourney(journey.id)}
                                  >
                                    <JourneyCard {journey} />
                                  </button>
                                {:else}
                                  <div class="p-4">
                                    <JourneyCard {journey} />
                                  </div>
                                {/if}
                              {/each}
                              {#if hiddenJourneyCount > 0}
                                <button
                                  type="button"
                                  class="flex min-h-14 w-full items-center justify-center px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                                  onclick={() => expandJourneyList(key)}
                                >
                                  Show {hiddenJourneyCount} more {hiddenJourneyCount ===
                                  1
                                    ? 'journey'
                                    : 'journeys'}
                                </button>
                              {/if}
                            </div>
                          {:else}
                            <p
                              class="p-4 text-sm text-zinc-600 dark:text-zinc-400"
                            >
                              No matching journeys found.
                            </p>
                          {/if}
                        </div>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

{#snippet rowIcon(key: string, index: number, details: RowDetails)}
  {#if details.operator}
    <div
      class="size-10 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
    >
      <OperatorIcon operator={details.operator} size={30} fallback="train" />
    </div>
  {:else if details.station}
    <div
      class="size-10 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden"
    >
      {#if details.station.country}
        <img
          src={`https://flagcdn.com/${details.station.country.toLowerCase()}.svg`}
          alt=""
          title={details.station.country.toUpperCase()}
          class="h-5 w-7 object-cover"
          loading="lazy"
          decoding="async"
        />
      {:else}
        <MapPin size={22} class="text-zinc-500" />
      {/if}
    </div>
  {:else if details.routeStations}
    <div class="flex items-center -space-x-1">
      {@render stationFlag(details.routeStations.from)}
      {@render stationFlag(details.routeStations.to)}
    </div>
  {:else if chartKey === 'train-models' || chartKey === 'unit-numbers'}
    <div
      class="size-10 flex items-center justify-center rounded-lg text-white"
      style="background: {rowGradient(key, index)}"
    >
      <TrainFront size={22} />
    </div>
  {:else if chartKey === 'routes'}
    <div
      class="size-10 flex items-center justify-center rounded-lg text-white"
      style="background: {rowGradient(key, index)}"
    >
      <Route size={22} />
    </div>
  {:else}
    <div
      class="w-3 h-3 rounded-full bg-gradient-to-r"
      style="background: {rowGradient(key, index)}"
    ></div>
  {/if}
{/snippet}

{#snippet stationFlag(station: Station | null)}
  <div
    class="size-8 flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
  >
    {#if station?.country}
      <img
        src={`https://flagcdn.com/${station.country.toLowerCase()}.svg`}
        alt=""
        title={station.country.toUpperCase()}
        class="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    {:else}
      <MapPin size={16} class="text-zinc-500" />
    {/if}
  </div>
{/snippet}
