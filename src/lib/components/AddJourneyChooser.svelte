<script lang="ts">
  import { SquarePen, Ticket } from '@o7/icon/lucide';

  import { Card } from '$lib/components/ui/card';
  import { Modal } from '$lib/components/ui/modal';
  import { openModalsState } from '$lib/state.svelte';

  let { open = $bindable() }: { open: boolean } = $props();

  const fillManually = () => {
    open = false;
    openModalsState.addJourney = true;
  };

  const importTicket = () => {
    open = false;
    openModalsState.importPlatform = 'ticket';
    openModalsState.settingsTab = 'import';
    openModalsState.settings = true;
  };
</script>

<Modal bind:open class="max-w-xl" dismissal="dialog" handleBackButton={false}>
  <div class="space-y-4 p-6">
    <div class="space-y-1">
      <h2 class="text-xl font-bold tracking-tight">Add a journey</h2>
      <p class="text-sm text-muted-foreground">
        Fill it in yourself, or read it from your ticket.
      </p>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        class="text-left"
        data-testid="add-journey-manual"
        onclick={fillManually}
      >
        <Card class="flex h-full items-start gap-3 p-4 hover:bg-card-hover">
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <SquarePen size={18} />
          </div>
          <div>
            <p class="font-semibold">Fill in manually</p>
            <p class="text-xs text-muted-foreground">
              Choose the stations, the times and the train yourself.
            </p>
          </div>
        </Card>
      </button>
      <button
        type="button"
        class="text-left"
        data-testid="add-journey-import-ticket"
        onclick={importTicket}
      >
        <Card class="flex h-full items-start gap-3 p-4 hover:bg-card-hover">
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Ticket size={18} />
          </div>
          <div>
            <p class="font-semibold">Import a pass or ticket</p>
            <p class="text-xs text-muted-foreground">
              An Apple Wallet pass (.pkpass), an e-mail or the message of your
              operator. The barcode is kept with the journey.
            </p>
          </div>
        </Card>
      </button>
    </div>
  </div>
</Modal>
