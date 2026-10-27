import { describe, expect, it } from 'vitest';

import { buildJourneyIndicators } from './journey-indicators';

import type { Station, Journey, JourneyPassenger } from '$lib/db/types';
import { prepareJourneyData } from '$lib/utils';

const station = (id: number): Station =>
  ({ id, tz: 'UTC', lon: 0, lat: 0 }) as Station;

const MILANO_CENTRALE = station(1);
const ROMA_TERMINI = station(2);

const me = (displayName = 'Me'): JourneyPassenger =>
  ({ userId: 'me', user: { id: 'me', displayName } }) as JourneyPassenger;

const member = (id: string, displayName: string): JourneyPassenger =>
  ({ userId: id, user: { id, displayName } }) as JourneyPassenger;

const guest = (guestName: string | null): JourneyPassenger =>
  ({ userId: null, guestName, user: null }) as JourneyPassenger;

const journey = (overrides: Partial<Journey> = {}) =>
  prepareJourneyData([
    {
      id: 1,
      from: MILANO_CENTRALE,
      to: ROMA_TERMINI,
      date: '2026-03-12',
      datePrecision: 'day',
      departure: null,
      arrival: null,
      duration: null,
      departureScheduled: null,
      arrivalScheduled: null,
      note: null,
      passengers: [],
      ...overrides,
    } as unknown as Journey,
  ])[0]!;

const keys = (...args: Parameters<typeof buildJourneyIndicators>) =>
  buildJourneyIndicators(...args).map((indicator) => indicator.key);

const labelFor = (
  key: string,
  ...args: Parameters<typeof buildJourneyIndicators>
) => buildJourneyIndicators(...args).find((i) => i.key === key)?.label;

describe('buildJourneyIndicators', () => {
  it('returns nothing for a journey with only a date', () => {
    expect(keys(journey())).toEqual([]);
  });

  it('flags a recorded track only when the journey has one', () => {
    expect(keys(journey(), { hasTrack: true })).toEqual(['track']);
    expect(keys(journey(), { hasTrack: false })).toEqual([]);
  });

  it('ignores scheduled-only times', () => {
    const scheduled = journey({
      departureScheduled: '2026-03-12T10:00:00.000Z',
      arrivalScheduled: '2026-03-12T13:00:00.000Z',
    });
    expect(keys(scheduled)).toEqual([]);
  });

  it('describes which actual times are recorded', () => {
    expect(
      labelFor(
        'actualTimes',
        journey({ departure: '2026-03-12T10:04:00.000Z' }),
      ),
    ).toBe('Actual departure time recorded');
    expect(
      labelFor('actualTimes', journey({ arrival: '2026-03-12T13:12:00.000Z' })),
    ).toBe('Actual arrival time recorded');
    expect(
      labelFor(
        'actualTimes',
        journey({
          departure: '2026-03-12T10:04:00.000Z',
          arrival: '2026-03-12T13:12:00.000Z',
        }),
      ),
    ).toBe('Actual departure and arrival times recorded');
  });

  it('stays quiet when the viewer is the only passenger', () => {
    expect(keys(journey({ passengers: [me()] }), { viewerId: 'me' })).toEqual(
      [],
    );
    expect(keys(journey({ passengers: [] }), { viewerId: 'me' })).toEqual([]);
  });

  it('names the companions travelling with the viewer', () => {
    const shared = journey({
      passengers: [me(), member('bob', 'Bob'), guest('Charlie')],
    });
    expect(labelFor('passengers', shared, { viewerId: 'me' })).toBe(
      'Also on board: Bob, Charlie',
    );
  });

  it('falls back to a count when companions have no name', () => {
    const shared = journey({ passengers: [me(), guest(null), guest(null)] });
    expect(labelFor('passengers', shared, { viewerId: 'me' })).toBe(
      '2 passengers recorded',
    );
  });

  it('keeps unnamed companions in a mixed passenger label', () => {
    const shared = journey({
      passengers: [me(), member('bob', 'Bob'), guest(null)],
    });
    expect(labelFor('passengers', shared, { viewerId: 'me' })).toBe(
      'Also on board: Bob +1',
    );
  });

  it('needs a real group when there is no viewer to exclude', () => {
    const solo = journey({ passengers: [member('bob', 'Bob')] });
    expect(keys(solo)).toEqual([]);

    const group = journey({
      passengers: [member('bob', 'Bob'), guest('Charlie')],
    });
    expect(labelFor('passengers', group)).toBe('Passengers: Bob, Charlie');
  });

  it('can leave passengers out when they are shown elsewhere', () => {
    const group = journey({
      passengers: [member('bob', 'Bob'), guest('Charlie')],
    });
    expect(keys(group, { includePassengers: false })).toEqual([]);
  });

  it('previews the note and truncates long ones', () => {
    expect(
      labelFor('note', journey({ note: '  Upgraded to Business  ' })),
    ).toBe('Note: Upgraded to Business');
    expect(labelFor('note', journey({ note: '   ' }))).toBeUndefined();

    const long = 'a'.repeat(200);
    const label = labelFor('note', journey({ note: long }))!;
    expect(label).toBe(`Note: ${'a'.repeat(160)}…`);
  });

  it('does not split Unicode code points when truncating notes', () => {
    const note = `${'a'.repeat(159)}😀x`;
    expect(labelFor('note', journey({ note }))).toBe(
      `Note: ${'a'.repeat(159)}😀…`,
    );
  });

  it('keeps a stable order across all indicators', () => {
    const full = journey({
      departure: '2026-03-12T10:04:00.000Z',
      passengers: [me(), member('bob', 'Bob')],
      note: 'Window seat, coach 7',
    });
    expect(keys(full, { hasTrack: true, viewerId: 'me' })).toEqual([
      'track',
      'actualTimes',
      'passengers',
      'note',
    ]);
  });
});
