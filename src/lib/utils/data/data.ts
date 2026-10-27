import { TZDate } from '@date-fns/tz';
import { isAfter } from 'date-fns';

import { resolveJourneyTimeline } from './journey-timeline';

import { page } from '$app/state';
import type { Station, Journey, JourneyPassenger } from '$lib/db/types';
import { distanceBetween } from '$lib/utils';
import { seatClassLabel, seatTypeLabel } from '$lib/utils/journey-labels';
import { nowIn } from '$lib/utils/datetime';

type ExcludedType<T, U> = {
  [P in keyof T as P extends keyof U ? never : P]: T[P];
};

type JourneyOverrides = {
  date: TZDate | null;
  dateStart: TZDate | null;
  dateEnd: TZDate | null;
  departure: TZDate | null;
  arrival: TZDate | null;
  distance: number | null;
  raw: Journey;
};
export type JourneyData = ExcludedType<Journey, JourneyOverrides> &
  JourneyOverrides;

export const formatSimpleJourney = (journey: JourneyData) => ({
  id: journey.id,
  stations: [journey.from?.id, journey.to?.id],
  fromCode: journey.from?.name ?? 'N/A',
  toCode: journey.to?.name ?? 'N/A',
  date: journey.date,
  dateStart: journey.dateStart,
  datePrecision: journey.datePrecision,
  operator: journey.operator,
});

export type SimpleJourney = ReturnType<typeof formatSimpleJourney>;

export const prepareJourneyData = (data: Journey[]): JourneyData[] => {
  if (!data) return [];

  return data
    .map((journey) => {
      const timeline = resolveJourneyTimeline(journey);

      return {
        ...journey,
        date: timeline.recordedDeparture ?? timeline.dateStart,
        dateStart: timeline.dateStart,
        dateEnd: timeline.dateEnd,
        departure: timeline.recordedDeparture,
        arrival: timeline.recordedArrival,
        distance:
          journey.from && journey.to
            ? distanceBetween(
                [journey.from.lon, journey.from.lat],
                [journey.to.lon, journey.to.lat],
              ) / 1000
            : null,
        raw: journey,
      };
    })
    .filter((f) => f !== null);
};

export const prepareJourneyArcData = (data: JourneyData[]) => {
  if (!data) return [];

  const routeMap: {
    [key: string]: {
      distance: number;
      from: Station;
      to: Station;
      journeys: SimpleJourney[];
      operators: number[];
      exclusivelyFuture: boolean;
      frequency: number;
    };
  } = {};

  data.forEach((journey) => {
    if (!journey.from || !journey.to) return;

    const key = [journey.from.name, journey.to.name]
      .sort((a, b) => a.localeCompare(b))
      .join('-');
    if (!routeMap[key]) {
      routeMap[key] = {
        distance: journey.distance!,
        from: journey.from,
        to: journey.to,
        journeys: [],
        operators: [],
        exclusivelyFuture: false,
        frequency: 1,
      };
    }

    routeMap[key].journeys.push(formatSimpleJourney(journey));

    if (
      routeMap[key].journeys.every(
        (f) => f.dateStart && isAfter(f.dateStart, nowIn('UTC')),
      )
    ) {
      routeMap[key].exclusivelyFuture = true;
    }

    if (journey.operator) {
      if (!routeMap[key].operators.includes(journey.operator.id)) {
        routeMap[key].operators.push(journey.operator.id);
      }
    }
  });

  const routes = Object.values(routeMap);

  const MIN_FREQUENCY = 1;
  const MAX_FREQUENCY = 3;
  const counts = routes.map((r) => r.journeys.length);
  const rawMin = counts.length ? Math.min(...counts) : 0;
  const rawMax = counts.length ? Math.max(...counts) : 0;
  const span = rawMax - rawMin || 1;

  routes.forEach((r) => {
    const normalised = (r.journeys.length - rawMin) / span;
    r.frequency = normalised * (MAX_FREQUENCY - MIN_FREQUENCY) + MIN_FREQUENCY;
  });

  return routes;
};

export const prepareVisitedStations = (data: JourneyData[]) => {
  const visited: (Station & {
    arrivals: number;
    departures: number;
    operators: number[];
    journeys: SimpleJourney[];
    frequency: number;
  })[] = [];
  const formatStation = (journey: JourneyData, direction: 'from' | 'to') => {
    if (!journey[direction]) return;

    const station = journey[direction];
    let visit = visited.find((v) => v.name === station.name);
    if (!visit) {
      visit = {
        ...station,
        arrivals: 0,
        departures: 0,
        operators: [],
        journeys: [],
        frequency: 0,
      };
      visited.push(visit);
    }

    if (direction === 'from') {
      visit.departures++;
    } else {
      visit.arrivals++;
    }

    if (journey.operator && !visit.operators.includes(journey.operator.id)) {
      visit.operators.push(journey.operator.id);
    }

    visit.journeys.push(formatSimpleJourney(journey));
  };

  data.forEach((journey) => {
    formatStation(journey, 'from');
    formatStation(journey, 'to');
  });

  const MIN_FREQUENCY = 1;
  const MAX_FREQUENCY = 3;

  const combinedFrequencies = visited.map((v) => v.arrivals + v.departures);

  const rawMin = Math.min(...combinedFrequencies);
  const rawMax = Math.max(...combinedFrequencies);

  const span = rawMax - rawMin || 1;

  visited.forEach((v) => {
    const combined = v.arrivals + v.departures;

    const normalised = (combined - rawMin) / span;

    v.frequency = normalised * (MAX_FREQUENCY - MIN_FREQUENCY) + MIN_FREQUENCY;
  });

  return visited;
};

export const formatSeat = (f: JourneyData) => {
  const userId = page.data.user?.id;
  return formatSeatForUser(f, userId);
};

export const formatSeatForUser = (
  f: JourneyData,
  userId: string | null | undefined,
) => {
  let passenger;
  if (userId) {
    passenger = f.passengers.find((item) => item.userId === userId);
  } else if (f.passengers.length === 1) {
    passenger = f.passengers[0];
  }
  if (!passenger) return null;

  const place = [
    passenger.coach ? `coach ${passenger.coach}` : null,
    [passenger.seat, passenger.seatNumber].filter(Boolean).join(' ') || null,
  ]
    .filter(Boolean)
    .join(', ');

  if (passenger.seatClass && place)
    return `${seatClassLabel(passenger.seatClass)} (${place})`;
  if (passenger.seatClass) return seatClassLabel(passenger.seatClass);
  if (!place) return null;
  // A lone seat position reads better capitalised on its own.
  return passenger.seat && !passenger.coach && !passenger.seatNumber
    ? seatTypeLabel(passenger.seat)
    : place;
};

export const getJourneyPassengerLabel = (passenger: JourneyPassenger) => {
  return passenger.user?.displayName ?? passenger.guestName ?? null;
};

export const getJourneyPassengerToken = (passenger: JourneyPassenger) => {
  if (passenger.userId) {
    return `user:${passenger.userId}`;
  }

  if (passenger.guestName) {
    return `guest:${passenger.guestName}`;
  }

  return null;
};

export const getJourneyPassengerLabels = (journey: JourneyData) => {
  return journey.passengers
    .map((passenger) => getJourneyPassengerLabel(passenger))
    .filter((value): value is string => Boolean(value));
};
