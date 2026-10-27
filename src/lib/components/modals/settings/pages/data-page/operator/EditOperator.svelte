<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import OperatorFormFields from './OperatorFormFields.svelte';

  import IconUploadField from '$lib/components/form-fields/IconUploadField.svelte';
  import { SquarePen } from '@o7/icon/lucide';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import * as Form from '$lib/components/ui/form';
  import { Label } from '$lib/components/ui/label';
  import type { Operator } from '$lib/db/types';
  import { trpc } from '$lib/trpc';
  import { operatorSchema } from '$lib/zod/operator';

  let {
    operator,
    open = $bindable(false),
  }: {
    operator: Operator | null;
    open: boolean;
  } = $props();

  let currentIconPath = $state<string | null>(null);

  const form = superForm(
    defaults<Infer<typeof operatorSchema>>(zod(operatorSchema)),
    {
      dataType: 'json',
      id: 'edit-operator',
      validators: zod(operatorSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.operator.list.utils.invalidate();
            open = false;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { enhance, submitting, tainted } = form;

  // Reset form data when operator changes
  $effect(() => {
    if (operator) {
      form.reset({
        data: {
          id: operator.id,
          name: operator.name,
          code: operator.code,
          iconPath: operator.iconPath,
        },
      });
      currentIconPath = operator.iconPath;
    }
  });

  const handleIconUpload = (path: string) => {
    currentIconPath = path;
    trpc.operator.list.utils.invalidate();
  };

  const handleIconRemove = () => {
    currentIconPath = null;
    trpc.operator.list.utils.invalidate();
  };
</script>

<Modal
  bind:open
  dismissal="form"
  dirty={form.isTainted($tainted)}
  busy={$submitting}
  onDiscard={() => form.reset()}
  class="max-w-lg"
>
  <ModalBreadcrumbHeader
    section="Operators"
    title="Edit operator"
    icon={SquarePen}
  />
  <ModalBody>
    <form
      method="POST"
      action="/api/operator/save/form"
      use:enhance
      class="grid gap-4"
    >
      <OperatorFormFields {form} />
      <div class="space-y-2">
        <Label>Icon</Label>
        <IconUploadField
          {currentIconPath}
          operatorId={operator?.id ?? null}
          onUpload={handleIconUpload}
          onRemove={handleIconRemove}
        />
      </div>
      <Form.Button>Save</Form.Button>
    </form>
  </ModalBody>
</Modal>
