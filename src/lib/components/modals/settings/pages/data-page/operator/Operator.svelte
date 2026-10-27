<script lang="ts">
  import SvelteVirtualList from '@humanspeak/svelte-virtual-list';
  import { RefreshCw, LoaderCircle, SquarePen, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CreateOperator from './CreateOperator.svelte';
  import EditOperator from './EditOperator.svelte';

  import { OperatorIcon } from '$lib/components/display';
  import { confirmation } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Collapsible } from '$lib/components/ui/collapsible';
  import { Modal } from '$lib/components/ui/modal';
  import { Input } from '$lib/components/ui/input';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import type { Operator } from '$lib/db/types';
  import { api, trpc } from '$lib/trpc';

  const { operators = [] }: { operators: Operator[] } = $props();

  let editOpen = $state(false);
  let operatorToEdit = $state<Operator | null>(null);

  const openEdit = (operator: Operator) => {
    operatorToEdit = operator;
    editOpen = true;
  };

  const deleteOperator = async (operator: Operator) => {
    const confirmed = await confirmation.show({
      title: 'Remove Operator',
      description: `Are you sure you want to remove ${operator.name}?`,
    });
    if (!confirmed) return;

    const success = await api.operator.delete.mutate(operator.id);
    if (success) {
      await trpc.operator.list.utils.invalidate();
      await trpc.journey.list.utils.invalidate();
      toast.success('Operator removed');
    } else {
      toast.error('Failed to remove operator');
    }
  };

  const filteredOperators = $derived(
    operators.filter((operator) =>
      operator.name.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  let search = $state('');
  const handleSearch = (e: Event) => {
    search = (e.target as HTMLInputElement).value;
  };

  let syncDialogOpen = $state(false);
  let syncing = $state(false);
  let overwrite = $state(false);
  let includeDefunct = $state(false);

  const syncOperators = async () => {
    syncing = true;
    try {
      const result = await api.operator.sync.mutate({
        overwrite,
        includeDefunct,
      });
      await trpc.operator.list.utils.invalidate();
      let message = `Added ${result.added}, Updated ${result.updated}`;
      if (result.errors.length > 0) {
        message += ` (${result.errors.length} errors)`;
        toast.warning(message);
      } else {
        toast.success(message);
      }
    } catch {
      toast.error('Failed to sync operators');
    } finally {
      syncing = false;
    }
  };
</script>

<Collapsible title="Operators" subtitle="Manage operators in your database.">
  <div class="flex flex-col gap-4">
    <div class="flex gap-2 justify-between">
      <Input
        oninput={handleSearch}
        class="h-9"
        placeholder="Search operators"
      />
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
        <CreateOperator withoutTrigger={false} />
      </div>
    </div>
    <div class="h-[40dvh]">
      <SvelteVirtualList
        items={filteredOperators}
        itemsClass="flex flex-col gap-2"
      >
        {#snippet renderItem(operator)}
          <Card level="2" class="w-full flex items-center justify-between p-3">
            <div class="flex items-center gap-3">
              <OperatorIcon {operator} size={32} />
              <div class="flex flex-col">
                <span class="font-medium">{operator.name}</span>
                <div class="flex gap-4 text-sm text-muted-foreground">
                  {#if operator.code}
                    <span>Code: <b>{operator.code}</b></span>
                  {/if}
                </div>
              </div>
            </div>
            <div class="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onclick={() => openEdit(operator)}
              >
                <SquarePen size={16} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onclick={() => deleteOperator(operator)}
              >
                <X />
              </Button>
            </div>
          </Card>
        {/snippet}
      </SvelteVirtualList>
    </div>
  </div>
</Collapsible>

<EditOperator operator={operatorToEdit} bind:open={editOpen} />

<Modal
  bind:open={syncDialogOpen}
  dismissal="dialog"
  busy={syncing}
  class="max-w-md"
>
  <div class="flex flex-col gap-1.5">
    <h2 class="text-lg font-semibold">Sync Operators</h2>
    <p class="text-sm text-muted-foreground">
      Download operator data from the TrainTrail repository.
    </p>
  </div>

  <div class="flex flex-col gap-3 py-2">
    <label class="flex items-center gap-2 text-sm">
      <Checkbox bind:checked={overwrite} />
      Overwrite existing entries
    </label>
    <label class="flex items-center gap-2 text-sm">
      <Checkbox bind:checked={includeDefunct} />
      Include defunct operators
    </label>
  </div>

  <div class="flex flex-col gap-2">
    <Button variant="outline" disabled={syncing} onclick={syncOperators}>
      {#if syncing}
        <LoaderCircle size={16} class="mr-2 animate-spin" />
      {/if}
      Sync Operators
    </Button>
  </div>
</Modal>
