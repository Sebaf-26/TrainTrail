import { stationsFactory } from '@test/factories/stations';
import { journeysFactory } from '@test/factories/journeys';
import { preferencesFactory } from '@test/factories/preferences';
import { usersFactory } from '@test/factories/users';
import { CHICAGO_UNION, NEW_YORK_PENN } from '@test/fixtures/stations';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

// One canonical journey, varied across `journeyTimeDisplay` prefs without
// re-entering data. This isolates the rendering layer in ListJourneysModal:
// same DB row, three different rendered wall-clocks. If any of these assertions
// drift, the bug is in TimeDisplay / formatting — not in input/storage.
//
// Journey: New York Penn Station → Chicago Union Station on 2024-01-15 (no DST
// anywhere relevant).
//   Stored departure: 2024-01-16T03:30:00Z   (22:30 EST on Jan 15)
//   Stored arrival:   2024-01-16T16:00:00Z   (10:00 CST on Jan 16)
//
// The desktop list intentionally uses a compact short-month date even when
// dateFormat=iso. The clock and timezone still follow the user's preferences.
// Expected rendered wall-clocks (timeFormat=24h, dateFormat=iso):
//   station: dep "Jan 15, 22:30" (New York)  | arr "Jan 16, 10:00" (Chicago)
//   utc:     dep "Jan 16, 03:30"             | arr "Jan 16, 16:00"
//   system:  dep "Jan 16, 04:30"             | arr "Jan 16, 17:00"  (Stockholm = CET, UTC+1)
test.describe('Journey list time rendering', () => {
  test.use({ timezoneId: 'Europe/Stockholm' });

  const seed = async (
    page: Parameters<typeof login>[0],
    display: 'station' | 'utc' | 'system',
  ) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, {
      timeFormat: '24h',
      dateFormat: 'iso',
      journeyTimeDisplay: display,
    });
    const { station: from } = await stationsFactory.getOrCreate(NEW_YORK_PENN);
    const { station: to } = await stationsFactory.getOrCreate(CHICAGO_UNION);
    await journeysFactory.create({
      userId: user.id,
      date: '2024-01-15',
      fromId: from.id,
      toId: to.id,
      departure: '2024-01-16T03:30:00.000Z',
      arrival: '2024-01-16T16:00:00.000Z',
      duration: 45_000,
    });
    await login(page, user);
  };

  const openListAndRead = async (page: Parameters<typeof login>[0]) => {
    await page.getByTestId('list-journeys-button').click();
    await expect(page.getByText(/all journeys/i)).toBeVisible({
      timeout: 5000,
    });
    const dep = page.getByTestId('journey-time-departure').first();
    const arr = page.getByTestId('journey-time-arrival').first();
    await expect(dep).toBeVisible();
    return { dep, arr };
  };

  test('station: shows each endpoint in its station-local time', async ({
    page,
  }) => {
    await seed(page, 'station');
    const { dep, arr } = await openListAndRead(page);
    await expect(dep).toContainText('22:30');
    await expect(dep).toContainText('Jan 15');
    await expect(arr).toContainText('10:00');
    await expect(arr).toContainText('Jan 16');
  });

  test('utc: shows both endpoints in UTC', async ({ page }) => {
    await seed(page, 'utc');
    const { dep, arr } = await openListAndRead(page);
    await expect(dep).toContainText('03:30');
    await expect(dep).toContainText('Jan 16');
    await expect(arr).toContainText('16:00');
    await expect(arr).toContainText('Jan 16');
  });

  test('system: shows both endpoints in the browser timezone (CET, UTC+1)', async ({
    page,
  }) => {
    await seed(page, 'system');
    const { dep, arr } = await openListAndRead(page);
    await expect(dep).toContainText('04:30');
    await expect(dep).toContainText('Jan 16');
    await expect(arr).toContainText('17:00');
    await expect(arr).toContainText('Jan 16');
  });
});
