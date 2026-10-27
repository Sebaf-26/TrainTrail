<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import type { journeySchema } from '$lib/zod/journey';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof journeySchema>>;
  } = $props();
  const { form: formData } = form;
</script>

<Form.Field {form} name="trainNumber">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Train Number</Form.Label>
      <Input
        bind:value={$formData.trainNumber}
        oninput={(e) => {
          $formData.trainNumber = e.currentTarget.value
            .replace(/\s/g, '')
            .toUpperCase();
        }}
        {...props}
      />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>
