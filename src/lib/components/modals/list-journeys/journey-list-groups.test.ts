import { describe, expect, it } from 'vitest';

import {
  buildJourneyListYears,
  paginateJourneyListYears,
  sortByDepartureDesc,
} from './journey-list-groups';

import type { Station, Journey } from '$lib/db/types';
import { prepareJourneyData } from '$lib/utils';

const station = (id: number, tz: string): Station =>
  ({ id, tz, lon: 0, lat: 0 }) as Station;

const PARIS = station(1, 'Europe/Paris');
const LYON = station(2, 'Europe/Paris');
const MARSEILLE = station(3, 'Europe/Paris');

type JourneyInput = {
  id: number;
  from: Station;
  to: Station;
  date: string;
  departure: string;
  arrival: string;
};

const journey = ({ id, from, to, date, departure, arrival }: JourneyInput) =>
  ({
    id,
    from,
    to,
    date,
    datePrecision: 'day',
    departure,
    arrival,
    duration: null,
    departureScheduled: null,
    arrivalScheduled: null,
  }) as Journey;

/** Journeys are handed to the list newest first. */
const build = (journeys: Journey[], now: string) =>
  buildJourneyListYears(prepareJourneyData(journeys), new Date(now));

const groupedIds = (years: ReturnType<typeof build>) =>
  years.flatMap((year) =>
    year.groups.map((group) => group.journeys.map((f) => f.id)),
  );

const unrelatedJourneys = (count: number, date: string) =>
  Array.from({ length: count }, (_, index) =>
    journey({
      id: 100 + index,
      from: PARIS,
      to: MARSEILLE,
      date,
      departure: `${date}T05:00:00.000Z`,
      arrival: `${date}T08:30:00.000Z`,
    }),
  );

// Paris -> Lyon -> Marseille, changing trains in Lyon after a 2h30 stop.
const lyonConnection = [
  journey({
    id: 2,
    from: LYON,
    to: MARSEILLE,
    date: '2024-03-02',
    departure: '2024-03-02T09:30:00.000Z',
    arrival: '2024-03-02T11:30:00.000Z',
  }),
  journey({
    id: 1,
    from: PARIS,
    to: LYON,
    date: '2024-03-02',
    departure: '2024-03-02T05:00:00.000Z',
    arrival: '2024-03-02T07:00:00.000Z',
  }),
];

describe('sortByDepartureDesc', () => {
  const order = (journeys: Journey[]) =>
    sortByDepartureDesc(prepareJourneyData(journeys)).map((f) => f.id);

  it('orders same-day journeys on their scheduled time when none has run', () => {
    // Upcoming journeys only carry scheduled times, so ordering them on the
    // start of their day leaves same-day departures tied.
    const [onward, inbound] = lyonConnection.map(
      (f) =>
        ({
          ...f,
          departure: null,
          arrival: null,
          departureScheduled: f.departure,
          arrivalScheduled: f.arrival,
          date: '2024-03-02',
        }) as Journey,
    );

    expect(order([inbound!, onward!])).toEqual([2, 1]);
    expect(order([onward!, inbound!])).toEqual([2, 1]);
  });

  it('orders completed journeys on their recorded time', () => {
    const [onward, inbound] = lyonConnection;

    expect(order([inbound!, onward!])).toEqual([2, 1]);
  });

  it('puts journeys without a usable date last', () => {
    const undated = {
      ...lyonConnection[0]!,
      id: 4,
      date: '',
      departure: null,
      arrival: null,
    } as Journey;

    expect(order([undated, ...lyonConnection])).toEqual([2, 1, 4]);
  });
});

describe('buildJourneyListYears', () => {
  it('groups legs connected by a change of train', () => {
    expect(groupedIds(build(lyonConnection, '2024-06-01T00:00:00Z'))).toEqual([
      [2, 1],
    ]);
  });

  it('keeps legs apart when the stop is longer than 12 hours', () => {
    const [onward, inbound] = lyonConnection;
    const later = {
      ...onward!,
      departure: '2024-03-02T20:00:00.000Z',
      arrival: '2024-03-02T22:00:00.000Z',
    } as Journey;

    expect(
      groupedIds(build([later, inbound!], '2024-06-01T00:00:00Z')),
    ).toEqual([[2], [1]]);
  });

  it('keeps legs apart when the second one starts somewhere else', () => {
    const [onward, inbound] = lyonConnection;
    const elsewhere = { ...onward!, from: MARSEILLE, to: LYON } as Journey;

    expect(
      groupedIds(build([elsewhere, inbound!], '2024-06-01T00:00:00Z')),
    ).toEqual([[2], [1]]);
  });

  it('does not group journeys that have no times to compare', () => {
    const untimed = lyonConnection.map(
      (f) => ({ ...f, departure: null, arrival: null }) as Journey,
    );

    expect(groupedIds(build(untimed, '2024-06-01T00:00:00Z'))).toEqual([
      [2],
      [1],
    ]);
  });

  it('marks the first completed journey below the upcoming ones', () => {
    const years = build(lyonConnection, '2024-03-02T10:00:00Z');

    // The Lyon stop is over, so the onward leg is still upcoming while the
    // inbound one has arrived: the run is cut at the boundary.
    expect(groupedIds(years)).toEqual([[2], [1]]);
    expect(years[0]!.groups.map((group) => group.startsPastSection)).toEqual([
      false,
      true,
    ]);
  });

  it('keeps a scheduled journey upcoming until its effective arrival', () => {
    const [onward, inbound] = lyonConnection;
    const scheduledOnward = {
      ...onward!,
      departure: null,
      arrival: null,
      departureScheduled: onward!.departure,
      arrivalScheduled: onward!.arrival,
    } as Journey;

    const years = build([scheduledOnward, inbound!], '2024-03-02T10:00:00Z');

    expect(groupedIds(years)).toEqual([[2], [1]]);
    expect(years[0]!.groups.map((group) => group.startsPastSection)).toEqual([
      false,
      true,
    ]);
  });

  it('marks the boundary on the first group of an older year', () => {
    const [onward] = lyonConnection;
    const upcoming = {
      ...onward!,
      id: 3,
      date: '2025-01-10',
      departure: '2025-01-10T09:30:00.000Z',
      arrival: '2025-01-10T11:30:00.000Z',
    } as Journey;

    const years = build([upcoming, ...lyonConnection], '2024-06-01T00:00:00Z');

    expect(years.map((year) => year.year)).toEqual([2025, 2024]);
    expect(years[0]!.groups[0]!.startsPastSection).toBe(false);
    expect(years[1]!.groups[0]!.startsPastSection).toBe(true);
  });

  it('leaves the boundary unmarked when every journey has been completed', () => {
    const years = build(lyonConnection, '2024-06-01T00:00:00Z');

    expect(
      years.flatMap((year) =>
        year.groups.map((group) => group.startsPastSection),
      ),
    ).toEqual([false]);
  });

  it('sorts undated journeys into their own trailing year', () => {
    const undated = {
      ...lyonConnection[0]!,
      id: 4,
      date: '',
      departure: null,
      arrival: null,
    } as Journey;

    const years = build([...lyonConnection, undated], '2024-06-01T00:00:00Z');

    expect(years.map((year) => year.year)).toEqual([2024, 0]);
    expect(groupedIds(years)).toEqual([[2, 1], [4]]);
  });
});

describe('paginateJourneyListYears', () => {
  it('moves a connection group intact to the next page', () => {
    const years = build(
      [...unrelatedJourneys(19, '2024-03-03'), ...lyonConnection],
      '2024-06-01T00:00:00Z',
    );

    const pages = paginateJourneyListYears(years, 20);

    expect(pages.map((page) => page.journeys.length)).toEqual([19, 2]);
    expect(pages.map((page) => page.firstJourneyIndex)).toEqual([0, 19]);
    expect(groupedIds(pages[1]!.years)).toEqual([[2, 1]]);
  });

  it('keeps the past divider on a new page', () => {
    const [, pastJourney] = lyonConnection;
    const years = build(
      [...unrelatedJourneys(20, '2025-03-03'), pastJourney!],
      '2024-06-01T00:00:00Z',
    );

    const pages = paginateJourneyListYears(years, 20);

    expect(pages.map((page) => page.journeys.length)).toEqual([20, 1]);
    expect(pages[1]!.years[0]!.groups[0]!.startsPastSection).toBe(true);
  });
});
