<script lang="ts">
  import type { TZDate } from '@date-fns/tz';
  import { differenceInSeconds } from 'date-fns';
  import type { SuperForm } from 'sveltekit-superforms';

  import TimetableDateTimeCell from './TimetableDateTimeCell.svelte';

  import { Label } from '$lib/components/ui/label';
  import * as Tabs from '$lib/components/ui/tabs';
  import { Duration, mergeTimeWithDate } from '$lib/utils/datetime';
  import type { JourneyFormData } from '$lib/zod/journey';

  let {
    form,
    preferredMobileTab = 'actual',
    preferredMobileTabVersion = 0,
  }: {
    form: SuperForm<JourneyFormData>;
    preferredMobileTab?: 'scheduled' | 'actual';
    preferredMobileTabVersion?: number;
  } = $props();

  const { form: formData } = form;
  const formValues = $derived.by(() => $formData);

  let mobileTab: 'scheduled' | 'actual' = $state('actual');
  let appliedPreferenceVersion = $state(0);
  $effect(() => {
    if (preferredMobileTabVersion > appliedPreferenceVersion) {
      mobileTab = preferredMobileTab;
      appliedPreferenceVersion = preferredMobileTabVersion;
    }
  });

  const fallbackTimezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  const getDateTime = (
    date: string | null,
    time: string | null,
    tzId?: string | null,
  ) => {
    if (!date || !time) return null;
    const timezone = tzId ?? fallbackTimezone;
    try {
      return mergeTimeWithDate(date, time, timezone);
    } catch {
      return null;
    }
  };

  const calcDuration = (start: TZDate | null, end: TZDate | null) => {
    if (!start || !end) return null;
    const seconds = differenceInSeconds(end, start);
    return seconds >= 0 ? seconds : null;
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return '—';
    return Duration.fromSeconds(seconds).toString();
  };

  const departureActual = $derived.by(() =>
    getDateTime(
      formValues.departure,
      formValues.departureTime,
      formValues.from?.tz,
    ),
  );
  const departureScheduled = $derived.by(() =>
    getDateTime(
      formValues.departureScheduled,
      formValues.departureScheduledTime,
      formValues.from?.tz,
    ),
  );
  const arrivalActual = $derived.by(() =>
    getDateTime(formValues.arrival, formValues.arrivalTime, formValues.to?.tz),
  );
  const arrivalScheduled = $derived.by(() =>
    getDateTime(
      formValues.arrivalScheduled,
      formValues.arrivalScheduledTime,
      formValues.to?.tz,
    ),
  );

  const totalTimeScheduled = $derived.by(() =>
    calcDuration(departureScheduled, arrivalScheduled),
  );
  const totalTimeActual = $derived.by(() =>
    calcDuration(departureActual, arrivalActual),
  );
</script>

<!-- Desktop layout (md+) -->
<div class="hidden md:block rounded-xl bg-card/70 py-4">
  <div class="space-y-1">
    <div
      class="grid grid-cols-[1.2fr_1fr_1fr] gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
    >
      <div></div>
      <div>Scheduled</div>
      <div>Actual</div>
    </div>
    <div class="space-y-1">
      <div class="grid grid-cols-[1.2fr_1fr_1fr] items-start gap-3">
        <div class="flex h-8 items-center">
          <Label>Departure</Label>
        </div>
        <TimetableDateTimeCell
          {form}
          label="Departure"
          dateField="departureScheduled"
          timeField="departureScheduledTime"
          timezone={$formData.from?.tz}
          baseDateTime={departureScheduled}
          defaultDate={$formData.departure}
          defaultTime={$formData.departureTime}
        />
        <TimetableDateTimeCell
          {form}
          label="Departure"
          dateField="departure"
          timeField="departureTime"
          timezone={$formData.from?.tz}
          baseDateTime={departureActual}
          compareDateTime={departureScheduled}
          defaultDate={$formData.departureScheduled}
          defaultTime={$formData.departureScheduledTime}
        />
      </div>
      <div class="grid grid-cols-[1.2fr_1fr_1fr] items-start gap-3">
        <div class="flex h-8 items-center">
          <Label>Arrival</Label>
        </div>
        <TimetableDateTimeCell
          {form}
          label="Arrival"
          dateField="arrivalScheduled"
          timeField="arrivalScheduledTime"
          timezone={$formData.to?.tz}
          baseDateTime={departureScheduled}
          defaultDate={$formData.arrival}
          defaultTime={$formData.arrivalTime}
        />
        <TimetableDateTimeCell
          {form}
          label="Arrival"
          dateField="arrival"
          timeField="arrivalTime"
          timezone={$formData.to?.tz}
          baseDateTime={departureActual}
          compareDateTime={arrivalScheduled}
          defaultDate={$formData.arrivalScheduled}
          defaultTime={$formData.arrivalScheduledTime}
        />
      </div>
      <div
        class="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-3 mt-3 pt-3 border-t border-border/60"
      >
        <div class="flex h-8 items-center">
          <Label class="text-muted-foreground">Total time</Label>
        </div>
        <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
          {formatDuration(totalTimeScheduled)}
        </div>
        <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
          {formatDuration(totalTimeActual)}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Mobile layout (below md) - tabbed -->
<div class="md:hidden rounded-xl bg-card/70 py-4">
  <!-- Tab switcher -->
  <Tabs.Root bind:value={mobileTab} class="w-full mb-3">
    <Tabs.List class="w-full">
      <Tabs.Trigger value="scheduled">Scheduled</Tabs.Trigger>
      <Tabs.Trigger value="actual">Actual</Tabs.Trigger>
    </Tabs.List>
  </Tabs.Root>

  <div class="space-y-1">
    <!-- Departure -->
    <div class="grid grid-cols-[1fr_1fr] items-start gap-3">
      <div class="flex h-8 items-center">
        <Label>Departure</Label>
      </div>
      {#if mobileTab === 'scheduled'}
        <TimetableDateTimeCell
          {form}
          label="Departure"
          dateField="departureScheduled"
          timeField="departureScheduledTime"
          timezone={$formData.from?.tz}
          baseDateTime={departureScheduled}
          defaultDate={$formData.departure}
          defaultTime={$formData.departureTime}
        />
      {:else}
        <TimetableDateTimeCell
          {form}
          label="Departure"
          dateField="departure"
          timeField="departureTime"
          timezone={$formData.from?.tz}
          baseDateTime={departureActual}
          compareDateTime={departureScheduled}
          defaultDate={$formData.departureScheduled}
          defaultTime={$formData.departureScheduledTime}
        />
      {/if}
    </div>

    <!-- Arrival -->
    <div class="grid grid-cols-[1fr_1fr] items-start gap-3">
      <div class="flex h-8 items-center">
        <Label>Arrival</Label>
      </div>
      {#if mobileTab === 'scheduled'}
        <TimetableDateTimeCell
          {form}
          label="Arrival"
          dateField="arrivalScheduled"
          timeField="arrivalScheduledTime"
          timezone={$formData.to?.tz}
          baseDateTime={departureScheduled}
          defaultDate={$formData.arrival}
          defaultTime={$formData.arrivalTime}
        />
      {:else}
        <TimetableDateTimeCell
          {form}
          label="Arrival"
          dateField="arrival"
          timeField="arrivalTime"
          timezone={$formData.to?.tz}
          baseDateTime={departureActual}
          compareDateTime={arrivalScheduled}
          defaultDate={$formData.arrivalScheduled}
          defaultTime={$formData.arrivalScheduledTime}
        />
      {/if}
    </div>

    <!-- Total time -->
    <div
      class="grid grid-cols-[1fr_1fr] items-center gap-3 mt-3 pt-3 border-t border-border/60"
    >
      <div class="flex h-8 items-center">
        <Label class="text-muted-foreground">Total time</Label>
      </div>
      <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
        {formatDuration(
          mobileTab === 'scheduled' ? totalTimeScheduled : totalTimeActual,
        )}
      </div>
    </div>
  </div>
</div>
