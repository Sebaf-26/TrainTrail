<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { TrainField, OperatorField } from '$lib/components/form-fields';
  import * as Form from '$lib/components/ui/form';
  import { Input, Textarea } from '$lib/components/ui/input';
  import { Separator } from '$lib/components/ui/separator';
  import type { journeySchema } from '$lib/zod/journey';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof journeySchema>>;
  } = $props();
  const { form: formData } = form;
</script>

<section>
  <Separator class="mt-2 mb-3 max-md:hidden" />
  <div class="grid gap-4">
    <div class="grid grid-cols-[2fr_1fr] gap-2">
      <TrainField {form} />
      <Form.Field {form} name="unitNumber" class="flex flex-col">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Unit number</Form.Label>
            <Input bind:value={$formData.unitNumber} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </div>
    <OperatorField {form} />
    <Form.Field {form} name="note">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Notes</Form.Label>
          <Textarea
            bind:value={$formData.note}
            class="resize-y h-20 min-h-10 max-h-32"
            {...props}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  </div>
</section>
