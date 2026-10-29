<script lang="ts">
  import { Info } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../';

  import FileStep from './FileStep.svelte';
  import OptionsStep from './OptionsStep.svelte';
  import PlatformTabs from './PlatformTabs.svelte';
  import StatusStep from './StatusStep.svelte';
  import UserMappingStep from './UserMappingStep.svelte';

  import type { ImportFailure } from './';

  import { page } from '$app/state';
  import { canRestoreAllJourneys } from '$lib/authorization/permissions';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { processFiles } from '$lib/import';
  import {
    createEmptyImportMappings,
    createEmptyImportUnknowns,
    getOutstandingUnknowns,
    getPendingJourneys,
    mergeImportMappings,
    type ImportMappings,
    type ImportUnknowns,
    type IndexedJourney,
  } from '$lib/import/model';
  import { platforms, type Platform } from '$lib/import/platforms';
  import { journeyAddedState, openModalsState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { invalidateJourneyData } from '$lib/trpc/invalidation';
  import { cn, pluralize } from '$lib/utils';
  import { getErrorText } from '$lib/utils/error';

  let { open = $bindable() }: { open: boolean } = $props();

  let step = $state<1 | 2 | 3 | 4 | 5>(1);

  let files: FileList | null = $state(null);
  let pastedText = $state('');
  let originalFiles: File[] = $state([]);
  let fileError: string | null = $state(null);

  // Tickets can be many at once, e.g. a folder of PDFs.
  const MAX_FILES = 300;

  let importing = $state(false);
  let importedCount = $state(0);
  let updatedCount = $state(0);
  let skippedRows = $state(0);
  let importFailures = $state<ImportFailure[]>([]);
  let unknowns = $state<ImportUnknowns>(createEmptyImportUnknowns());
  let exportedUsers = $state<
    {
      id: string;
      username: string;
      displayName: string;
      mappedUserId: string | null;
    }[]
  >([]);

  let platform = $state<Platform>(platforms[0]);

  // Opened from "Add a journey > Import a pass or ticket": start on that source.
  $effect(() => {
    const requested = openModalsState.importPlatform;
    if (!requested) return;
    openModalsState.importPlatform = null;
    const source = platforms.find((candidate) => candidate.value === requested);
    if (source) {
      platform = source;
      step = 2;
    }
  });

  let userMapping = $state<Record<string, string>>({});
  let appliedMappings = $state<ImportMappings>(createEmptyImportMappings());
  const handledJourneyIndices = new Set<number>();
  let ownerOnly = $state(false);
  let dedupeImportedJourneys = $state(true);
  let restoreMode = $state(false);

  const importMode = $derived<'personal' | 'restore'>(
    platform.value === 'traintrail' && restoreMode ? 'restore' : 'personal',
  );
  const canRestore = $derived(canRestoreAllJourneys(page.data.authorization));

  const steps = $derived(
    platform.value === 'traintrail'
      ? (['Source', 'File', 'Options', 'Users', 'Status'] as const)
      : (['Source', 'File', 'Options', 'Status'] as const),
  );
  const displayStep = $derived(
    platform.value === 'traintrail' ? step : step === 5 ? 4 : step,
  );

  const validateFile = () => {
    const selected = Array.from((files ?? []) as ArrayLike<File>);
    if (selected.length === 0) return;

    const extensions: readonly string[] = platform.extensions;
    const unsupported = selected.find(
      (file) =>
        !extensions.some((ext) => file.name.toLowerCase().endsWith(ext)),
    );
    const tooBig = selected.find((file) => file.size > 5 * 1024 * 1024);
    // With several files, say which one is the problem.
    const which = (file: File) => (selected.length > 1 ? `: ${file.name}` : '');

    if (unsupported) {
      fileError = `File type not supported${which(unsupported)}`;
    } else if (tooBig) {
      fileError = `File must be less than 5MB${which(tooBig)}`;
    } else if (selected.length > MAX_FILES) {
      fileError = `Choose at most ${MAX_FILES} files`;
    } else {
      fileError = null;
    }
  };

  const hasPastedTicket = $derived(
    platform.value === 'ticket' && pastedText.trim() !== '',
  );
  const hasFiles = $derived(!!files?.[0]);
  const canImport = $derived((hasFiles && !fileError) || hasPastedTicket);
  const createMany = trpc.journey.createMany.mutation();

  const getImportErrorMessage = (
    error: unknown,
    fallback = 'Unknown import error',
  ) => {
    return getErrorText(error) || fallback;
  };

  const refreshImportedJourneys = async () => {
    await invalidateJourneyData();
    journeyAddedState.added = true;
  };

  const importBatch = async (
    batch: IndexedJourney[],
  ): Promise<{
    inserted: number;
    updated: number;
    attached: number;
    failures: ImportFailure[];
  }> => {
    if (!batch.length)
      return { inserted: 0, updated: 0, attached: 0, failures: [] };

    try {
      const stats = await $createMany.mutateAsync({
        journeys: batch.map(({ journey }) => journey),
        dedupe: dedupeImportedJourneys,
        mode: importMode,
      });

      return {
        inserted: stats?.insertedJourneys ?? 0,
        updated: stats?.updatedJourneys ?? 0,
        attached: stats?.attachedPassengers ?? 0,
        failures: [],
      };
    } catch (error) {
      if (batch.length === 1) {
        return {
          inserted: 0,
          updated: 0,
          attached: 0,
          failures: [
            {
              index: batch[0]!.index,
              message: getImportErrorMessage(error),
            },
          ],
        };
      }

      const middle = Math.floor(batch.length / 2);
      const first = await importBatch(batch.slice(0, middle));
      const second = await importBatch(batch.slice(middle));

      return {
        inserted: first.inserted + second.inserted,
        updated: first.updated + second.updated,
        attached: first.attached + second.attached,
        failures: [...first.failures, ...second.failures],
      };
    }
  };

  const executeImport = async (mapping?: {
    mappings?: ImportMappings;
    userMapping?: Record<string, string>;
    allowUnmappedOptional?: boolean;
  }) => {
    if (originalFiles.length === 0) return;

    const result = await processFiles(originalFiles, platform.value, {
      filterOwner: ownerOnly,
      importMode,
      stationMapping: mapping?.mappings?.stations,
      operatorMapping: mapping?.mappings?.operators,
      trainMapping: mapping?.mappings?.train,
      userMapping: mapping?.userMapping,
    });

    const { journeys } = result;
    if (!journeys.length) {
      toast.info('No new journeys to import');
      unknowns = result.unknowns;
      exportedUsers = result.exportedUsers;
      skippedRows = result.skippedRows ?? 0;
      importFailures = [];
      if (skippedRows > 0) {
        toast.warning(
          `Skipped ${skippedRows} ${pluralize(skippedRows, 'row')} that could not be parsed`,
        );
      }
      return;
    }

    // Keep unresolved journeys pending for review. Once the user continues,
    // operators and trains may remain empty, but stations still block import.
    const nextUnknowns = result.unknowns;
    const journeysToImport = getPendingJourneys(
      journeys,
      nextUnknowns,
      handledJourneyIndices,
      {
        allowUnknownOperators: mapping?.allowUnmappedOptional,
        allowUnknownTrain: mapping?.allowUnmappedOptional,
      },
    );

    // Send journeys in batches to avoid exceeding the server body size limit
    const BATCH_SIZE = 50;
    let inserted = 0;
    let updated = 0;
    let attached = 0;
    const failures: ImportFailure[] = [];
    for (let i = 0; i < journeysToImport.length; i += BATCH_SIZE) {
      const batch = journeysToImport.slice(i, i + BATCH_SIZE);
      const result = await importBatch(batch);
      inserted += result.inserted;
      updated += result.updated;
      attached += result.attached;
      failures.push(...result.failures);
      const failedIndices = new Set(
        result.failures.map((failure) => failure.index),
      );
      for (const { index } of batch) {
        if (!failedIndices.has(index)) handledJourneyIndices.add(index);
      }
    }
    if (inserted > 0 || updated > 0 || attached > 0) {
      await refreshImportedJourneys();
    }

    unknowns = getOutstandingUnknowns(nextUnknowns, handledJourneyIndices);
    exportedUsers = result.exportedUsers;
    skippedRows = result.skippedRows ?? 0;
    importFailures = failures;

    importedCount = mapping ? importedCount + inserted : inserted;
    updatedCount = mapping ? updatedCount + updated : updated;
    if (inserted > 0) {
      toast.success(`Imported ${inserted} ${pluralize(inserted, 'journey')}`);
    }
    if (updated > 0) {
      toast.success(`Updated ${updated} ${pluralize(updated, 'journey')}`);
    }
    if (inserted === 0 && updated === 0 && failures.length === 0) {
      toast.info('No new journeys to import');
    }
    if (skippedRows > 0) {
      toast.warning(
        `Skipped ${skippedRows} ${pluralize(skippedRows, 'row')} that could not be parsed`,
      );
    }
    if (failures.length > 0) {
      toast.error(
        `Skipped ${failures.length} ${pluralize(failures.length, 'journey')} with validation errors`,
      );
    }
  };

  const handleImport = async () => {
    // A pasted ticket is read like an uploaded text file.
    const selected = Array.from((files ?? []) as ArrayLike<File>);
    const chosen =
      selected.length > 0
        ? selected
        : hasPastedTicket
          ? [new File([pastedText], 'ticket.txt', { type: 'text/plain' })]
          : [];
    if (chosen.length === 0 || (selected.length > 0 && fileError)) return;

    importing = true;
    originalFiles = chosen;
    handledJourneyIndices.clear();

    try {
      const result = await processFiles(chosen, platform.value, {
        filterOwner: ownerOnly,
        importMode,
      });

      exportedUsers = result.exportedUsers;

      if (platform.value === 'traintrail') {
        userMapping = Object.fromEntries(
          result.exportedUsers
            .filter((user) => user.mappedUserId)
            .map((user) => [user.id, user.mappedUserId!]),
        );
        files = null;
        importing = false;
        step = 4;
        return;
      }

      if (!result.journeys.length) {
        toast.error('No journeys found in the file');
        files = null;
        importing = false;
        return;
      }

      await executeImport();
      files = null;
      importing = false;
      step = 4;
    } catch (error) {
      toast.error(getImportErrorMessage(error, 'Failed to import file'));
      console.error(error);
      importing = false;
    }
  };

  const handleUserMappingNext = async (mapping: Record<string, string>) => {
    userMapping = mapping;
    importing = true;
    try {
      await executeImport({ userMapping: mapping });
      step = 5;
    } catch (error) {
      toast.error(getImportErrorMessage(error, 'Failed to import file'));
      console.error(error);
    } finally {
      importing = false;
    }
  };

  const handleImportRemaining = async (
    pendingMappings: ImportMappings,
  ): Promise<boolean> => {
    if (originalFiles.length === 0) return false;
    const nextMappings = mergeImportMappings(appliedMappings, pendingMappings);

    importing = true;
    try {
      await executeImport({
        mappings: nextMappings,
        userMapping,
        allowUnmappedOptional: true,
      });
      appliedMappings = nextMappings;
      return true;
    } catch (error) {
      toast.error(
        getImportErrorMessage(error, 'Failed to import remaining journeys'),
      );
      console.error(error);
      return false;
    } finally {
      importing = false;
    }
  };

  const closeAndReset = () => {
    unknowns = createEmptyImportUnknowns();
    exportedUsers = [];
    userMapping = {};
    appliedMappings = createEmptyImportMappings();
    handledJourneyIndices.clear();
    importedCount = 0;
    updatedCount = 0;
    skippedRows = 0;
    importFailures = [];
    files = null;
    pastedText = '';
    originalFiles = [];
    fileError = null;
    importing = false;
    ownerOnly = false;
    dedupeImportedJourneys = true;
    restoreMode = false;
    platform = platforms[0];
    step = 1;
    open = false;
  };
</script>

<PageHeader title="Import">
  {#snippet subtitleHtml()}
    <p class="text-muted-foreground text-sm">
      Re-import a JSON export from TrainTrail, or add a journey from a ticket.
      Learn more <a
        href="https://github.com/Sebaf-26/TrainTrail"
        target="_blank"
        class="text-blue-500 underline">in the documentation</a
      >.
    </p>
  {/snippet}

  <nav class="-mt-2 mb-2" aria-label="Import steps">
    <ol class="flex items-center gap-2 text-sm">
      {#each steps as s, i (s)}
        <li
          class={cn('flex items-center gap-2', {
            'text-primary': displayStep === i + 1,
          })}
        >
          <div
            class={cn(
              'h-6 w-6 rounded-full border flex items-center justify-center text-[0.8rem]',
              {
                'bg-primary text-primary-foreground border-primary':
                  displayStep === i + 1,
                'text-muted-foreground border-muted': displayStep !== i + 1,
              },
            )}
            aria-current={displayStep === i + 1 ? 'step' : undefined}
          >
            {i + 1}
          </div>
          <span class="hidden sm:inline text-muted-foreground">{s}</span>
          {#if i < steps.length - 1}
            <span class="text-muted-foreground">/</span>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>

  {#if step === 1}
    <!-- Step 1: Choose source/platform -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium">Choose a source</h3>
      <Card class="p-3">
        <PlatformTabs bind:platform />
      </Card>
    </div>
    {#if platform.value === 'traintrail'}
      <Alert.Root variant="info" class="mt-2">
        <Info />
        <Alert.Description>
          Custom field values are included in the export for reference, but are
          not restored during import.
          {#if !canRestore}
            Only journeys belonging to the exported account you map to yourself
            will be imported. Other passengers will be added as guests.
          {/if}
        </Alert.Description>
      </Alert.Root>
    {/if}
    {#if platform.value === 'ticket'}
      <Alert.Root variant="info" class="mt-2">
        <Info />
        <Alert.Description>
          Paste the message or e-mail you got from your operator, or choose the
          e-mail file (.eml) or the Apple Wallet pass (.pkpass). Google Wallet
          does not export passes, so paste the text of the pass instead. Check
          the imported journeys afterwards: the times are read in the timezone
          of each station.
        </Alert.Description>
      </Alert.Root>
    {/if}
    <div class="mt-4 flex justify-end">
      <Button onclick={() => (step = 2)}>Next</Button>
    </div>
  {:else if step === 2}
    <FileStep
      {platform}
      bind:files
      bind:pastedText
      {fileError}
      {validateFile}
      canNext={canImport}
      onback={() => (step = 1)}
      onnext={() => (step = 3)}
    />
  {:else if step === 3}
    <OptionsStep
      showFilterOwner={platform.options.filterOwner}
      showRestoreMode={platform.value === 'traintrail' && canRestore}
      bind:ownerOnly
      bind:dedupeImportedJourneys
      bind:restoreMode
      {importing}
      {canImport}
      onback={() => (step = 2)}
      onimport={handleImport}
    />
  {:else if step === 4 && platform.value === 'traintrail'}
    <UserMappingStep
      {exportedUsers}
      {userMapping}
      {restoreMode}
      busy={importing}
      onback={() => (step = 3)}
      onnext={handleUserMappingNext}
    />
  {:else}
    <StatusStep
      {importedCount}
      {updatedCount}
      {skippedRows}
      {importFailures}
      {unknowns}
      busy={importing}
      onimportremaining={handleImportRemaining}
      onclose={closeAndReset}
    />
  {/if}
</PageHeader>
