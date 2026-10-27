<script lang="ts">
  import { SquarePen } from '@o7/icon/lucide';
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
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import {
    Modal,
    ModalBreadcrumbHeader,
    ModalFooter,
  } from '$lib/components/ui/modal';
  import { openModalsState } from '$lib/state.svelte';
  import { toJourneyTrackInput } from '$lib/track/schema';
  import { api, trpc } from '$lib/trpc';
  import { invalidateJourneyData } from '$lib/trpc/invalidation';
  import { type JourneyData } from '$lib/utils';
  import { decomposeToLocal, isUsingAmPm } from '$lib/utils/datetime';
  import { journeyFormSchema } from '$lib/zod/journey';

  let {
    journey,
    triggerDisabled = false,
    open = $bindable(false),
    showTrigger = true,
  }: {
    journey: JourneyData;
    triggerDisabled?: boolean;
    open?: boolean;
    showTrigger?: boolean;
  } = $props();

  // If preferences resolve to 12-hour time, we display the time in *a* 12-hour
  // format (not necessarily the user's locale, because our time validator
  // doesn't support all languages). 'auto' falls back to system-locale detection.
  const displayLocale = isUsingAmPm(page.data.user?.timeFormat)
    ? 'en-US'
    : 'fr-FR';

  const customFieldDefinitions = trpc.customField.listDefinitions.query({
    entityType: 'journey',
  });
  const passengerCustomFieldDefinitions =
    trpc.customField.listDefinitions.query({
      entityType: 'journey_passenger',
    });
  let customFieldValues = $state<Record<number, unknown>>({});
  let customFieldsDirty = $state(false);
  /** Field IDs that have values saved in the database for this journey. */
  let savedFieldIds = $state<Set<number>>(new Set());
  let customFieldsModal = $state<ReturnType<typeof JourneyCustomFieldsModal>>();
  let journeyForm = $state<ReturnType<typeof JourneyForm>>();
  let passengerSavedFieldIds = $state<Record<number, Set<number>>>({});
  let passengerCustomFieldsLoading = $state(false);

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

  $effect(() => {
    if (!open) return;

    let cancelled = false;
    passengerCustomFieldsLoading = true;

    (async () => {
      try {
        const values = await api.customField.getEntityValues.query({
          entityType: 'journey',
          entityId: String(journey.id),
        });
        if (cancelled) return;
        customFieldValues = Object.fromEntries(
          values.map((v) => [v.fieldId, v.value]),
        );
        customFieldsDirty = false;
        savedFieldIds = new Set(values.map((v) => v.fieldId));
        const passengerValues = await Promise.all(
          journey.raw.passengers.map(async (passenger) => ({
            id: passenger.id,
            values: await api.customField.getEntityValues.query({
              entityType: 'journey_passenger',
              entityId: String(passenger.id),
            }),
          })),
        );
        if (cancelled) return;
        const valuesByPassenger = new Map(
          passengerValues.map(({ id, values }) => [id, values]),
        );
        passengerSavedFieldIds = Object.fromEntries(
          passengerValues.map(({ id, values }) => [
            id,
            new Set(values.map((value) => value.fieldId)),
          ]),
        );
        formData.update(
          (current) => ({
            ...current,
            passengers: current.passengers.map((passenger) => ({
              ...passenger,
              customFields: Object.fromEntries(
                (passenger.id
                  ? valuesByPassenger.get(passenger.id)
                  : undefined
                )?.map((value) => [value.fieldId, value.value]) ?? [],
              ),
            })),
          }),
          { taint: 'untaint' },
        );
        const track = await api.journeyTrack.get.query(journey.id);
        if (cancelled) return;
        formData.update(
          (current) => ({
            ...current,
            track: track ? toJourneyTrackInput(track) : undefined,
          }),
          { taint: 'untaint' },
        );
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) passengerCustomFieldsLoading = false;
      }
    })();

    return () => {
      cancelled = true;
      passengerCustomFieldsLoading = false;
    };
  });

  const fromTz = journey.from?.tz ?? 'UTC';
  const toTz = journey.to?.tz ?? 'UTC';
  const isPartialDate = journey.raw.datePrecision !== 'day';
  const toFormDateAnchor = (value: string | null) => {
    return value
      ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`).toISOString()
      : null;
  };

  const dep = isPartialDate
    ? { date: null, time: null }
    : decomposeToLocal(journey.raw.departure, fromTz, displayLocale);
  const arr = isPartialDate
    ? { date: null, time: null }
    : decomposeToLocal(journey.raw.arrival, toTz, displayLocale);
  const depSched = decomposeToLocal(
    journey.raw.departureScheduled,
    fromTz,
    displayLocale,
  );
  const arrSched = decomposeToLocal(
    journey.raw.arrivalScheduled,
    toTz,
    displayLocale,
  );

  const schemaJourney = {
    ...(journey.raw as unknown as Omit<
      typeof journey.raw,
      'id' | 'userId' | 'date' | 'duration'
    >),
    passengers: journey.raw.passengers.map((passenger) => ({
      ...passenger,
      customFields: {},
    })),
    from: journey.from ?? undefined,
    to: journey.to ?? undefined,
    customFields: {},
    departure: isPartialDate
      ? toFormDateAnchor(journey.raw.date)
      : (dep.date ?? toFormDateAnchor(journey.raw.date)),
    arrival: isPartialDate ? null : arr.date,
    departureScheduled: depSched.date,
    arrivalScheduled: arrSched.date,
    departureTime: dep.time,
    arrivalTime: arr.time,
    departureScheduledTime: depSched.time,
    arrivalScheduledTime: arrSched.time,
  };

  const form = superForm(
    defaults<Infer<typeof journeyFormSchema>>(
      schemaJourney,
      zod(journeyFormSchema),
    ),
    {
      dataType: 'json',
      id: Math.random().toString(36).substring(7),
      validators: zod(journeyFormSchema),
      onSubmit({ cancel }) {
        $formData.id = journey.id;
        $formData.customFields = toCustomFieldsPayload();
        const journeyFieldsValid = customFieldsModal?.validate() ?? true;
        const passengerFieldsValid =
          journeyForm?.validatePassengerCustomFields() ?? true;
        if (!journeyFieldsValid || !passengerFieldsValid) {
          cancel();
        }
      },
      onUpdate({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            void invalidateJourneyData();
            toast.success(form.message.text);
            open = false;
            customFieldsDirty = false;
            return;
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance, submitting, tainted } = form;
</script>

{#if showTrigger}
  <Button
    variant="outline"
    size="icon"
    onclick={() => (open = true)}
    disabled={triggerDisabled}
    data-testid="edit-journey-button"
  >
    <SquarePen size={16} />
  </Button>
{/if}

<Modal
  bind:open
  dismissal="form"
  dirty={form.isTainted($tainted) || customFieldsDirty}
  busy={$submitting || passengerCustomFieldsLoading}
  onDiscard={() => {
    form.reset();
    customFieldValues = {};
    customFieldsDirty = false;
  }}
  class="max-w-screen-lg"
>
  <ModalBreadcrumbHeader
    section="Journeys"
    title="Edit journey"
    icon={SquarePen}
  />
  <form method="POST" action="/api/journey/save/form" use:enhance>
    <JourneyForm
      bind:this={journeyForm}
      {form}
      passengerCustomFieldDefinitions={$passengerCustomFieldDefinitions.data ??
        []}
      {passengerSavedFieldIds}
      {passengerCustomFieldsLoading}
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
            {savedFieldIds}
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
        <Form.Button size="sm" loading={$submitting}>Save</Form.Button>
      </div>
    </ModalFooter>
  </form>
</Modal>
