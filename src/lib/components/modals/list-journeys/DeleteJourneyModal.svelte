<script lang="ts">
  import JourneyCard from './JourneyCard.svelte';

  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Modal } from '$lib/components/ui/modal';
  import type { Operator, Station } from '$lib/db/types';

  type Journey = {
    id: number;
    from: Station | null;
    to: Station | null;
    operator: Operator | null;
  };

  let {
    open = $bindable(false),
    journey,
    onConfirm,
  }: {
    open?: boolean;
    journey: Journey | null;
    onConfirm: () => void | Promise<void>;
  } = $props();

  let confirmationInput = $state('');
  let isDeleting = $state(false);

  const fromName = $derived(journey?.from?.name ?? 'N/A');
  const toName = $derived(journey?.to?.name ?? 'N/A');
  const confirmationCode = $derived(`${fromName}-${toName}`);
  const isConfirmed = $derived(
    confirmationInput.toUpperCase() === confirmationCode.toUpperCase(),
  );

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;
    isDeleting = true;
    try {
      await onConfirm();
      open = false;
      confirmationInput = '';
    } finally {
      isDeleting = false;
    }
  };

  // Reset input when modal closes
  $effect(() => {
    if (!open) {
      confirmationInput = '';
    }
  });
</script>

<Modal
  bind:open
  preset="alert"
  dismissal="form"
  dirty={confirmationInput.length > 0}
  busy={isDeleting}
  onDiscard={() => {
    confirmationInput = '';
  }}
>
  <div class="flex flex-col gap-4 min-w-0">
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold">Delete journey</h2>
      <p class="text-sm text-muted-foreground">
        Are you sure you want to delete this journey?
      </p>
      <p class="text-sm text-muted-foreground">
        This action cannot be undone. All associated data will be permanently
        removed.
      </p>
    </div>

    <!-- Journey card -->
    {#if journey}
      <div class="rounded-lg border px-4 py-3 overflow-hidden">
        <JourneyCard {journey} showMeta={false} />
      </div>
    {/if}

    <!-- Confirmation input -->
    <div class="flex flex-col gap-2">
      <label for="confirmation" class="text-sm">
        To verify, type <span class="font-semibold">{confirmationCode}</span> below
      </label>
      <Input
        id="confirmation"
        bind:value={confirmationInput}
        placeholder={confirmationCode}
        autocomplete="off"
      />
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-2 pt-2">
      <Button
        variant="outline"
        disabled={isDeleting}
        onclick={() => (open = false)}>Cancel</Button
      >
      <Button
        variant="destructive"
        disabled={!isConfirmed || isDeleting}
        onclick={handleDelete}
      >
        {isDeleting ? 'Deleting...' : 'Delete journey'}
      </Button>
    </div>
  </div>
</Modal>
