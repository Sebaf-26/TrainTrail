import { stationsFactory } from '@test/factories/stations';
import { preferencesFactory } from '@test/factories/preferences';
import { usersFactory } from '@test/factories/users';
import { CHICAGO_UNION, NEW_YORK_PENN } from '@test/fixtures/stations';
import { isoInstant, latestJourneyFor } from '@test/helpers/journey-db';
import { login } from '@test/helpers/auth';
import {
  openAddJourneyModal,
  pickStation,
  setDateTime,
  submitJourneyForm,
} from '@test/helpers/journey-form';
import { expect, test } from '@test/index';

test.describe('Cross-timezone journey times', () => {
  // Pin the browser TZ so editTz=='system' tests exercise a real offset gap
  // versus the station TZ. With UTC, system==station==UTC and nothing diverges.
  test.use({ timezoneId: 'Europe/Stockholm' });

  test('journeyTimeDisplay=station: stored ISO uses each station offset', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, {
      timeFormat: '24h',
      dateFormat: 'iso',
      journeyTimeDisplay: 'station',
    });
    await login(page, user);

    const { station: from } = await stationsFactory.getOrCreate(NEW_YORK_PENN);
    const { station: to } = await stationsFactory.getOrCreate(CHICAGO_UNION);

    const modal = await openAddJourneyModal(page);
    await pickStation(page, modal, 'From', from);
    await pickStation(page, modal, 'To', to);

    // User types New York-local times because journeyTimeDisplay='station'.
    await setDateTime(modal, 'departure', {
      date: '2024-01-15',
      time: '22:30',
    });
    await setDateTime(modal, 'arrival', { date: '2024-01-16', time: '10:00' });
    await submitJourneyForm(page, modal);

    const journey = await latestJourneyFor(user.id, from.id, to.id);

    // New York is EST in January (UTC-5): 22:30 EST = 03:30 UTC next day.
    expect(isoInstant(journey.departure)).toBe('2024-01-16T03:30:00.000Z');
    // Chicago is CST in January (UTC-6): 10:00 local = 16:00 UTC.
    expect(isoInstant(journey.arrival)).toBe('2024-01-16T16:00:00.000Z');
    // `date` is the station-local date for the departure station.
    expect(journey.date).toBe('2024-01-15');
  });

  test('journeyTimeDisplay=utc: same inputs interpreted as UTC', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, {
      timeFormat: '24h',
      dateFormat: 'iso',
      journeyTimeDisplay: 'utc',
    });
    await login(page, user);

    const { station: from } = await stationsFactory.getOrCreate(NEW_YORK_PENN);
    const { station: to } = await stationsFactory.getOrCreate(CHICAGO_UNION);

    const modal = await openAddJourneyModal(page);
    await pickStation(page, modal, 'From', from);
    await pickStation(page, modal, 'To', to);

    // Same wall-clock the user types — but interpreted as UTC, not New York/Chicago.
    await setDateTime(modal, 'departure', {
      date: '2024-01-15',
      time: '22:30',
    });
    await setDateTime(modal, 'arrival', { date: '2024-01-16', time: '10:00' });
    await submitJourneyForm(page, modal);

    const journey = await latestJourneyFor(user.id, from.id, to.id);
    expect(isoInstant(journey.departure)).toBe('2024-01-15T22:30:00.000Z');
    expect(isoInstant(journey.arrival)).toBe('2024-01-16T10:00:00.000Z');
  });

  test('12h time format accepts pm input', async ({ page }) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, {
      timeFormat: '12h',
      dateFormat: 'iso',
      journeyTimeDisplay: 'station',
    });
    await login(page, user);

    const { station: from } = await stationsFactory.getOrCreate(NEW_YORK_PENN);
    const { station: to } = await stationsFactory.getOrCreate(CHICAGO_UNION);

    const modal = await openAddJourneyModal(page);
    await pickStation(page, modal, 'From', from);
    await pickStation(page, modal, 'To', to);

    await setDateTime(modal, 'departure', {
      date: '2024-01-15',
      time: '10:30 pm',
    });
    await setDateTime(modal, 'arrival', {
      date: '2024-01-16',
      time: '10:00 am',
    });
    await submitJourneyForm(page, modal);

    const journey = await latestJourneyFor(user.id, from.id, to.id);
    // 10:30 pm EST = 03:30 UTC next day; 10:00 am CST = 16:00 UTC.
    expect(isoInstant(journey.departure)).toBe('2024-01-16T03:30:00.000Z');
    expect(isoInstant(journey.arrival)).toBe('2024-01-16T16:00:00.000Z');
  });
});
