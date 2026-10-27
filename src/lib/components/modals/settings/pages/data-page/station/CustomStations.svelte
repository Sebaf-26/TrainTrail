<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CreateStation from './CreateStation.svelte';
  import EditStation from './EditStation.svelte';

  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Collapsible } from '$lib/components/ui/collapsible';
  import type { Station } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { Input } from '$lib/components/ui/input';

  const {
    stations = $bindable([]),
    fetchStations,
  }: { stations: Station[]; fetchStations: () => Promise<void> } = $props();

  const deleteStation = async (id: number) => {
    const success = await api.station.delete.mutate(id);
    if (success) {
      toast.success('Station removed');
      await fetchStations();
    } else {
      toast.error('Failed to remove station');
    }
  };

  const onCreate = async () => {
    await fetchStations();
  };

  const filteredStations = $derived(
    stations.filter((station) =>
      station.name.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  let search = $state('');
  const handleSearch = (e: Event) => {
    search = (e.target as HTMLInputElement).value;
  };
</script>

<Collapsible
  title="Custom Stations"
  subtitle="Add stations not found in the official list."
>
  <div class="flex flex-col gap-4">
    <div class="flex gap-2 justify-between">
      <Input oninput={handleSearch} class="h-9" placeholder="Search stations" />
      <CreateStation onStationCreate={onCreate} />
    </div>
    <div use:autoAnimate class="flex flex-col gap-4">
      {#each filteredStations as station (station.id)}
        <Card level="2" class="w-full flex items-center justify-between p-3">
          <div class="flex flex-col gap-1">
            <h4 class="leading-4">{station.name}</h4>
            <p class="text-sm text-muted-foreground">
              {station.municipality
                ? `${station.municipality}, `
                : ''}{station.country}
              {#if station.uic}
                <span class="ml-2">UIC</span>
                <b class="text-foreground">{station.uic}</b>
              {/if}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <EditStation {station} />
            <Confirm
              onConfirm={async () => deleteStation(station.id)}
              title="Remove Station"
              description="Are you sure you want to remove this station?"
            >
              {#snippet triggerContent({ props })}
                <Button variant="outline" size="icon" {...props}>
                  <X size="24" />
                </Button>
              {/snippet}
            </Confirm>
          </div>
        </Card>
      {:else}
        <p class="w-full pb-2 text-center text-muted-foreground">
          {#if stations.length}
            No stations found.
          {:else}
            No custom stations added.
          {/if}
        </p>
      {/each}
    </div>
  </div>
</Collapsible>
