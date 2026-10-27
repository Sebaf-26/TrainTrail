<script lang="ts">
  import { differenceInSeconds } from 'date-fns';
  import type { SuperForm } from 'sveltekit-superforms';

  import JourneyInformation from './JourneyInformation.svelte';
  import TrainNumber from './TrainNumber.svelte';
  import JourneyTimetable from './JourneyTimetable.svelte';
  import PassengerInformation from './PassengerInformation.svelte';

  import { confirmation } from '$lib/components/helpers/confirm';
  import { StationField, DateTimeField } from '$lib/components/form-fields';
  import { mergeTimeWithDate } from '$lib/utils/datetime';
  import type { JourneyFormData } from '$lib/zod/journey';
  import type { CustomFieldDefinition } from '$lib/utils/custom-fields';

  let {
    form,
    passengerCustomFieldDefinitions = [],
    passengerSavedFieldIds = {},
    passengerCustomFieldsLoading = false,
  }: {
    form: SuperForm<JourneyFormData>;
    passengerCustomFieldDefinitions?: CustomFieldDefinition[];
    passengerSavedFieldIds?: Record<number, Set<number>>;
    passengerCustomFieldsLoading?: boolean;
  } = $props();
  let passengerInformation = $state<ReturnType<typeof PassengerInformation>>();

  export function validatePassengerCustomFields(): boolean {
    return passengerInformation?.validateCustomFields() ?? true;
  }

  const { form: formData, errors } = form;
  type TimetableTab = 'scheduled' | 'actual';

  const MAX_DURATION_SECONDS = 24 * 60 * 60;

  const timetableDateFields = [
    'departureScheduled',
    'arrivalScheduled',
  ] as const;

  const timetableTimeFields = [
    'departureScheduledTime',
    'arrivalScheduledTime',
  ] as const;

  const scheduledTimetableFields = [
    'departureScheduled',
    'departureScheduledTime',
    'arrivalScheduled',
    'arrivalScheduledTime',
  ] as const;

  const actualTimetableFields = [
    'departure',
    'departureTime',
    'arrival',
    'arrivalTime',
  ] as const;

  const clearedByPartialDateFields = [
    'arrival',
    'departureTime',
    'arrivalTime',
    ...timetableDateFields,
    ...timetableTimeFields,
  ] as const;

  const hasTimetableData = $derived.by(() => {
    return (
      timetableDateFields.some((field) => !!$formData[field]) ||
      timetableTimeFields.some((field) => !!$formData[field])
    );
  });

  const hasClearableDateTimeData = $derived.by(() => {
    return clearedByPartialDateFields.some((field) => !!$formData[field]);
  });

  let showTimetable = $state(false);
  let partialDateMode = $state($formData.datePrecision !== 'day');
  let prevHasTimetableData = $state(false);
  let preferredMobileTab = $state<TimetableTab>('actual');
  let preferredMobileTabVersion = $state(0);
  let revealedTimetableError = $state('');

  const hasError = (field: keyof JourneyFormData) => !!$errors[field];

  const timetableErrorTab = $derived.by<TimetableTab | null>(() => {
    if ($formData.datePrecision !== 'day') return null;

    const hasScheduledErrors = scheduledTimetableFields.some(hasError);
    if (hasScheduledErrors) return 'scheduled';

    const hasActualErrors = actualTimetableFields.some(hasError);
    if (hasActualErrors && (showTimetable || hasTimetableData)) {
      return 'actual';
    }

    return null;
  });

  const timetableErrorSignature = $derived.by(() => {
    return [...scheduledTimetableFields, ...actualTimetableFields]
      .flatMap((field) =>
        ($errors[field] ?? []).map((message) => `${field}:${message}`),
      )
      .join('|');
  });

  $effect(() => {
    if (!timetableErrorTab) {
      revealedTimetableError = '';
      return;
    }

    if (timetableErrorSignature === revealedTimetableError) return;
    revealedTimetableError = timetableErrorSignature;
    showTimetable = true;
    partialDateMode = false;
    preferredMobileTab = timetableErrorTab;
    preferredMobileTabVersion += 1;
  });

  const clearDetailedTimetable = () => {
    formData.update((current) => ({
      ...current,
      arrival: null,
      departureTime: null,
      arrivalTime: null,
      departureScheduled: null,
      departureScheduledTime: null,
      arrivalScheduled: null,
      arrivalScheduledTime: null,
    }));
  };

  const toPartialDepartureAnchor = (departure: string | null) => {
    if (!departure) return null;

    const [year, month] = departure.slice(0, 10).split('-');
    if (!year || !month) return null;

    return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toISOString();
  };

  const enablePartialDateMode = async () => {
    if (
      hasClearableDateTimeData &&
      !(await confirmation.show({
        title: 'Switch to partial date?',
        description:
          'This will clear the arrival date, current times, and detailed timetable.',
        confirmText: 'Switch',
        cancelText: 'Cancel',
      }))
    ) {
      return;
    }

    partialDateMode = true;
    showTimetable = false;
    formData.update((current) => ({
      ...current,
      datePrecision: current.departure ? 'month' : 'year',
      departure: current.departure
        ? toPartialDepartureAnchor(current.departure)
        : current.departure,
    }));
    clearDetailedTimetable();
  };

  const disablePartialDateMode = () => {
    partialDateMode = false;
    formData.update((current) => ({
      ...current,
      datePrecision: 'day',
    }));
  };

  // Auto-open timetable when data is populated
  $effect(() => {
    if (hasTimetableData && !prevHasTimetableData) {
      showTimetable = true;
    }
    prevHasTimetableData = hasTimetableData;
  });

  const durationWarning = $derived.by(() => {
    const { departure, departureTime, arrival, arrivalTime, from, to } =
      $formData;
    if (
      !departure ||
      !departureTime ||
      !arrival ||
      !arrivalTime ||
      !from ||
      !to
    ) {
      return null;
    }

    try {
      const dep = mergeTimeWithDate(departure, departureTime, from.tz);
      const arr = mergeTimeWithDate(arrival, arrivalTime, to.tz);
      const duration = differenceInSeconds(arr, dep);

      if (duration > MAX_DURATION_SECONDS) {
        return 'Journey duration exceeds 24 hours';
      }
    } catch {
      return null;
    }

    return null;
  });
</script>

<div
  class="grid w-full gap-y-4 max-md:overflow-auto md:grid-cols-[3fr_2fr] max-md:max-h-[calc(100dvh-200px)] max-md:min-h-[min(566px,_calc(100dvh-200px))]"
>
  <!-- First column: uses contents on mobile to flatten, block on desktop to group -->
  <div
    class="contents md:flex md:min-h-[min(566px,_calc(100dvh-200px))] md:max-h-[calc(100dvh-200px)] md:flex-col md:gap-4 md:overflow-auto md:scrollbar-hide md:px-6 md:py-4"
  >
    <div class="order-1 px-6 md:order-none md:px-0">
      <div class="flex flex-col gap-4 py-4 md:py-0">
        <TrainNumber {form} />
        <StationField field="from" {form} />
        <StationField field="to" {form} />
        {#if showTimetable && !partialDateMode}
          <JourneyTimetable
            {form}
            {preferredMobileTab}
            {preferredMobileTabVersion}
          />
          <button
            type="button"
            class="text-xs text-muted-foreground transition hover:text-foreground text-left"
            onclick={() => (showTimetable = false)}
          >
            Use simple departure/arrival inputs
          </button>
        {:else}
          <DateTimeField
            field="departure"
            {form}
            {partialDateMode}
            onEnablePartialDateMode={enablePartialDateMode}
          />
          {#if !partialDateMode}
            <DateTimeField field="arrival" {form} {partialDateMode} />
          {/if}
          {#if partialDateMode}
            <button
              type="button"
              class="text-xs text-muted-foreground transition hover:text-foreground text-left"
              onclick={disablePartialDateMode}
            >
              Use full departure/arrival datetimes
            </button>
          {:else}
            <button
              type="button"
              class="text-xs text-muted-foreground transition hover:text-foreground text-left"
              onclick={() => (showTimetable = true)}
            >
              Add detailed timetable (scheduled and actual times...)
            </button>
          {/if}
        {/if}
        {#if durationWarning}
          <p class="text-yellow-500 text-sm font-medium">
            {durationWarning}
          </p>
        {/if}
      </div>
    </div>
    <div class="order-3 px-6 md:order-none md:px-0">
      <div class="flex flex-col gap-4 py-4 md:py-0">
        <JourneyInformation {form} />
      </div>
    </div>
  </div>
  <div
    class="order-2 scrollbar-hide px-6 md:order-none md:max-h-[calc(100dvh-200px)] md:min-h-[min(566px,_calc(100dvh-200px))] md:overflow-auto md:pl-0"
  >
    <div class="relative">
      <div
        class="absolute inset-0 rounded-xl border bg-neutral-50 dark:bg-input/30 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      ></div>
      <div class="relative px-4 py-3">
        <PassengerInformation
          bind:this={passengerInformation}
          {form}
          customFieldDefinitions={passengerCustomFieldDefinitions}
          savedFieldIds={passengerSavedFieldIds}
          customFieldsLoading={passengerCustomFieldsLoading}
        />
      </div>
    </div>
  </div>
</div>
