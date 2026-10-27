<script lang="ts">
  import { LoaderCircle } from '@o7/icon/lucide';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';

  let {
    showFilterOwner = false,
    showRestoreMode = false,
    ownerOnly = $bindable(false),
    dedupeImportedJourneys = $bindable(true),
    restoreMode = $bindable(false),
    importing = false,
    canImport = false,
    onback,
    onimport,
  }: {
    showFilterOwner?: boolean;
    showRestoreMode?: boolean;
    ownerOnly?: boolean;
    dedupeImportedJourneys?: boolean;
    restoreMode?: boolean;
    importing?: boolean;
    canImport?: boolean;
    onback?: () => void;
    onimport?: () => void;
  } = $props();
</script>

<div class="space-y-2">
  <h3 class="text-sm font-medium">Options</h3>
  <Card class="p-3 space-y-2">
    {#if showFilterOwner}
      <div class="flex items-center gap-2">
        <Checkbox
          id="owner-only"
          bind:checked={ownerOnly}
          aria-labelledby="owner-only-label"
        />
        <Label id="owner-only-label" for="owner-only"
          >Only import your journeys</Label
        >
      </div>
    {/if}
    {#if showRestoreMode}
      <div class="flex items-start gap-2">
        <Checkbox
          id="restore-all-users"
          bind:checked={restoreMode}
          aria-labelledby="restore-all-users-label"
        />
        <div class="space-y-0.5">
          <Label id="restore-all-users-label" for="restore-all-users">
            Restore journeys for all mapped users
          </Label>
          <p class="text-xs text-muted-foreground">
            Deduplicates against every journey on this instance. Admin access is
            required.
          </p>
        </div>
      </div>
    {/if}
    <div class="flex items-center gap-2">
      <Checkbox
        id="dedupe-imported-journeys"
        bind:checked={dedupeImportedJourneys}
        aria-labelledby="dedupe-imported-journeys-label"
      />
      <Label id="dedupe-imported-journeys-label" for="dedupe-imported-journeys">
        Deduplicate imported journeys
      </Label>
    </div>
  </Card>
  <div class="mt-4 flex justify-between">
    <Button variant="secondary" onclick={() => onback?.()}>Back</Button>
    <Button onclick={() => onimport?.()} disabled={!canImport || importing}>
      {#if importing}
        <LoaderCircle class="animate-spin mr-1" size={16} />
      {/if}
      Import
    </Button>
  </div>
</div>
