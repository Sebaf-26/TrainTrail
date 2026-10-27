import { stationsFactory } from '@test/factories/stations';
import { preferencesFactory } from '@test/factories/preferences';
import { usersFactory } from '@test/factories/users';
import { CHICAGO_UNION, NEW_YORK_PENN } from '@test/fixtures/stations';
import { login } from '@test/helpers/auth';
import { isoInstant, latestJourneyFor } from '@test/helpers/journey-db';
import {
  openAddJourneyModal,
  openEditJourneyModal,
  pickStation,
  readDateTime,
  setDateTime,
  submitJourneyForm,
} from '@test/helpers/journey-form';
import { expect, test } from '@test/index';

// All tests in this file use `journeyTimeDisplay='station'` so the user enters
// New York-local wall-clocks at the departure side. Browser TZ is pinned to UTC
// to rule out any system-tz contribution — only America/New_York's DST
// behaviour at the departure station is exercised here. The arrival station is
// Chicago, which changes its clocks on the same days at a different instant.
test.describe('DST edge cases (America/New_York)', () => {
  test.use({ timezoneId: 'UTC' });

  const setup = async (page: Parameters<typeof login>[0]) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, {
      timeFormat: '24h',
      dateFormat: 'iso',
      journeyTimeDisplay: 'station',
    });
    await login(page, user);
    const { station: from } = await stationsFactory.getOrCreate(NEW_YORK_PENN);
    const { station: to } = await stationsFactory.getOrCreate(CHICAGO_UNION);
    return { user, from, to };
  };

  test('spring forward: non-existent local time 02:30 stores deterministically', async ({
    page,
  }) => {
    // 2024-03-10 02:00–02:59 in New York does not exist — clocks jump from
    // 01:59:59 EST (UTC-5) straight to 03:00:00 EDT (UTC-4). date-fns/tz
    // resolves a non-existent wall-clock by applying the pre-transition
    // offset, so 02:30 is interpreted as `02:30 EST` = 07:30 UTC.
    const { user, from, to } = await setup(page);

    const modal = await openAddJourneyModal(page);
    await pickStation(page, modal, 'From', from);
    await pickStation(page, modal, 'To', to);
    await setDateTime(modal, 'departure', {
      date: '2024-03-10',
      time: '02:30',
    });
    await setDateTime(modal, 'arrival', { date: '2024-03-10', time: '14:00' });
    await submitJourneyForm(page, modal);

    const journey = await latestJourneyFor(user.id, from.id, to.id);
    // 02:30 EST → 07:30 UTC. Re-read in NYC local this is 03:30 EDT, i.e.
    // the user's input is silently shifted forward by 1h on the round-trip.
    expect(isoInstant(journey.departure)).toBe('2024-03-10T07:30:00.000Z');
    // 14:00 in Chicago on 2024-03-10 — Chicago already switched to CDT
    // (UTC-5) at 08:00Z, so 14:00 CDT = 19:00Z.
    expect(isoInstant(journey.arrival)).toBe('2024-03-10T19:00:00.000Z');
    // Duration math should reflect the actual instants, not the wall-clocks:
    // 07:30Z → 19:00Z = 11.5h = 41400s.
    expect(journey.duration).toBe(41_400);
  });

  test('spring forward: round-trip displays the shifted wall-clock (03:30, not 02:30)', async ({
    page,
  }) => {
    // The user typed 02:30 but that instant doesn't exist locally; the
    // stored instant lands on the EDT side of the gap, so on re-open the
    // form must honestly display 03:30 EDT. If this regresses to 02:30 it
    // means the round-trip is lossy — the form would round-trip to a
    // different absolute time than what was stored.
    const { from, to } = await setup(page);
    // (no DB read in this test — round-trip is asserted via the UI segments.)

    const modal = await openAddJourneyModal(page);
    await pickStation(page, modal, 'From', from);
    await pickStation(page, modal, 'To', to);
    await setDateTime(modal, 'departure', {
      date: '2024-03-10',
      time: '02:30',
    });
    await setDateTime(modal, 'arrival', { date: '2024-03-10', time: '14:00' });
    await submitJourneyForm(page, modal);

    const editModal = await openEditJourneyModal(page);
    const displayed = await readDateTime(editModal, 'departure');
    expect(displayed.date).toBe('2024-03-10');
    expect(displayed.time).toBe('03:30');
  });

  test('fall back: ambiguous local time 01:30 picks the earlier (EDT) occurrence', async ({
    page,
  }) => {
    // 2024-11-03 01:30 in NYC happens twice — once as EDT (UTC-4, the
    // earlier instant) and once as EST (UTC-5, an hour later). date-fns/tz
    // disambiguates by picking the *earlier* offset, so 01:30 → 05:30 UTC.
    // If this ever flips to 06:30 UTC the test will catch it — both are
    // valid choices but the codebase must commit to one consistently.
    const { user, from, to } = await setup(page);

    const modal = await openAddJourneyModal(page);
    await pickStation(page, modal, 'From', from);
    await pickStation(page, modal, 'To', to);
    await setDateTime(modal, 'departure', {
      date: '2024-11-03',
      time: '01:30',
    });
    // Chicago already switched back to CST (UTC-6) at 07:00Z, so
    // 14:00 CST = 20:00Z.
    await setDateTime(modal, 'arrival', { date: '2024-11-03', time: '14:00' });
    await submitJourneyForm(page, modal);

    const journey = await latestJourneyFor(user.id, from.id, to.id);
    expect(isoInstant(journey.departure)).toBe('2024-11-03T05:30:00.000Z');
    expect(isoInstant(journey.arrival)).toBe('2024-11-03T20:00:00.000Z');
    // 05:30Z → 20:00Z = 14.5h = 52200s. Had it stored 06:30Z (the EST
    // interpretation) duration would be 48600s instead — useful sanity
    // check that the disambiguation flowed through duration math.
    expect(journey.duration).toBe(52_200);
  });
});
