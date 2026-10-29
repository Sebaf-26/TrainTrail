<script lang="ts">
  import { List } from '@o7/icon/lucide';

  import {
    journeyReasonLabel,
    platformLabel,
    seatClassLabel,
    seatTypeLabel,
  } from '$lib/utils/journey-labels';
  import { Button } from '$lib/components/ui/button';
  import { formatTrain } from '$lib/utils/data/train';
  import {
    formatSeatForUser,
    getJourneyPassengerLabel,
    type JourneyData,
  } from '$lib/utils';
  import type { JourneyPassenger } from '$lib/db/types';
  import { Duration } from '$lib/utils/datetime';
  import { convertDistance, distanceUnitLabel } from '$lib/utils/preferences';
  import type { Preferences } from '$lib/zod/user';

  import JourneyTicket from './JourneyTicket.svelte';

  let {
    journey,
    prefs,
    seatUserId,
    onShowInList,
  }: {
    journey: JourneyData;
    prefs: Preferences;
    seatUserId?: string;
    onShowInList: () => void;
  } = $props();

  const distanceLabel = $derived(
    typeof journey.distance === 'number'
      ? `${Math.round(convertDistance(journey.distance, prefs))} ${distanceUnitLabel(prefs)}`
      : null,
  );

  const durationLabel = $derived(
    journey.duration ? Duration.fromSeconds(journey.duration).toString() : null,
  );

  const seatLabel = $derived(formatSeatForUser(journey, seatUserId));

  const seatDescriptor = (passenger: JourneyPassenger) => {
    const place = [
      passenger.seat ? seatTypeLabel(passenger.seat) : null,
      passenger.seatNumber,
    ]
      .filter(Boolean)
      .join(' ');
    const parts = [
      passenger.seatClass ? seatClassLabel(passenger.seatClass) : null,
      passenger.coach ? `Coach ${passenger.coach}` : null,
      place || null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  };

  const passengers = $derived(
    journey.passengers
      .map((passenger) => ({
        name: getJourneyPassengerLabel(passenger),
        seat: seatDescriptor(passenger),
        reason: passenger.journeyReason
          ? journeyReasonLabel(passenger.journeyReason)
          : null,
      }))
      .filter(
        (
          p,
        ): p is { name: string; seat: string | null; reason: string | null } =>
          !!p.name,
      ),
  );

  const departurePlatform = $derived(platformLabel(journey.departurePlatform));
  const arrivalPlatform = $derived(platformLabel(journey.arrivalPlatform));

  type Row = { label: string; value: string };
  const rows = $derived.by(() => {
    const r: Row[] = [];
    if (journey.operator?.name)
      r.push({ label: 'Operator', value: journey.operator.name });
    if (journey.train || journey.unitNumber)
      r.push({ label: 'Train', value: formatTrain(journey) });
    if (distanceLabel) r.push({ label: 'Distance', value: distanceLabel });
    if (durationLabel) r.push({ label: 'Duration', value: durationLabel });
    if (seatLabel) r.push({ label: 'Seat', value: seatLabel });
    if (departurePlatform)
      r.push({ label: 'Departure', value: departurePlatform });
    if (arrivalPlatform) r.push({ label: 'Arrival', value: arrivalPlatform });
    return r;
  });
</script>

<section class="flex flex-col gap-3 px-4 py-4">
  {#if rows.length}
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {#each rows as row (row.label)}
        <dt class="text-muted-foreground">{row.label}</dt>
        <dd class="text-right font-medium tabular-nums">{row.value}</dd>
      {/each}
    </dl>
  {/if}

  {#if passengers.length}
    <div class="flex flex-col gap-1.5">
      <p class="text-xs tracking-wider text-muted-foreground uppercase">
        Passengers
      </p>
      <div class="flex flex-wrap gap-1.5">
        {#each passengers as passenger, i (i)}
          <span
            class="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-xs"
          >
            {passenger.name}
            {#if passenger.seat}
              <span class="text-muted-foreground tabular-nums">
                {passenger.seat}
              </span>
            {/if}
            {#if passenger.reason}
              <span class="text-muted-foreground">· {passenger.reason}</span>
            {/if}
          </span>
        {/each}
      </div>
    </div>
  {/if}

  {#if journey.note}
    <div class="flex flex-col gap-1.5">
      <p class="text-xs tracking-wider text-muted-foreground uppercase">Note</p>
      <p class="text-sm whitespace-pre-wrap text-muted-foreground">
        {journey.note}
      </p>
    </div>
  {/if}

  {#if !rows.length && !passengers.length && !journey.note}
    <p class="py-1 text-sm text-muted-foreground">
      No additional details for this journey.
    </p>
  {/if}
</section>

<JourneyTicket {journey} {seatLabel} />

<section class="px-4 py-3">
  <Button
    variant="ghost"
    size="sm"
    class="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
    onclick={onShowInList}
  >
    <List size={16} />
    Open list
  </Button>
</section>
