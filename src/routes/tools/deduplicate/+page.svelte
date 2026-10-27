<script lang="ts">
  import {
    createTable,
    FlexRender,
    renderComponent,
    renderSnippet,
    rowSelectionFeature,
    tableFeatures,
  } from '@tanstack/svelte-table';
  import { createRawSnippet } from 'svelte';
  import { toast } from 'svelte-sonner';

  import type { PageProps } from './$types';

  import { invalidateAll } from '$app/navigation';
  import { TimeDisplay } from '$lib/components/display';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Table from '$lib/components/ui/table';
  import { api } from '$lib/trpc';
  import { invalidateJourneyData } from '$lib/trpc/invalidation';
  import { prepareJourneyData } from '$lib/utils';
  import { formatJourneyDate, getPreferences } from '$lib/utils/preferences';

  let { data }: PageProps = $props();
  const prefs = $derived(getPreferences(data.user));
  const journeys = $derived.by(() => prepareJourneyData(data.journeys));

  const table = createTable({
    features: tableFeatures({ rowSelectionFeature }),
    get data() {
      return journeys;
    },
    columns: [
      {
        id: 'select',
        header: ({ table }) =>
          renderComponent(Checkbox, {
            checked: table.getIsAllPageRowsSelected(),
            indeterminate:
              table.getIsSomePageRowsSelected() &&
              !table.getIsAllPageRowsSelected(),
            onCheckedChange: (value) =>
              table.toggleAllPageRowsSelected(!!value),
            'aria-label': 'Select all',
          }),
        cell: ({ row }) =>
          renderComponent(Checkbox, {
            checked: row.getIsSelected(),
            onCheckedChange: (value) => row.toggleSelected(!!value),
            'aria-label': 'Select row',
          }),
      },
      {
        accessorFn: (row) => row.from?.name ?? '',
        header: 'Origin',
      },
      {
        accessorFn: (row) => row.to?.name ?? '',
        header: 'Destination',
      },
      {
        id: 'departure',
        accessorFn: (row) =>
          row.departure?.getTime() ?? row.date?.getTime() ?? 0,
        header: 'Departure',
        cell: ({ row }) => {
          const f = row.original;
          if (f.departure) {
            return renderComponent(TimeDisplay, {
              date: f.departure,
              stationTz: f.from?.tz,
              stationLabel: f.from?.name,
              side: 'top',
            });
          }
          return f.date
            ? formatJourneyDate(f.date, f.datePrecision ?? 'day', prefs)
            : '';
        },
      },
      {
        id: 'arrival',
        accessorFn: (row) => row.arrival?.getTime() ?? 0,
        header: 'Arrival',
        cell: ({ row }) => {
          const f = row.original;
          if (!f.arrival) return '';
          return renderComponent(TimeDisplay, {
            date: f.arrival,
            stationTz: f.to?.tz,
            stationLabel: f.to?.name,
            side: 'top',
          });
        },
      },
      {
        id: 'operator',
        accessorFn: (row) => row.operator,
        header: () => {
          const operatorHeaderSnippet = createRawSnippet(() => ({
            render: () => `<div class="hidden md:block">Operator</div>`,
          }));
          return renderSnippet(operatorHeaderSnippet, '');
        },
        cell: ({ row }) => {
          const amountCellSnippet = createRawSnippet<[string]>(
            (getOperator) => {
              const operator = getOperator();
              return {
                render: () =>
                  `<div class="hidden md:block">${operator ?? ''}</div>`,
              };
            },
          );

          return renderSnippet(amountCellSnippet, row.getValue('operator'));
        },
      },
    ],
  });

  const deleteJourneys = async () => {
    const selectedRows = table
      .getRowModel()
      .rows.filter((row) => row.getIsSelected());
    const journeyIds = selectedRows.map((row) => row.original.id);
    await api.journey.deleteMany.mutate(journeyIds);
    await Promise.all([invalidateAll(), invalidateJourneyData()]);
    toast.success('Journeys deleted.');
  };
</script>

<div class="container h-full flex flex-col items-center justify-center gap-2">
  <h1 class="text-2xl font-medium">Remove Duplicates</h1>
  <p class="text-sm text-muted-foreground pb-8">
    All of these already exist in the database, with the same origin,
    destination, and date.
  </p>
  <div class="rounded-md border [&>div]:max-h-[calc(100vh-350px)]">
    <Table.Root>
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
          <Table.Row>
            {#each headerGroup.headers as header (header.id)}
              <Table.Head>
                {#if !header.isPlaceholder}
                  <FlexRender {header} />
                {/if}
              </Table.Head>
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>
      <Table.Body>
        {#each table.getRowModel().rows as row (row.id)}
          <Table.Row data-state={row.getIsSelected() && 'selected'}>
            {#each row.getAllCells() as cell (cell.id)}
              <Table.Cell>
                <FlexRender {cell} />
              </Table.Cell>
            {/each}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={6} class="h-12 text-center">
              No duplicates found.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
  <Button
    onclick={deleteJourneys}
    disabled={!table.getRowModel().rows.some((row) => row.getIsSelected())}
    >Delete Journeys
  </Button>
</div>
