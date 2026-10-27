<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';

  import StationPicker from './StationPicker.svelte';

  import CreateStation from '$lib/components/modals/settings/pages/data-page/station/CreateStation.svelte';
  import * as Form from '$lib/components/ui/form';
  import { toTitleCase } from '$lib/utils';
  import type { journeySchema } from '$lib/zod/journey';

  let {
    field,
    form,
  }: {
    field: 'from' | 'to';
    form: SuperForm<z.infer<typeof journeySchema>>;
  } = $props();
  const { form: formData } = form;

  const isAdmin = $derived(
    hasClientPermission(page.data.authorization, 'data.stations.manage'),
  );

  let createStation = $state(false);
</script>

<Form.Field {form} name={field} class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>{toTitleCase(field)} *</Form.Label>
      <StationPicker
        bind:value={$formData[field]}
        placeholder="Choose a station"
        invalid={!!props['aria-invalid']}
        onCreateNew={isAdmin ? () => (createStation = true) : undefined}
      />
      <input hidden bind:value={$formData[field]} name={props.name} />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

{#if isAdmin}
  <CreateStation bind:open={createStation} withoutTrigger />
{/if}
