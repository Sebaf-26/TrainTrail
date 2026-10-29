import { stationsFactory } from '@test/factories/stations';
import { MILANO_CENTRALE, ROMA_TERMINI } from '@test/fixtures/stations';
import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { withinModal } from '@test/helpers/modal';
import { expect, test } from '@test/index';

test.describe('Add Journey', () => {
  test('can add a journey with required fields', async ({ page }) => {
    const { user } = await usersFactory.create();
    await login(page, user);

    // Get or create test stations
    const { station: fromStation } =
      await stationsFactory.getOrCreate(MILANO_CENTRALE);
    const { station: toStation } =
      await stationsFactory.getOrCreate(ROMA_TERMINI);

    await page.goto('/');

    // Open add journey modal by clicking the "Add journey" button in the dock
    await page.getByTestId('add-journey-button').click();
    await page.getByTestId('add-journey-manual').click();

    await withinModal(
      async (modal) => {
        // Fill in departure station - search by its code
        // Find the "From" field by label, then find the input within that form field
        await modal.getByText(/^From \*$/i).waitFor({ timeout: 5000 });
        const fromField = modal
          .locator('input[placeholder="Choose a station"]')
          .first();
        await fromField.click();
        await fromField.fill(fromStation.code);

        // Wait for dropdown to appear and select the station
        const fromOption = page
          .getByText(fromStation.name, { exact: true })
          .first();
        await expect(fromOption).toBeVisible({ timeout: 10000 });
        await fromOption.click();

        // Fill in arrival station - search by its code
        await modal.getByText(/^To \*$/i).waitFor({ timeout: 5000 });
        const toField = modal
          .locator('input[placeholder="Choose a station"]')
          .nth(1);
        await toField.click();
        await toField.fill(toStation.code);

        const toOption = page
          .getByText(toStation.name, { exact: true })
          .first();
        await expect(toOption).toBeVisible({ timeout: 10000 });
        await toOption.click();

        // Fill in departure date - use the hidden input field
        // The form uses a hidden input with name="departure" that stores the ISO datetime string
        const departureDate = new Date('2024-01-15T10:00:00.000Z');
        const departureISO = departureDate.toISOString();

        // Set the hidden input value via JavaScript
        await page.evaluate((iso) => {
          const input = document.querySelector(
            'input[name="departure"]',
          ) as HTMLInputElement;
          if (input) {
            input.value = iso;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, departureISO);

        // Also try clicking the calendar icon and selecting a date as a fallback
        const calendarIcon = modal
          .locator('button')
          .filter({ has: page.locator('svg[class*="CalendarDays"]') })
          .first();

        if ((await calendarIcon.count()) > 0) {
          await calendarIcon.click();
          await page.waitForTimeout(300);
          // Try to click on day 15 in the calendar
          const dayButtons = page
            .locator('button')
            .filter({ hasText: /^15$/ })
            .first();
          if ((await dayButtons.count()) > 0) {
            await dayButtons.click();
            await page.waitForTimeout(300);
          }
        }

        // Submit the form
        await modal.getByRole('button', { name: /add journey/i }).click();

        // Wait for success toast
        await expect(page.getByText(/journey added/i)).toBeVisible({
          timeout: 10000,
        });
      },
      { page, title: 'New journey' },
    );

    // Verify journey appears in the list
    await page.getByTestId('list-journeys-button').click();

    // Wait for the journeys modal to open
    await expect(page.getByText(/all journeys/i)).toBeVisible({
      timeout: 5000,
    });

    // Check that the journey appears in the list
    // Look for either station name
    await expect(
      page.getByText(/Milano Centrale|Roma Termini/i).first(),
    ).toBeVisible({
      timeout: 5000,
    });
  });
});
