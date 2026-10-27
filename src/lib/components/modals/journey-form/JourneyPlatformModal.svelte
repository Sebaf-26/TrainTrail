<script lang="ts">
  import { TrainTrack } from '@o7/icon/lucide';
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';
  import { isSmallScreen } from '$lib/utils/size';
  import type { journeySchema } from '$lib/zod/journey';

  let {
    form,
  }: {
    form: SuperForm<Infer<typeof journeySchema>>;
  } = $props();

  const { form: formData } = form;

  let open = $state(false);
  let formSnapshot = $state.raw<ReturnType<typeof form.capture> | null>(null);

  const fields = [
    {
      name: 'departurePlatform',
      label: 'Departure platform',
      placeholder: 'e.g. 7',
    },
    {
      name: 'arrivalPlatform',
      label: 'Arrival platform',
      placeholder: 'e.g. 12 Ovest',
    },
  ] as const;

  const hasData = $derived(
    !!$formData.departurePlatform || !!$formData.arrivalPlatform,
  );
</script>

<Button
  size={$isSmallScreen ? 'sm' : 'icon-sm'}
  variant="outline"
  class={hasData ? 'border-primary text-primary' : ''}
  aria-label="Platforms"
  title="Platforms"
  onclick={() => {
    formSnapshot = form.capture();
    open = true;
  }}
>
  <TrainTrack size={20} />
  {#if $isSmallScreen}
    Platforms
  {/if}
</Button>

<Modal
  bind:open
  dismissal="form"
  dirty={formSnapshot !== null &&
    ($formData.departurePlatform !== formSnapshot.data.departurePlatform ||
      $formData.arrivalPlatform !== formSnapshot.data.arrivalPlatform)}
  onDiscard={() => {
    if (formSnapshot) form.restore(formSnapshot);
  }}
  class="max-w-md"
>
  <ModalHeader class="pb-0">
    <h2 class="text-lg font-medium">Platforms</h2>
  </ModalHeader>
  <ModalBody>
    <div class="grid gap-3">
      {#each fields as field (field.name)}
        <Form.Field {form} name={field.name} class="flex flex-col">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>{field.label}</Form.Label>
              <Input
                bind:value={$formData[field.name]}
                placeholder={field.placeholder}
                {...props}
              />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      {/each}
    </div>
  </ModalBody>
  <div class="flex justify-end gap-2 px-6 pb-4">
    <Button size="sm" onclick={() => (open = false)}>Done</Button>
  </div>
</Modal>
