<script lang="ts">
  import { Maximize2, Ticket, Trash2 } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { confirmation } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Modal } from '$lib/components/ui/modal';
  import { barcodeFormatLabels, barcodeImageUrl } from '$lib/ticket/barcode';
  import { api } from '$lib/trpc';
  import type { JourneyData } from '$lib/utils';
  import { formatTrainNumberLabel } from '$lib/utils/journey-labels';

  let {
    journey,
    seatLabel,
  }: { journey: JourneyData; seatLabel?: string | null } = $props();

  type StoredTicket = Awaited<ReturnType<typeof api.journey.ticket.query>>;

  let ticket = $state<StoredTicket>(null);
  let fullscreen = $state(false);

  // The ticket is only ever given to the user it was kept for, so a journey
  // without one (or someone else's journey) simply shows nothing.
  $effect(() => {
    const id = journey.id;
    ticket = null;
    api.journey.ticket
      .query(id)
      .then((result) => {
        if (journey.id === id) ticket = result;
      })
      .catch(() => {
        // No ticket section is better than an error on every journey.
      });
  });

  const imageUrl = $derived(
    ticket ? barcodeImageUrl(ticket.barcodeFormat, ticket.barcodeData) : null,
  );
  const train = $derived(
    [journey.operator?.name, formatTrainNumberLabel(journey.trainNumber)]
      .filter(Boolean)
      .join(' · ') || null,
  );

  const remove = async () => {
    const confirmed = await confirmation.show({
      title: 'Remove Ticket',
      description:
        'Remove the ticket and its barcode from this journey? The journey itself stays.',
    });
    if (!confirmed) return;

    try {
      await api.journey.removeTicket.mutate(journey.id);
      ticket = null;
      fullscreen = false;
      toast.success('Ticket removed');
    } catch {
      toast.error('Could not remove the ticket');
    }
  };
</script>

{#if ticket && imageUrl}
  <section class="flex flex-col gap-2 px-4 pb-4">
    <p
      class="flex items-center gap-1.5 text-xs tracking-wider text-muted-foreground uppercase"
    >
      <Ticket size={14} />
      Ticket
    </p>

    <!-- A paper ticket: always dark on white, whatever the theme, so the
         barcode keeps the contrast a scanner needs. -->
    <div class="rounded-lg bg-white p-3 text-neutral-900 shadow-sm">
      <div class="flex items-start justify-between gap-3 text-sm">
        <div class="min-w-0">
          <p class="truncate font-semibold">
            {journey.from?.name ?? '?'} → {journey.to?.name ?? '?'}
          </p>
          {#if train}
            <p class="truncate text-xs text-neutral-600">{train}</p>
          {/if}
        </div>
        {#if seatLabel}
          <p class="shrink-0 text-right text-xs text-neutral-600">
            {seatLabel}
          </p>
        {/if}
      </div>
      {#if ticket.passengerName}
        <p class="mt-1 truncate text-xs text-neutral-600">
          {ticket.passengerName}
        </p>
      {/if}

      <button
        type="button"
        class="mt-3 flex w-full justify-center rounded bg-white"
        aria-label="Show the barcode full screen"
        onclick={() => (fullscreen = true)}
      >
        <img
          src={imageUrl}
          alt="{barcodeFormatLabels[
            ticket.barcodeFormat
          ]} barcode of the ticket"
          class="max-h-56 w-auto max-w-full"
        />
      </button>
    </div>

    <div class="flex items-center justify-between">
      <Button
        variant="ghost"
        size="sm"
        class="gap-1.5 text-muted-foreground hover:text-foreground"
        onclick={() => (fullscreen = true)}
      >
        <Maximize2 size={14} />
        Full screen
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="gap-1.5 text-muted-foreground hover:text-destructive"
        onclick={remove}
      >
        <Trash2 size={14} />
        Remove
      </Button>
    </div>
  </section>

  <Modal bind:open={fullscreen} class="max-w-md" dismissal="dialog">
    <div class="flex flex-col items-center gap-3 rounded-lg bg-white p-4">
      <img
        src={imageUrl}
        alt="{barcodeFormatLabels[ticket.barcodeFormat]} barcode of the ticket"
        class="w-full max-w-xs"
      />
      <p class="text-center text-xs text-neutral-600">
        {barcodeFormatLabels[ticket.barcodeFormat]} code
        {#if ticket.passengerName}· {ticket.passengerName}{/if}
      </p>
    </div>
  </Modal>
{/if}
