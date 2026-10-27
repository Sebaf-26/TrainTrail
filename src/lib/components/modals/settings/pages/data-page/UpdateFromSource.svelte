<script lang="ts">
  import { fly } from 'svelte/transition';

  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '$lib/components/ui/card';
  import { api } from '$lib/trpc';
  import { cn } from '$lib/utils';
  import { Duration } from '$lib/utils/datetime';

  const { fetchStations }: { fetchStations: () => Promise<void> } = $props();

  let checkingForUpdates = $state(false);
  let result: Awaited<
    ReturnType<typeof api.station.updateFromSource.mutate>
  > | null = $state(null);

  const checkForUpdates = async () => {
    checkingForUpdates = true;

    result = await api.station.updateFromSource.mutate();
    await fetchStations();

    checkingForUpdates = false;
  };
</script>

<Card>
  <CardHeader>
    <CardTitle>Station Source</CardTitle>
    <CardDescription>
      By default, TrainTrail uses the <a
        href="https://github.com/trainline-eu/stations"
        target="_blank"
        rel="noreferrer"
        class="underline text-blue-500">trainline-eu/stations</a
      > list as the source for railway station data. If that list is updated, you
      can in turn update the internal data used by TrainTrail here.
    </CardDescription>
  </CardHeader>
  <CardContent>
    {#if !checkingForUpdates && !result}
      <Button onclick={checkForUpdates} variant="outline">
        Check for updates
      </Button>
    {:else}
      <div class="flex flex-col gap-5">
        <div class="flex gap-5">
          <dl class="flex flex-col text-sm">
            <dt class="text-muted-foreground mb-2">Status</dt>
            <dd class="flex items-center gap-2">
              <span
                class={cn('size-[10px] rounded-full', {
                  'bg-yellow-500 animate-ping': checkingForUpdates,
                  'bg-green-500': result,
                })}
              />
              <span class="font-medium">
                {checkingForUpdates ? 'Updating' : 'Success'}
              </span>
            </dd>
          </dl>
          {#if result}
            <dl in:fly={{ x: -10 }} class="flex flex-col text-sm">
              <dt class="text-muted-foreground mb-2">Took</dt>
              <dd class="flex gap-2">
                <span class="font-medium">
                  {Duration.fromSeconds(result.time / 1000).toHuman()}
                </span>
              </dd>
            </dl>
          {/if}
        </div>
        {#if result}
          <div class="flex gap-5">
            <dl class="flex flex-col text-sm">
              <dt class="text-muted-foreground mb-2">Added</dt>
              <dd class="flex gap-2">
                <span class="font-medium font-mono">{result.created}</span>
              </dd>
            </dl>
            <dl class="flex flex-col text-sm">
              <dt class="text-muted-foreground mb-2">Updated</dt>
              <dd class="flex gap-2">
                <span class="font-medium font-mono">{result.updated}</span>
              </dd>
            </dl>
            <dl class="flex flex-col text-sm">
              <dt class="text-muted-foreground mb-2">Deleted</dt>
              <dd class="flex gap-2">
                <span class="font-medium font-mono">{result.removed}</span>
              </dd>
            </dl>
          </div>
        {/if}
      </div>
    {/if}
  </CardContent>
</Card>
