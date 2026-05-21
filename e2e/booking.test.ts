import { expect, test } from '@playwright/test';
import {
	getDatePlusDays,
	getSessionCookie,
	getTomorrowDate,
	login,
	navigateTo,
	TEST_FLATS,
	TEST_SPOT
} from './helpers';

const FLAT = TEST_FLATS[0]; // A01

test.describe
	.serial('Booking creation and cancellation', () => {
		test('create a booking via the UI', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);

			const tomorrow = getTomorrowDate();
			// Navigate with pre-filled params
			await navigateTo(page, `/book?date=${tomorrow}&startHour=10&endHour=12`);

			// Submit the booking — button text is "Confirmer la réservation"
			const submitButton = page.getByRole('button', { name: 'Confirmer la réservation' });
			await expect(submitButton).toBeVisible({ timeout: 5000 });
			await submitButton.click();

			// Verify success — we should see a toast
			await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({
				timeout: 5000
			});
		});

		test('booking appears in my-bookings', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);
			const cookies = await getSessionCookie(page);
			const date = getDatePlusDays(4);

			// Create booking via API on a separate day to avoid conflicts
			const res = await page.request.post('/api/bookings', {
				headers: { 'Content-Type': 'application/json', Cookie: cookies },
				data: { spotNumber: TEST_SPOT, startTime: `${date}T14:00:00`, endTime: `${date}T16:00:00` }
			});
			expect(res.ok()).toBeTruthy();

			// Navigate to my-bookings
			await navigateTo(page, '/my-bookings');

			// Verify booking is listed
			await expect(page.locator('text=14h00')).toBeVisible();
			await expect(page.locator('text=16h00')).toBeVisible();
		});

		test('cancel a booking from my-bookings', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);
			const cookies = await getSessionCookie(page);
			const date = getDatePlusDays(5);

			// Create a booking via API on a separate day
			const res = await page.request.post('/api/bookings', {
				headers: { 'Content-Type': 'application/json', Cookie: cookies },
				data: { spotNumber: TEST_SPOT, startTime: `${date}T18:00:00`, endTime: `${date}T20:00:00` }
			});
			expect(res.ok()).toBeTruthy();

			// Go to my-bookings
			await navigateTo(page, '/my-bookings');

			// Find and click the cancel button — opens AlertDialog
			const cancelButton = page.getByRole('button', { name: 'Annuler' }).first();
			await cancelButton.click();

			// Confirm in the AlertDialog
			await page.getByRole('button', { name: 'Annuler la réservation' }).click();

			// Verify the booking was removed (toast)
			await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 5000 });
		});
	});
