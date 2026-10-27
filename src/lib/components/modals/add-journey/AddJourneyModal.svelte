<script lang="ts">
  import { Globe } from '@o7/icon';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';
  import {
    JourneyCustomFieldsModal,
    JourneyForm,
    JourneyPlatformModal,
    JourneyTrackModal,
  } from '$lib/components/modals/journey-form';
  import * as Form from '$lib/components/ui/form';
  import {
    Modal,
    ModalBreadcrumbHeader,
    ModalFooter,
  } from '$lib/components/ui/modal';
  import { journeyAddedState, openModalsState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { invalidateJourneyData } from '$lib/trpc/invalidation';
  import { journeyFormSchema } from '$lib/zod/journey';

  let { open = $bindable() }: { open: boolean } = $props();

  const customFieldDefinitions = trpc.customField.listDefinitions.query({
    entityType: 'journey',
  });
  const passengerCustomFieldDefinitions =
    trpc.customField.listDefinitions.query({
      entityType: 'journey_passenger',
    });
  let customFieldValues = $state<Record<number, unknown>>({});
  let customFieldsDirty = $state(false);
  let customFieldsModal = $state<ReturnType<typeof JourneyCustomFieldsModal>>();
  let journeyForm = $state<ReturnType<typeof JourneyForm>>();

  const toCustomFieldsPayload = (): Record<string, unknown> => {
    const defs = $customFieldDefinitions.data ?? [];
    const keyById = new Map(defs.map((d) => [d.id, d.key]));
    const payload: Record<string, unknown> = {};

    for (const [id, value] of Object.entries(customFieldValues)) {
      const key = keyById.get(Number(id));
      if (key) {
        payload[key] = value;
      }
    }

    return payload;
  };

  const form = superForm(
    defaults<Infer<typeof journeyFormSchema>>(zod(journeyFormSchema)),
    {
      dataType: 'json',
      validators: zod(journeyFormSchema),
      onSubmit({ cancel }) {
        $formData.customFields = toCustomFieldsPayload();
        const journeyFieldsValid = customFieldsModal?.validate() ?? true;
        const passengerFieldsValid =
          journeyForm?.validatePassengerCustomFields() ?? true;
        if (!journeyFieldsValid || !passengerFieldsValid) {
          cancel();
        }
      },
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            void invalidateJourneyData();
            open = false;
            customFieldValues = {};
            customFieldsDirty = false;
            journeyAddedState.added = true;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance, submitting, tainted } = form;

  $effect(() => {
    const userId = page.data.user?.id;
    if (
      userId &&
      $formData.passengers[0] &&
      $formData.passengers[0].userId === '<USER_ID>'
    ) {
      formData.update(
        (current) => ({
          ...current,
          passengers: current.passengers.map((passenger, index) =>
            index === 0 ? { ...passenger, userId } : passenger,
          ),
        }),
        { taint: 'untaint' },
      );
    }
  });
</script>

<Modal
  bind:open
  dismissal="form"
  dirty={form.isTainted($tainted) || customFieldsDirty}
  busy={$submitting}
  onDiscard={() => {
    form.reset();
    customFieldValues = {};
    customFieldsDirty = false;
  }}
  class="max-w-screen-lg"
>
  <ModalBreadcrumbHeader section="Journeys" title="New journey" icon={Globe} />
  <form method="POST" action="/api/journey/save/form" use:enhance>
    <JourneyForm
      bind:this={journeyForm}
      {form}
      passengerCustomFieldDefinitions={$passengerCustomFieldDefinitions.data ??
        []}
    />
    <ModalFooter>
      <div class="flex w-full items-center justify-between">
        <div class="flex items-center gap-2">
          <JourneyPlatformModal {form} />
          <JourneyTrackModal {form} />
          <JourneyCustomFieldsModal
            bind:this={customFieldsModal}
            definitions={$customFieldDefinitions.data ?? []}
            bind:values={customFieldValues}
            bind:dirty={customFieldsDirty}
            onOpenSettings={hasClientPermission(
              page.data.authorization,
              'custom_fields.manage',
            )
              ? () => {
                  open = false;
                  // Wait for both popstates (custom fields modal + this modal)
                  // to settle before opening settings.
                  let remaining = 2;
                  const onPopstate = () => {
                    if (--remaining === 0) {
                      window.removeEventListener('popstate', onPopstate);
                      openModalsState.settingsTab = 'custom-fields';
                      openModalsState.settings = true;
                    }
                  };
                  window.addEventListener('popstate', onPopstate);
                }
              : undefined}
          />
        </div>
        <Form.Button size="sm" loading={$submitting}>Add journey</Form.Button>
      </div>
    </ModalFooter>
  </form>
</Modal>
