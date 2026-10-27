import { TZDate } from '@date-fns/tz';
import { isBefore } from 'date-fns';

import type { Journey, JourneyDatePrecision } from '$lib/db/types';
import { getJourneyDateRange, parseLocalizeISO } from '$lib/utils/datetime';

export type JourneyTimeline = {
  precision: JourneyDatePrecision;
  dateStart: TZDate | null;
  dateEnd: TZDate | null;
  recordedDeparture: TZDate | null;
  recordedArrival: TZDate | null;
  effectiveDeparture: TZDate | null;
  effectiveArrival: TZDate | null;
};

export type JourneyTimelineWindow = {
  start: TZDate;
  end: TZDate;
  precision: JourneyDatePrecision;
};

const parseTime = (value: string | null, timezone: string) =>
  value ? parseLocalizeISO(value, timezone) : null;

export const resolveJourneyTimeline = (journey: Journey): JourneyTimeline => {
  const fromTimezone = journey.from?.tz ?? 'UTC';
  const toTimezone = journey.to?.tz ?? 'UTC';
  const { start: dateStart, end: dateEnd } = getJourneyDateRange(
    journey.date,
    journey.datePrecision,
    fromTimezone,
  );
  const hasExactDate = journey.datePrecision === 'day';
  const recordedDeparture = hasExactDate
    ? parseTime(journey.departure, fromTimezone)
    : null;
  const recordedArrival = hasExactDate
    ? parseTime(journey.arrival, toTimezone)
    : null;
  const effectiveDeparture =
    recordedDeparture ?? parseTime(journey.departureScheduled, fromTimezone);
  const recordedOrScheduledArrival =
    recordedArrival ?? parseTime(journey.arrivalScheduled, toTimezone);
  const effectiveArrival =
    recordedOrScheduledArrival ??
    (effectiveDeparture && journey.duration !== null
      ? new TZDate(
          effectiveDeparture.getTime() + journey.duration * 1_000,
          toTimezone,
        )
      : null);

  return {
    precision: journey.datePrecision,
    dateStart,
    dateEnd,
    recordedDeparture,
    recordedArrival,
    effectiveDeparture,
    effectiveArrival,
  };
};

export const isCompletedJourney = (
  journey: Journey,
  now: Date = new Date(),
): boolean => {
  const timeline = resolveJourneyTimeline(journey);
  const fallbackDate =
    timeline.precision === 'day'
      ? timeline.dateStart
      : (timeline.dateEnd ?? timeline.dateStart);
  const comparisonDate =
    timeline.effectiveArrival ?? timeline.effectiveDeparture ?? fallbackDate;

  return comparisonDate ? isBefore(comparisonDate, now) : true;
};

export const getJourneyTimelineWindow = (
  timeline: JourneyTimeline,
  direction: 'departure' | 'arrival',
): JourneyTimelineWindow | null => {
  const exact =
    direction === 'departure'
      ? timeline.effectiveDeparture
      : timeline.effectiveArrival;
  if (exact) return { start: exact, end: exact, precision: 'day' };
  if (direction === 'arrival' || !timeline.dateStart || !timeline.dateEnd) {
    return null;
  }
  return {
    start: timeline.dateStart,
    end: timeline.dateEnd,
    precision: timeline.precision,
  };
};
