<script lang="ts">
  import {
    CorporateFare,
    DirectionsRailway,
    DirectionsTransit,
    LocationOn,
  } from '@o7/icon/material/solid';

  import { PageHeader } from '../';

  import Train from './train/Train.svelte';
  import Operator from './operator/Operator.svelte';
  import CustomStations from './station/CustomStations.svelte';
  import StatCard from './StatCard.svelte';
  import UpdateFromSource from './UpdateFromSource.svelte';

  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';
  import { Card } from '$lib/components/ui/card';
  import { CardContent } from '$lib/components/ui/card/index.js';
  import type { Station } from '$lib/db/types';
  import { api, trpc } from '$lib/trpc';

  let numStations: number | null = $state(null);
  let customStations: Station[] = $state([]);

  const trainResult = trpc.train.list.query();
  let train = $derived.by(() => $trainResult.data || []);

  const operatorsResult = trpc.operator.list.query();
  let operators = $derived.by(() => $operatorsResult.data || []);

  const fetchStations = async () => {
    const stationData = await api.station.getData.query();
    numStations = stationData.numStations;
    customStations = stationData.customStations;
  };

  $effect(() => {
    fetchStations();
  });
</script>

<PageHeader
  title="Data"
  subtitle="Manage custom stations, operators and trains."
>
  <div class="flex flex-col gap-4">
    <Card>
      <CardContent>
        <div class="flex flex-col">
          <StatCard title="Stations" value={numStations}>
            {#snippet icon()}
              <DirectionsTransit class="text-primary" />
            {/snippet}
          </StatCard>
          <StatCard title="Custom Stations" value={customStations.length}>
            {#snippet icon()}
              <LocationOn class="text-primary" />
            {/snippet}
          </StatCard>
          <StatCard title="Trains" value={train.length}>
            {#snippet icon()}
              <DirectionsRailway class="text-primary" />
            {/snippet}
          </StatCard>
          <StatCard title="Operators" value={operators.length}>
            {#snippet icon()}
              <CorporateFare class="text-primary" />
            {/snippet}
          </StatCard>
        </div>
      </CardContent>
    </Card>

    {#if hasClientPermission(page.data.authorization, 'data.stations.manage')}
      <UpdateFromSource {fetchStations} />
    {/if}
    {#if hasClientPermission(page.data.authorization, 'data.stations.manage')}
      <CustomStations bind:stations={customStations} {fetchStations} />
    {/if}
    {#if hasClientPermission(page.data.authorization, 'data.trains.manage')}
      <Train {train} />
    {/if}
    {#if hasClientPermission(page.data.authorization, 'data.operators.manage')}
      <Operator {operators} />
    {/if}
  </div>
</PageHeader>
