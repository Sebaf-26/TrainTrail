import { stationsFactory } from '@test/factories/stations';
import { MILANO_CENTRALE, ROMA_TERMINI } from '@test/fixtures/stations';
import { journeysFactory } from '@test/factories/journeys';
import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { withinModal } from '@test/helpers/modal';
import { expect, test } from '@test/index';

test.describe('Delete Journey', () => {
  test('can delete a journey from the list', async ({ page }) => {
    const { user } = await usersFactory.create();
    await login(page, user);

    // Get or create test stations
    const { station: fromStation } =
      await stationsFactory.getOrCreate(MILANO_CENTRALE);
    const { station: toStation } =
      await stationsFactory.getOrCreate(ROMA_TERMINI);

    // Create a test journey
    const { journey } = await journeysFactory.create({
      userId: user.id,
      date: '2024-01-15',
      fromId: fromStation.id,
      toId: toStation.id,
      departure: '2024-01-15T10:00:00.000Z',
      arrival: '2024-01-15T13:00:00.000Z',
      duration: 10_800, // 3 hours in seconds
      trainNumber: 'FR9617',
    });

    await page.goto('/');

    // Open journeys list modal
    await page.getByTestId('list-journeys-button').click();

    await withinModal(
      async (modal) => {
        // Verify the journey is in the list
        await expect(
          modal.getByText(/Milano Centrale|Roma Termini|FR9617/i).first(),
        ).toBeVisible({ timeout: 5000 });

        // Find the delete button for this journey
        // The delete button is an X icon button within the journey card
        const journeyCard = modal
          .locator('div[class*="bg-card"]')
          .filter({ hasText: /Milano Centrale|Roma Termini|FR9617/i })
          .first();

        // Wait for the card to be visible
        await expect(journeyCard).toBeVisible({ timeout: 5000 });

        // Find all buttons in the card and click the last one
        const allButtons = journeyCard.locator('button');

        // The delete button is the last button in the actions area
        await allButtons.last().click();

        const confirmationDialog = page.getByRole('dialog').filter({
          has: page.getByRole('heading', {
            name: 'Delete journey',
            exact: true,
          }),
        });
        await confirmationDialog
          .getByRole('textbox')
          .fill(`${fromStation.name}-${toStation.name}`);
        await confirmationDialog
          .getByRole('button', { name: 'Delete journey', exact: true })
          .click();

        // Wait for success toast
        await expect(page.getByText(/journey deleted/i)).toBeVisible({
          timeout: 10000,
        });

        // The journey should be removed — empty state should appear
        await expect(modal.getByText(/no journeys yet/i)).toBeVisible({
          timeout: 5000,
        });
      },
      { page, assertClosed: false },
    );
  });

  test('can cancel journey deletion', async ({ page }) => {
    const { user } = await usersFactory.create();
    await login(page, user);

    // Get or create test stations
    const { station: fromStation } =
      await stationsFactory.getOrCreate(ROMA_TERMINI);
    const { station: toStation } =
      await stationsFactory.getOrCreate(MILANO_CENTRALE);

    // Create a test journey
    const { journey } = await journeysFactory.create({
      userId: user.id,
      date: '2024-02-20',
      fromId: fromStation.id,
      toId: toStation.id,
      departure: '2024-02-20T14:00:00.000Z',
      arrival: '2024-02-20T17:00:00.000Z',
      duration: 10_800,
    });

    await page.goto('/');

    // Open journeys list modal
    await page.getByTestId('list-journeys-button').click();

    await withinModal(
      async (modal) => {
        // Wait for the journeys modal content to be visible
        await expect(modal.getByText(/all journeys/i)).toBeVisible({
          timeout: 5000,
        });

        // Verify the journey is in the list
        await expect(
          modal.getByText(/Milano Centrale|Roma Termini/i).first(),
        ).toBeVisible({
          timeout: 5000,
        });

        // Find and click delete button
        const journeyCard = modal
          .locator('div[class*="bg-card"]')
          .filter({ hasText: /Milano Centrale|Roma Termini/i })
          .first();

        await expect(journeyCard).toBeVisible({ timeout: 5000 });

        // Find the delete button (last button in the card is the delete button)
        const allButtons = journeyCard.locator('button');

        await allButtons.last().click();

        // Click cancel button
        await page.getByRole('button', { name: 'Cancel' }).click();

        // Verify the journey is still in the list
        await expect(
          modal.getByText(/Milano Centrale|Roma Termini/i).first(),
        ).toBeVisible({
          timeout: 5000,
        });
      },
      { page, assertClosed: false },
    );
  });
});
