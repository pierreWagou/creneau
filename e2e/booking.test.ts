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
			const body = await res.json();
			const { booking } = body;

			// The failure-only mail flag surfaces exactly when delivery fails
			// (CI without SMTP). With a local Mailpit running, delivery succeeds
			// and the flag stays absent — so only pin its shape, never its presence.
			if (body.mailFailed !== undefined) expect(body.mailFailed).toBe(true);

			// Navigate to my-bookings
			await navigateTo(page, '/my-bookings');

			// Verify booking is listed (avatar carries the id; chip carries the spot)
			await expect(page.locator(`[data-booking-id="${booking.id}"]`)).toBeVisible();
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

			// Open the booking drawer (actions live there now), then Annuler
			const { booking } = await res.json();
			await page.locator(`[data-booking-id="${booking.id}"]`).click();
			await page.getByRole('button', { name: 'Annuler' }).click();

			// Confirm in the AlertDialog
			await page.getByRole('button', { name: 'Annuler la réservation' }).click();

			// Verify the booking was removed (toast)
			await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 5000 });
		});

		test('edit a booking note from my-bookings', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);
			const cookies = await getSessionCookie(page);
			const date = getDatePlusDays(6);

			// Create a booking via API without a note
			const res = await page.request.post('/api/bookings', {
				headers: { 'Content-Type': 'application/json', Cookie: cookies },
				data: { spotNumber: TEST_SPOT, startTime: `${date}T18:00:00`, endTime: `${date}T20:00:00` }
			});
			expect(res.ok()).toBeTruthy();

			// Open the drawer, then Modifier for the edit dialog
			const { booking } = await res.json();
			await navigateTo(page, '/my-bookings');
			await page.locator(`[data-booking-id="${booking.id}"]`).click();
			await page.getByRole('button', { name: 'Modifier', exact: true }).click();

			// The edit dialog carries the shared note field; save a note
			const editDialog = page.getByRole('alertdialog', { name: 'Modifier la réservation' });
			await expect(editDialog).toBeVisible();
			await editDialog.getByLabel('Note', { exact: true }).fill('note-persistence-e2e');
			await editDialog.getByRole('button', { name: 'Modifier', exact: true }).click();

			// Verify the save toast, then the note in the drawer detail
			await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 5000 });
			await expect(page.getByRole('dialog').getByText('note-persistence-e2e')).toBeVisible();
		});
	});
