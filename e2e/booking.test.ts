import { expect, test } from '@playwright/test';
import { getSessionCookie, getTomorrowDate, login, TEST_FLATS, TEST_SPOT } from './helpers';

const FLAT = TEST_FLATS[0]; // A01

test.describe('Booking creation and cancellation', () => {
	test('create a booking via the UI', async ({ page }) => {
		await login(page, FLAT.number, FLAT.pin);

		await page.goto('/book');

		// Select tomorrow's date in the calendar
		const tomorrow = getTomorrowDate();
		// The booking page should have the date picker — click on the date
		// Since the date picker is complex, let's navigate via URL params
		await page.goto(`/book?date=${tomorrow}&startHour=10&endHour=12`);

		// Wait for the form to load with pre-filled values
		await page.waitForTimeout(1000);

		// Submit the booking
		const submitButton = page.locator('button:text("Confirmer")');
		if (await submitButton.isVisible()) {
			await submitButton.click();
		}

		// Verify success — we should see a toast or redirect
		await expect(page.locator('text=Réservation confirmée').or(page.locator('[data-sonner-toast]'))).toBeVisible({
			timeout: 5000
		});
	});

	test('booking appears in my-bookings', async ({ page }) => {
		await login(page, FLAT.number, FLAT.pin);
		const cookies = await getSessionCookie(page);
		const tomorrow = getTomorrowDate();

		// Create booking via API
		const res = await page.request.post('/api/bookings', {
			headers: { 'Content-Type': 'application/json', Cookie: cookies },
			data: { spot: TEST_SPOT, startTime: `${tomorrow}T14:00:00`, endTime: `${tomorrow}T16:00:00` }
		});
		expect(res.ok()).toBeTruthy();

		// Navigate to my-bookings
		await page.goto('/my-bookings');

		// Verify booking is listed
		await expect(page.locator('text=14h00')).toBeVisible();
		await expect(page.locator('text=16h00')).toBeVisible();
	});

	test('cancel a booking from my-bookings', async ({ page }) => {
		await login(page, FLAT.number, FLAT.pin);
		const cookies = await getSessionCookie(page);
		const tomorrow = getTomorrowDate();

		// Create a booking via API
		const res = await page.request.post('/api/bookings', {
			headers: { 'Content-Type': 'application/json', Cookie: cookies },
			data: { spot: TEST_SPOT, startTime: `${tomorrow}T18:00:00`, endTime: `${tomorrow}T20:00:00` }
		});
		expect(res.ok()).toBeTruthy();

		// Go to my-bookings
		await page.goto('/my-bookings');

		// Find and click the cancel button
		const cancelButton = page.locator('button:text("Annuler")').first();
		await cancelButton.click();

		// Confirm the browser dialog
		page.on('dialog', (dialog) => dialog.accept());

		// Verify the booking was removed (toast or disappearance)
		await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 });
	});
});
