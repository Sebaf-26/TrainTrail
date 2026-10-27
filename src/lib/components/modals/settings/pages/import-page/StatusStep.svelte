<script lang="ts">
  import { Check, CircleAlert, ExternalLink } from '@o7/icon/lucide';

  import UnknownMappingSection from './UnknownMappingSection.svelte';

  import type { ImportFailure } from './';

  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';
  import TrainPicker from '$lib/components/form-fields/TrainPicker.svelte';
  import OperatorPicker from '$lib/components/form-fields/OperatorPicker.svelte';
  import StationPicker from '$lib/components/form-fields/StationPicker.svelte';
  import CreateTrain from '$lib/components/modals/settings/pages/data-page/train/CreateTrain.svelte';
  import CreateOperator from '$lib/components/modals/settings/pages/data-page/operator/CreateOperator.svelte';
  import CreateStation from '$lib/components/modals/settings/pages/data-page/station/CreateStation.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Separator } from '$lib/components/ui/separator';
  import type { Operator, Station, Train } from '$lib/db/types';
  import {
    createEmptyImportMappings,
    createEmptyImportUnknowns,
    type ImportMappings,
    type ImportUnknowns,
  } from '$lib/import/model';
  import { pluralize } from '$lib/utils';

  let {
    importedCount = 0,
    updatedCount = 0,
    skippedRows = 0,
    importFailures = [],
    unknowns = createEmptyImportUnknowns(),
    busy = false,
    onimportremaining,
    onclose,
  }: {
    importedCount?: number;
    updatedCount?: number;
    skippedRows?: number;
    importFailures?: ImportFailure[];
    unknowns?: ImportUnknowns;
    busy?: boolean;
    onimportremaining?: (mappings: ImportMappings) => Promise<boolean>;
    onclose?: () => void;
  } = $props();

  const unknownStationCodes = $derived(Object.keys(unknowns.stations));
  const unknownOperatorCodes = $derived(Object.keys(unknowns.operators));
  const unknownTrainCodes = $derived(Object.keys(unknowns.train));

  let mappings = $state<ImportMappings>(createEmptyImportMappings());

  const mappingSections = $derived([
    {
      label: 'station',
      unknownCount: unknownStationCodes.length,
      mappedCount: Object.keys(mappings.stations).length,
    },
    {
      label: 'operator',
      unknownCount: unknownOperatorCodes.length,
      mappedCount: Object.keys(mappings.operators).length,
    },
    {
      label: 'train',
      unknownCount: unknownTrainCodes.length,
      mappedCount: Object.keys(mappings.train).length,
    },
  ]);
  const mappedCount = $derived(
    mappingSections.reduce((count, section) => count + section.mappedCount, 0),
  );
  const unmatchedCount = $derived(
    mappingSections.reduce((count, section) => count + section.unknownCount, 0),
  );
  const optionalOnlyJourneyCount = $derived.by(() => {
    const stationIndices = new Set(Object.values(unknowns.stations).flat());
    const allIndices = new Set([
      ...stationIndices,
      ...Object.values(unknowns.operators).flat(),
      ...Object.values(unknowns.train).flat(),
    ]);
    return [...allIndices].filter((index) => !stationIndices.has(index)).length;
  });
  const canImportRemaining = $derived(
    !busy &&
      (optionalOnlyJourneyCount > 0 ||
        Object.keys(mappings.stations).length > 0),
  );
  const mappingSummary = $derived.by(() => {
    return mappingSections
      .filter((section) => section.mappedCount > 0)
      .map(
        (section) =>
          `${section.mappedCount} of ${section.unknownCount} ${pluralize(
            section.unknownCount,
            section.label,
          )} mapped`,
      )
      .join(' • ');
  });

  const canCreateStation = $derived(
    hasClientPermission(page.data.authorization, 'data.stations.manage'),
  );
  const canCreateOperator = $derived(
    hasClientPermission(page.data.authorization, 'data.operators.manage'),
  );
  const canCreateTrain = $derived(
    hasClientPermission(page.data.authorization, 'data.trains.manage'),
  );

  let createStation = $state(false);
  let createOperator = $state(false);
  let createTrain = $state(false);

  const setStationMapping = (code: string, station: Station | null) => {
    if (station) {
      mappings.stations[code] = station;
    } else {
      delete mappings.stations[code];
    }
  };

  const setOperatorMapping = (code: string, operator: Operator | null) => {
    if (operator) {
      mappings.operators[code] = operator;
    } else {
      delete mappings.operators[code];
    }
  };

  const setTrainMapping = (code: string, train: Train | null) => {
    if (train) {
      mappings.train[code] = train;
    } else {
      delete mappings.train[code];
    }
  };

  const handleImportRemaining = async () => {
    const succeeded = await onimportremaining?.(mappings);
    if (!succeeded) return;

    mappings = createEmptyImportMappings();
  };
</script>

<div class="space-y-4">
  <h3 class="text-sm font-medium">Import Status</h3>

  <Card class="p-4">
    <div class="flex items-start gap-3">
      {#if unmatchedCount > 0}
        <CircleAlert
          class="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0"
          size={20}
        />
      {:else}
        <Check
          class="text-green-600 dark:text-green-500 mt-0.5 shrink-0"
          size={20}
        />
      {/if}
      <div class="flex-1">
        <p class="font-medium text-sm">
          {unmatchedCount > 0 ? 'Review Unmatched Items' : 'Import Complete'}
        </p>
        <p class="text-sm text-muted-foreground mt-0.5">
          {#if importedCount > 0}
            Successfully imported {importedCount}
            {pluralize(importedCount, 'journey')}
            {#if updatedCount > 0}
              and updated {updatedCount} {pluralize(updatedCount, 'journey')}
            {/if}
          {:else if updatedCount > 0}
            Successfully updated {updatedCount}
            {pluralize(updatedCount, 'journey')}
          {:else if unmatchedCount > 0}
            No journeys were imported yet.
          {:else}
            No new journeys were imported.
          {/if}
        </p>
      </div>
    </div>

    {#if skippedRows > 0}
      <Separator class="my-4" />

      <div class="flex items-start gap-3">
        <CircleAlert
          class="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0"
          size={20}
        />
        <div class="flex-1">
          <p class="font-medium text-sm">
            {skippedRows} Skipped {pluralize(skippedRows, 'Row')}
          </p>
          <p class="text-sm text-muted-foreground mt-0.5">
            Could not be parsed. Check the browser console for details.
          </p>
        </div>
      </div>
    {/if}

    {#if importFailures.length > 0}
      <Separator class="my-4" />

      <div class="flex items-start gap-3">
        <CircleAlert class="text-destructive mt-0.5 shrink-0" size={20} />
        <div class="flex-1">
          <p class="font-medium text-sm">
            {importFailures.length} Validation
            {pluralize(importFailures.length, 'Error')}
          </p>
          <div class="text-sm text-muted-foreground mt-1 space-y-1">
            {#each importFailures.slice(0, 5) as failure (failure.index)}
              <p>
                Journey {failure.index + 1}: {failure.message}
              </p>
            {/each}
            {#if importFailures.length > 5}
              <p>
                Plus {importFailures.length - 5} more
                {pluralize(importFailures.length - 5, 'error')}.
              </p>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    {#if unmatchedCount > 0}
      <Separator class="my-4" />

      <div class="flex items-start gap-3">
        <CircleAlert
          class="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0"
          size={20}
        />
        <div class="flex-1">
          <p class="font-medium text-sm">
            {unmatchedCount} Unmatched {pluralize(unmatchedCount, 'Item')}
          </p>
          <p class="text-sm text-muted-foreground mt-0.5">
            Map any items you recognize. Unmapped operators and trains will be
            left blank.
            {#if unknownStationCodes.length > 0}
              Stations must be mapped before their journeys can be imported.
            {/if}
          </p>
        </div>
      </div>

      <ScrollArea class="h-[28dvh] mt-4 pr-2">
        <div class="space-y-3">
          <UnknownMappingSection title="Stations" codes={unknownStationCodes}>
            {#snippet children(code)}
              <StationPicker
                placeholder="Search for station..."
                onchange={(station) => setStationMapping(code, station)}
                onCreateNew={canCreateStation
                  ? () => (createStation = true)
                  : undefined}
                disabled={busy}
                compact
              />
            {/snippet}
          </UnknownMappingSection>

          <UnknownMappingSection
            title="Operators"
            codes={unknownOperatorCodes}
            separated={unknownStationCodes.length > 0}
          >
            {#snippet children(code)}
              <OperatorPicker
                placeholder="Search for operator..."
                onchange={(operator) => setOperatorMapping(code, operator)}
                onCreateNew={canCreateOperator
                  ? () => (createOperator = true)
                  : undefined}
                disabled={busy}
                compact
              />
            {/snippet}
          </UnknownMappingSection>

          <UnknownMappingSection
            title="Trains"
            codes={unknownTrainCodes}
            separated={unknownStationCodes.length > 0 ||
              unknownOperatorCodes.length > 0}
          >
            {#snippet children(code)}
              <TrainPicker
                placeholder="Search for train..."
                onchange={(train) => setTrainMapping(code, train)}
                onCreateNew={canCreateTrain
                  ? () => (createTrain = true)
                  : undefined}
                disabled={busy}
                compact
              />
            {/snippet}
          </UnknownMappingSection>
        </div>
      </ScrollArea>

      {#if mappedCount > 0}
        <div class="mt-4 p-3 bg-muted/30 rounded-md border border-muted">
          <p class="text-xs text-muted-foreground">{mappingSummary}</p>
        </div>
      {/if}

      <div class="mt-4 flex flex-wrap gap-2">
        <Button
          onclick={handleImportRemaining}
          disabled={!canImportRemaining}
          class="flex-1 sm:flex-none"
        >
          Import Remaining Journeys
        </Button>
        {#if unknownStationCodes.length}
          <Button
            href="https://github.com/trainline-eu/stations"
            target="_blank"
            variant="outline"
            class="gap-1"
          >
            Browse station list
            <ExternalLink size={14} />
          </Button>
        {/if}
        <Button variant="ghost" onclick={() => onclose?.()} class="ml-auto">
          Leave Remaining Unimported
        </Button>
      </div>
    {:else}
      <div class="mt-4 flex justify-end">
        <Button onclick={() => onclose?.()}>Done</Button>
      </div>
    {/if}
  </Card>
</div>

{#if canCreateStation}
  <CreateStation bind:open={createStation} withoutTrigger />
{/if}
{#if canCreateOperator}
  <CreateOperator bind:open={createOperator} withoutTrigger />
{/if}
{#if canCreateTrain}
  <CreateTrain bind:open={createTrain} withoutTrigger />
{/if}
