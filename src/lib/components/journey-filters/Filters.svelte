<script lang="ts" module>
  import { browser } from '$app/environment';

  const filterContentZIndexProperty = '--traintrail-filter-content-z-index';
  let filterContentZIndexStack: Array<{ id: symbol; value: string }> = [];
  let previousFilterContentZIndex: string | undefined;

  function applyFilterContentZIndex() {
    if (!browser) return;

    const root = document.documentElement;
    const current = filterContentZIndexStack.at(-1)?.value;

    if (current) {
      root.style.setProperty(filterContentZIndexProperty, current);
    } else if (previousFilterContentZIndex) {
      root.style.setProperty(
        filterContentZIndexProperty,
        previousFilterContentZIndex,
      );
      previousFilterContentZIndex = undefined;
    } else {
      root.style.removeProperty(filterContentZIndexProperty);
      previousFilterContentZIndex = undefined;
    }
  }

  function pushFilterContentZIndex(value: string) {
    if (!browser) return () => {};

    const root = document.documentElement;
    const id = Symbol('filter-content-z-index');

    if (filterContentZIndexStack.length === 0) {
      previousFilterContentZIndex =
        root.style.getPropertyValue(filterContentZIndexProperty) || undefined;
    }

    filterContentZIndexStack = [...filterContentZIndexStack, { id, value }];
    applyFilterContentZIndex();

    return () => {
      filterContentZIndexStack = filterContentZIndexStack.filter(
        (entry) => entry.id !== id,
      );
      applyFilterContentZIndex();
    };
  }
</script>

<script lang="ts">
  import {
    Calendar,
    Funnel,
    ArrowLeftToLine,
    ArrowRightFromLine,
    Hash,
    TrainFront,
    UsersRound,
    X,
  } from '@o7/icon';
  import { CorporateFare } from '@o7/icon/material';
  import { Filter, useDataTableFilters } from 'bits-ui';
  import { createRawSnippet } from 'svelte';
  import type { Component } from 'svelte';
  import type { ColumnConfig, FilterIcon, FiltersState } from 'bits-ui';

  import './filter.css';
  import './filter-date.css';

  import {
    bitsFiltersToJourneyFilters,
    bitsSignature,
    createDefaultFilters,
    journeyFiltersToBits,
    journeySignature,
    hasJourneyFilters,
    matchesLocationFilters,
  } from '$lib/components/journey-filters/model';
  import type {
    JourneyFilters,
    TempFilters,
  } from '$lib/components/journey-filters/types';
  import UserAvatar from '$lib/components/display/UserAvatar.svelte';
  import {
    cn,
    getJourneyPassengerLabel,
    getJourneyPassengerToken,
    type JourneyData,
  } from '$lib/utils';
  import type { Train, Operator, Station } from '$lib/db/types';
  import { getModalContext } from '$lib/components/ui/modal/Modal.svelte';

  type JourneyFilterColumnConfig =
    | ColumnConfig<JourneyData, 'option', string, 'departureStations'>
    | ColumnConfig<JourneyData, 'option', string, 'arrivalStations'>
    | ColumnConfig<JourneyData, 'option', string, 'year'>
    | ColumnConfig<JourneyData, 'date', Date, 'date'>
    | ColumnConfig<JourneyData, 'multiOption', string[], 'passengers'>
    | ColumnConfig<JourneyData, 'option', string, 'operator'>
    | ColumnConfig<JourneyData, 'option', string, 'train'>
    | ColumnConfig<JourneyData, 'option', string, 'unitNumbers'>;

  let {
    journeys = $bindable(),
    filters = $bindable(),
    tempFilters = $bindable(),
    hasTempFilters = false,
    layout = 'default',
    presentation = 'default',
  }: {
    journeys: JourneyData[];
    filters: JourneyFilters;
    tempFilters?: TempFilters;
    hasTempFilters?: boolean;
    layout?: 'default' | 'stacked';
    presentation?: 'default' | 'map-popover';
  } = $props();

  type OptionSource = {
    value: string;
    label: string;
    shortLabel?: string;
    count?: number;
    icon?: FilterIcon;
    keywords?: string[];
  };

  type FilterIconProps = {
    size?: number;
    class?: string;
    'aria-hidden'?: boolean | 'true' | 'false';
  };

  function escapeAttribute(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function operatorIcon(operator: Operator): FilterIcon {
    if (!operator.iconPath) return CorporateFare;

    const src = escapeAttribute(`/api/uploads/${operator.iconPath}`);
    const title = escapeAttribute(operator.name);

    return createRawSnippet(() => ({
      render: () =>
        `<img data-filter-operator-icon src="${src}" alt="" title="${title}" loading="lazy" decoding="async" />`,
    }));
  }

  function stationFlagIcon(station: Station): FilterIcon {
    const country = station.country?.toLowerCase();
    if (!country) return TrainFront;

    const code = escapeAttribute(country);
    const title = escapeAttribute(station.country.toUpperCase());

    return createRawSnippet(() => ({
      render: () =>
        `<img data-filter-station-flag-icon src="https://flagcdn.com/${code}.svg" alt="" title="${title}" loading="lazy" decoding="async" />`,
    }));
  }

  function passengerAvatarIcon(username: string): FilterIcon {
    const Icon: Component<FilterIconProps> = (internals, props) =>
      UserAvatar(internals, {
        ...props,
        username,
        size: props.size ?? 16,
        animated: false,
        class: cn('traintrail-filter-user-avatar', props.class),
      });

    return Icon;
  }

  const tempLocationFiltersActive = $derived(
    hasTempFilters ||
      !!(
        tempFilters &&
        (tempFilters.departureStations.length ||
          tempFilters.arrivalStations.length ||
          tempFilters.stationsEither.length ||
          tempFilters.routes.length)
      ),
  );

  // When viewing a route/station drilldown, scope the filter options to the
  // journeys on that route/station so only relevant values are offered.
  const scopedJourneys = $derived.by(() => {
    if (!tempLocationFiltersActive || !tempFilters) return journeys ?? [];
    return (journeys ?? []).filter((journey) =>
      matchesLocationFilters(journey, tempFilters),
    );
  });
  const modalCtx = getModalContext();
  const filterContentZIndex = $derived.by(() => {
    const modalZ = modalCtx?.getContentZIndex();
    return modalZ !== undefined ? `${modalZ + 5}` : undefined;
  });

  $effect(() => {
    if (!filterContentZIndex) return;
    return pushFilterContentZIndex(filterContentZIndex);
  });

  const uniqueStations = (
    sourceJourneys: JourneyData[],
    stationSelector: (journey: JourneyData) => Station | null,
  ) => {
    const seen = new Set<string>();
    return sourceJourneys
      .map(stationSelector)
      .filter((station): station is Station => !!station)
      .filter((station) => {
        const id = station.id.toString();
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((station) => ({
        value: station.id.toString(),
        label: station.name,
        shortLabel: station.name,
        keywords: station.municipality ? [station.municipality] : [],
        icon: stationFlagIcon(station),
      }));
  };

  function columnOptions(options: OptionSource[]) {
    return options;
  }

  const departureStations = $derived.by(() => {
    return uniqueStations(scopedJourneys, (journey) => journey.from);
  });

  const arrivalStations = $derived.by(() => {
    return uniqueStations(scopedJourneys, (journey) => journey.to);
  });

  const passengerOptions = $derived.by(() => {
    const options = new Map<string, OptionSource>();

    for (const journey of scopedJourneys) {
      for (const passenger of journey.passengers) {
        const value = getJourneyPassengerToken(passenger);
        const label = getJourneyPassengerLabel(passenger);

        if (!value || !label) continue;

        const existing = options.get(value);
        if (existing) {
          existing.count = (existing.count ?? 0) + 1;
        } else {
          options.set(value, {
            value,
            label,
            count: 1,
            icon: passengerAvatarIcon(
              passenger.user?.username ??
                `guest:${passenger.guestName ?? label}`,
            ),
          });
        }
      }
    }

    return Array.from(options.values()).sort(
      (a, b) =>
        (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label),
    );
  });

  const operatorOptions = $derived.by(() => {
    const frequencyMap = new Map<
      string,
      {
        operator: Operator;
        count: number;
      }
    >();

    for (const journey of scopedJourneys) {
      if (!journey.operator) continue;
      const existing = frequencyMap.get(journey.operator.name);
      if (existing) {
        existing.count += 1;
      } else {
        frequencyMap.set(journey.operator.name, {
          operator: journey.operator,
          count: 1,
        });
      }
    }

    return Array.from(frequencyMap.values())
      .map(({ operator, count }) => ({
        value: operator.name,
        label: operator.name,
        keywords: operator.code ? [operator.code] : [],
        count,
        icon: operatorIcon(operator),
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  });

  const trainOptions = $derived.by(() => {
    const frequencyMap = new Map<
      string,
      {
        train: Train;
        count: number;
      }
    >();

    for (const journey of scopedJourneys) {
      if (!journey.train) continue;
      const existing = frequencyMap.get(journey.train.name);
      if (existing) {
        existing.count += 1;
      } else {
        frequencyMap.set(journey.train.name, {
          train: journey.train,
          count: 1,
        });
      }
    }

    return Array.from(frequencyMap.values())
      .map(({ train, count }) => ({
        value: train.name,
        label: train.name,
        keywords: [train.code].filter((code): code is string => !!code),
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  });

  const unitNumberOptions = $derived.by(() => {
    const frequencyMap = new Map<string, number>();

    for (const journey of scopedJourneys) {
      if (!journey.unitNumber) continue;
      frequencyMap.set(
        journey.unitNumber,
        (frequencyMap.get(journey.unitNumber) ?? 0) + 1,
      );
    }

    return Array.from(frequencyMap.entries())
      .map(([unitNumber, count]) => ({
        value: unitNumber,
        label: unitNumber,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  });

  const yearOptions = $derived.by(() => {
    const years = new Set<string>();

    for (const journey of scopedJourneys) {
      if (journey.date) {
        years.add(journey.date.getFullYear().toString());
      }
    }

    return Array.from(years)
      .sort((a, b) => b.localeCompare(a))
      .map((year) => ({
        value: year,
        label: year,
      }));
  });

  const columnsConfig = $derived.by(() => {
    return [
      {
        id: 'departureStations',
        displayName: 'Departure Station',
        type: 'option',
        accessor: (journey) => journey.from?.id.toString() ?? '',
        icon: ArrowRightFromLine,
        options: columnOptions(departureStations),
        hidden: tempLocationFiltersActive,
      },
      {
        id: 'arrivalStations',
        displayName: 'Arrival Station',
        type: 'option',
        accessor: (journey) => journey.to?.id.toString() ?? '',
        icon: ArrowLeftToLine,
        options: columnOptions(arrivalStations),
        hidden: tempLocationFiltersActive,
      },
      {
        id: 'year',
        displayName: 'Year',
        type: 'option',
        accessor: (journey) => journey.date?.getFullYear().toString() ?? '',
        icon: Calendar,
        options: yearOptions,
      },
      {
        id: 'date',
        displayName: 'Date',
        type: 'date',
        accessor: (journey) =>
          journey.date ?? journey.dateStart ?? journey.dateEnd ?? new Date(),
        icon: Calendar,
      },
      {
        id: 'passengers',
        displayName: 'Passenger',
        type: 'multiOption',
        accessor: (journey) =>
          journey.passengers
            .map((passenger) => getJourneyPassengerToken(passenger))
            .filter((value): value is string => !!value),
        icon: UsersRound,
        options: columnOptions(passengerOptions),
      },
      {
        id: 'operator',
        displayName: 'Operator',
        type: 'option',
        accessor: (journey) => journey.operator?.name ?? '',
        icon: CorporateFare,
        options: columnOptions(operatorOptions),
      },
      {
        id: 'train',
        displayName: 'Train',
        type: 'option',
        accessor: (journey) => journey.train?.name ?? '',
        icon: TrainFront,
        options: columnOptions(trainOptions),
      },
      {
        id: 'unitNumbers',
        displayName: 'Unit Number',
        type: 'option',
        accessor: (journey) => journey.unitNumber ?? '',
        icon: Hash,
        options: columnOptions(unitNumberOptions),
      },
    ] satisfies ReadonlyArray<JourneyFilterColumnConfig>;
  });

  const filterState = useDataTableFilters({
    strategy: 'client',
    data: journeys,
    columnsConfig,
    entityName: 'Journey',
    defaultFilters: journeyFiltersToBits(filters),
  });

  let lastSyncedBitsSignature = $state(bitsSignature(filterState.filters));
  let lastSyncedJourneySignature = $state(journeySignature(filters));
  const showClear = $derived(hasJourneyFilters(filters));

  function syncBitsFilters(nextBits: FiltersState) {
    filterState.actions.batch((actions) => {
      actions.removeAllFilters();

      for (const filter of nextBits) {
        const column = filterState.columns.find(
          (candidate) => candidate.id === filter.columnId,
        );
        if (!column) continue;

        actions.setFilterValue(column, filter.values);
        actions.setFilterOperator(filter.columnId, filter.operator);
      }
    });
  }

  $effect(() => {
    const currentBitsSignature = bitsSignature(filterState.filters);
    if (currentBitsSignature === lastSyncedBitsSignature) return;

    lastSyncedBitsSignature = currentBitsSignature;
    filters = bitsFiltersToJourneyFilters(filterState.filters, filters);
    lastSyncedJourneySignature = journeySignature(filters);
  });

  $effect(() => {
    const currentJourneySignature = journeySignature(filters);
    if (currentJourneySignature === lastSyncedJourneySignature) return;

    const nextBits = journeyFiltersToBits(filters);
    const nextBitsSignature = bitsSignature(nextBits);

    lastSyncedJourneySignature = currentJourneySignature;
    if (nextBitsSignature === lastSyncedBitsSignature) return;

    lastSyncedBitsSignature = nextBitsSignature;
    syncBitsFilters(nextBits);
  });

  const providerColumns = $derived(filterState.columns);
</script>

<Filter.Provider
  columns={providerColumns as never}
  filters={filterState.filters}
  actions={filterState.actions}
  strategy={filterState.strategy}
  entityName="Journey"
  variant="clean"
>
  <Filter.Root
    class="traintrail-filter-root"
    data-filter-layout={layout}
    data-filter-presentation={presentation}
  >
    {#if layout === 'stacked'}
      <div class="traintrail-filter-toolbar">
        {@render filterMenu()}
        {@render filterActions()}
      </div>
      {@render filterList()}
    {:else}
      <div class="traintrail-filter-stack">
        {@render filterMenu()}
        {@render filterList()}
        {@render filterActions()}
      </div>
    {/if}
  </Filter.Root>
</Filter.Provider>

{#snippet filterMenu()}
  <Filter.Menu>
    <Funnel size={16} aria-hidden="true" />
    {#if filterState.filters.length === 0 || layout === 'stacked'}
      <span>Filter</span>
    {:else}
      <span class="sr-only">Filter</span>
    {/if}
  </Filter.Menu>
{/snippet}

{#snippet filterList()}
  <Filter.List>
    {#snippet children({ filter, column })}
      <Filter.Item {filter} {column}>
        <Filter.Subject />
        <Filter.Operator />
        <Filter.Value />
        <Filter.Remove aria-label={`Remove ${column.displayName} filter`}>
          <X size={16} aria-hidden="true" />
        </Filter.Remove>
      </Filter.Item>
    {/snippet}
  </Filter.List>
{/snippet}

{#snippet filterActions()}
  <button
    type="button"
    data-filter-actions
    data-state={showClear ? 'visible' : 'hidden'}
    disabled={!showClear}
    onclick={() => {
      filters = createDefaultFilters();
    }}
  >
    <X size={14} aria-hidden="true" />
    <span>Clear</span>
  </button>
{/snippet}
