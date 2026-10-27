import { describe, expect, it } from 'vitest';

import {
  formatSeatForUser,
  formatSimpleJourney,
  type JourneyData,
} from './data';

const journeyWith = (passenger: Record<string, unknown>) =>
  ({
    passengers: [
      {
        userId: 'user-one',
        seat: null,
        coach: null,
        seatNumber: null,
        seatClass: null,
        ...passenger,
      },
    ],
  }) as unknown as JourneyData;

describe('formatSeatForUser', () => {
  it('shows class, coach and seat together', () => {
    const journey = journeyWith({
      seatClass: 'first',
      coach: '7',
      seat: 'window',
      seatNumber: '12A',
    });

    expect(formatSeatForUser(journey, 'user-one')).toBe(
      '1st class (coach 7, window 12A)',
    );
  });

  it('shows the coach on its own', () => {
    expect(formatSeatForUser(journeyWith({ coach: '3' }), 'user-one')).toBe(
      'coach 3',
    );
  });

  it('keeps the older seat formats', () => {
    expect(
      formatSeatForUser(
        journeyWith({ seat: 'aisle', seatNumber: '4C' }),
        'user-one',
      ),
    ).toBe('aisle 4C');
    expect(
      formatSeatForUser(journeyWith({ seatClass: 'second' }), 'user-one'),
    ).toBe('2nd class');
    expect(formatSeatForUser(journeyWith({ seat: 'table' }), 'user-one')).toBe(
      'Table',
    );
  });

  it('is null without any seat detail', () => {
    expect(formatSeatForUser(journeyWith({}), 'user-one')).toBeNull();
  });
});

describe('formatSimpleJourney', () => {
  it('labels stations by name', () => {
    const journey = {
      id: 1,
      from: { id: 1, name: 'Milano Centrale', code: '8301700' },
      to: { id: 2, name: 'Roma Termini', code: '8308409' },
      date: '2024-06-14',
      dateStart: null,
      datePrecision: 'day',
      operator: null,
    } as unknown as JourneyData;

    expect(formatSimpleJourney(journey)).toMatchObject({
      fromCode: 'Milano Centrale',
      toCode: 'Roma Termini',
    });
  });
});
