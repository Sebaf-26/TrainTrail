<script lang="ts">
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import type { operatorSchema } from '$lib/zod/operator';

  const { form }: { form: SuperForm<Infer<typeof operatorSchema>> } = $props();

  const { form: formData } = form;
</script>

<Form.Field {form} name="name" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Operator Name *</Form.Label>
      <Input
        bind:value={$formData.name}
        {...props}
        placeholder="e.g., Trenitalia, SNCF Voyageurs, Deutsche Bahn"
      />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<Form.Field {form} name="code" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Code</Form.Label>
      <Input
        bind:value={$formData.code}
        {...props}
        placeholder="e.g., SNCF, DB, CFL"
        oninput={(e) => {
          $formData.code = e.currentTarget.value.toUpperCase();
        }}
      />
      <Form.Description>
        An optional short label for the operator. Used for display, search and
        when importing journeys.
        <HelpTooltip
          text="Examples: SNCF for SNCF Voyageurs, DB for Deutsche Bahn, CFL for CFL, etc."
        />
      </Form.Description>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>
