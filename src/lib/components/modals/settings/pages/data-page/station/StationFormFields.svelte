<script lang="ts">
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import LocationField from './LocationField.svelte';
  import TimezoneField from './TimezoneField.svelte';

  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import type { stationSchema } from '$lib/zod/station';

  const { form }: { form: SuperForm<Infer<typeof stationSchema>> } = $props();

  const { form: formData } = form;
</script>

<Form.Field {form} name="name" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Name *</Form.Label>
      <Input
        bind:value={$formData.name}
        {...props}
        placeholder="e.g. Milano Centrale"
      />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<Form.Field {form} name="municipality" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Municipality</Form.Label>
      <Input
        bind:value={$formData.municipality}
        {...props}
        placeholder="e.g. Milano"
      />
      <Form.Description>
        The city or town the station serves. Used for search.
      </Form.Description>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<Form.Field {form} name="uic" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>UIC code</Form.Label>
      <Input
        bind:value={$formData.uic}
        {...props}
        placeholder="e.g. 8727100"
        inputmode="numeric"
      />
      <Form.Description>
        The optional UIC station code. <HelpTooltip
          text="The International Union of Railways (UIC) assigns a 7-digit code to most European stations. It is only used for reference."
        />
      </Form.Description>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<LocationField {form} />
<TimezoneField {form} />
