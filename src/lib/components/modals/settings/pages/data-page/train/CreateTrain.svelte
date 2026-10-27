<script lang="ts">
  import { Plus } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import TrainFormFields from './TrainFormFields.svelte';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import { trpc } from '$lib/trpc';
  import {
    trainSearchCache,
    clearTrainLookupCaches,
  } from '$lib/utils/data/train';
  import { trainSchema } from '$lib/zod/train';

  let { open = $bindable(false), withoutTrigger = false } = $props();

  const form = superForm(
    defaults<Infer<typeof trainSchema>>(zod(trainSchema)),
    {
      dataType: 'json',
      validators: zod(trainSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.train.list.utils.invalidate();
            trainSearchCache.clear();
            clearTrainLookupCaches();
            open = false;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { enhance, submitting, tainted } = form;
</script>

{#if !withoutTrigger}
  <Button variant="outline" onclick={() => (open = true)}>
    <Plus size={16} class="shrink-0" />
    Create
  </Button>
{/if}

<Modal
  bind:open
  dismissal="form"
  dirty={form.isTainted($tainted)}
  busy={$submitting}
  onDiscard={() => form.reset()}
>
  <ModalBreadcrumbHeader section="Train" title="Add train" icon={Plus} />
  <ModalBody>
    <form
      method="POST"
      action="/api/train/save/form"
      class="grid gap-4"
      use:enhance
    >
      <TrainFormFields {form} />
      <Form.Button>Create</Form.Button>
    </form>
  </ModalBody>
</Modal>
