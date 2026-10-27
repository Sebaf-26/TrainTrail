<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';

  import OperatorPicker from './OperatorPicker.svelte';

  import CreateOperator from '$lib/components/modals/settings/pages/data-page/operator/CreateOperator.svelte';
  import * as Form from '$lib/components/ui/form';
  import type { Operator } from '$lib/db/types';
  import type { journeySchema } from '$lib/zod/journey';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof journeySchema>>;
  } = $props();
  const { form: formData } = form;

  const isAdmin = $derived(
    hasClientPermission(page.data.authorization, 'data.operators.manage'),
  );
  const pickerValue = $derived.by((): Operator | null => {
    const operator = $formData.operator;
    if (!operator || operator.id === null) return null;

    return {
      ...operator,
      id: operator.id,
      iconPath: operator.iconPath ?? null,
      sourceId: operator.sourceId ?? null,
    };
  });

  let createOperator = $state(false);
</script>

<Form.Field {form} name="operator" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Operator</Form.Label>
      <OperatorPicker
        value={pickerValue}
        placeholder="Select operator"
        onchange={(operator) => ($formData.operator = operator)}
        onCreateNew={isAdmin ? () => (createOperator = true) : undefined}
      />
      <input hidden bind:value={$formData.operator} name={props.name} />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

{#if isAdmin}
  <CreateOperator bind:open={createOperator} withoutTrigger />
{/if}
