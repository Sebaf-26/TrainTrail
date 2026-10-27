import { stationsFactory } from '@test/factories/stations';
import { MILANO_CENTRALE, ROMA_TERMINI } from '@test/fixtures/stations';
import { journeysFactory } from '@test/factories/journeys';
import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

test.describe('Edit Journey', () => {
  test('keeps the list position and edit focus after saving', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    await login(page, user);

    const { station: fromStation } =
      await stationsFactory.getOrCreate(MILANO_CENTRALE);
    const { station: toStation } =
      await stationsFactory.getOrCreate(ROMA_TERMINI);

    const journeys = [];
    for (let day = 1; day <= 20; day += 1) {
      journeys.push(
        await journeysFactory.create({
          userId: user.id,
          date: `2025-01-${String(day).padStart(2, '0')}`,
          fromId: fromStation.id,
          toId: toStation.id,
          departure: `2025-01-${String(day).padStart(2, '0')}T10:00:00.000Z`,
          arrival: `2025-01-${String(day).padStart(2, '0')}T13:00:00.000Z`,
          duration: 10_800,
          trainNumber: `FR9${String(day).padStart(3, '0')}`,
        }),
      );
    }
    await page.goto('/');
    await page.getByTestId('list-journeys-button').click();

    const listModal = page
      .getByRole('dialog')
      .filter({ hasText: 'All Journeys' });
    await expect(listModal).toBeVisible();
    await expect
      .poll(() =>
        listModal.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      )
      .toBe(true);

    const targetRow = listModal.locator(
      `#journey-list-row-${journeys[0]!.journey.id}`,
    );
    await targetRow.scrollIntoViewIfNeeded();
    const editButton = targetRow.getByRole('button', {
      name: 'Edit journey',
    });
    await expect(editButton).toBeVisible();
    await expect
      .poll(() => listModal.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);

    await editButton.click();
    const editModal = page
      .getByRole('dialog')
      .filter({ hasText: 'Edit journey' });
    await expect(editModal).toBeVisible();
    const scrollBeforeSave = await listModal.evaluate(
      (element) => element.scrollTop,
    );

    await editModal
      .getByRole('textbox', { name: 'Train Number' })
      .fill('FR9693');
    await editModal.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Journey updated successfully')).toBeVisible();
    await expect(editModal).not.toBeVisible();
    await expect(targetRow.getByText('FR9693')).toBeVisible();
    await expect(editButton).toBeFocused();

    const scrollAfterSave = await listModal.evaluate(
      (element) => element.scrollTop,
    );
    expect(scrollAfterSave).toBe(scrollBeforeSave);

    await editButton.click();
    await expect(editModal).toBeVisible();
    await expect(
      editModal.getByRole('textbox', { name: 'Train Number' }),
    ).toHaveValue('FR9693');
  });
});
