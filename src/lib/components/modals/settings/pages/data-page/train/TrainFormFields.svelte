<script lang="ts">
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import type { trainSchema } from '$lib/zod/train';

  const { form }: { form: SuperForm<Infer<typeof trainSchema>> } = $props();

  const { form: formData } = form;
</script>

<Form.Field {form} name="name" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Train Name *</Form.Label>
      <Input
        bind:value={$formData.name}
        {...props}
        placeholder="e.g., Frecciarossa 1000, ICE 3, TGV Duplex"
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
        placeholder="e.g., ETR 400, BR 403"
        oninput={(e) => {
          $formData.code = e.currentTarget.value.toUpperCase();
        }}
      />
      <Form.Description>
        An optional short code for this train model. Used for search and when
        importing journeys.
        <HelpTooltip
          text="Examples: ETR 400 for Frecciarossa 1000, BR 403 for ICE 3, etc."
        />
      </Form.Description>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>
