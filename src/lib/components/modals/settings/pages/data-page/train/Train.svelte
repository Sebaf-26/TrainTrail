<script lang="ts">
  import VirtualList from '@humanspeak/svelte-virtual-list';
  import { RefreshCw, LoaderCircle, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CreateTrain from './CreateTrain.svelte';
  import EditTrain from './EditTrain.svelte';

  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Collapsible } from '$lib/components/ui/collapsible';
  import { Modal } from '$lib/components/ui/modal';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import type { Train } from '$lib/db/types';
  import { api, trpc } from '$lib/trpc';

  const { train = [] }: { train: Train[] } = $props();

  const deleteTrain = async (id: number) => {
    const success = await api.train.delete.mutate(id);
    if (success) {
      await trpc.train.list.utils.invalidate();
      await trpc.journey.list.utils.invalidate();
      toast.success('Train removed');
    } else {
      toast.error('Failed to remove train');
    }
  };

  const filteredTrain = $derived(
    train.filter((train) =>
      train.name.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  let search = $state('');
  const handleSearch = (e: Event) => {
    search = (e.target as HTMLInputElement).value;
  };

  let syncDialogOpen = $state(false);
  let syncing = $state(false);
  let overwrite = $state(false);

  const syncTrain = async () => {
    syncing = true;
    try {
      const result = await api.train.sync.mutate({ overwrite });
      await trpc.train.list.utils.invalidate();
      let message = `Added ${result.added}, Updated ${result.updated}`;
      if (result.errors.length > 0) {
        message += ` (${result.errors.length} errors)`;
        toast.warning(message);
      } else {
        toast.success(message);
      }
    } catch {
      toast.error('Failed to sync trains');
    } finally {
      syncing = false;
    }
  };
</script>

<Collapsible title="Trains" subtitle="Manage train models in your database.">
  <div class="flex flex-col gap-4">
    <div class="flex gap-2 justify-between">
      <Input oninput={handleSearch} class="h-9" placeholder="Search trains" />
      <div class="flex gap-2">
        <Button
          variant="outline"
          class="h-9"
          disabled={syncing}
          onclick={() => (syncDialogOpen = true)}
        >
          <RefreshCw size={16} class="shrink-0" />
          Sync
        </Button>
        <CreateTrain />
      </div>
    </div>

    <div class="h-[40dvh]">
      <VirtualList items={filteredTrain} itemsClass="flex flex-col gap-4">
        {#snippet renderItem(trainItem)}
          <Card level="2" class="w-full flex items-center justify-between p-3">
            <div class="flex flex-col gap-1">
              <h4 class="leading-4">{trainItem.name}</h4>
              <p class="text-sm">
                <span class="text-muted-foreground">Code</span>
                <b>{trainItem.code ?? 'N/A'}</b>
              </p>
            </div>
            <div class="flex items-center gap-2">
              {#key trainItem}
                <EditTrain train={trainItem} />
              {/key}
              <Confirm
                onConfirm={async () => deleteTrain(trainItem.id)}
                title="Remove Train"
                description="Are you sure you want to remove this train? This may affect existing journey records."
              >
                {#snippet triggerContent({ props })}
                  <Button variant="outline" size="icon" {...props}>
                    <X />
                  </Button>
                {/snippet}
              </Confirm>
            </div>
          </Card>
        {/snippet}
      </VirtualList>
    </div>
  </div>
</Collapsible>

<Modal
  bind:open={syncDialogOpen}
  dismissal="dialog"
  busy={syncing}
  class="max-w-md"
>
  <div class="flex flex-col gap-1.5">
    <h2 class="text-lg font-semibold">Sync Trains</h2>
    <p class="text-sm text-muted-foreground">
      Download train model data from the TrainTrail repository.
    </p>
  </div>

  <div class="flex flex-col gap-3 py-2">
    <label class="flex items-center gap-2 text-sm">
      <Checkbox bind:checked={overwrite} />
      Overwrite existing entries
    </label>
  </div>

  <div class="flex flex-col gap-2">
    <Button variant="outline" disabled={syncing} onclick={syncTrain}>
      {#if syncing}
        <LoaderCircle size={16} class="mr-2 animate-spin" />
      {/if}
      Sync Trains
    </Button>
  </div>
</Modal>
