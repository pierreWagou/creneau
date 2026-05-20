import { expect, test } from '@playwright/test';
import { createBookingViaAPI, getSessionCookie, getTomorrowDate, login, TEST_FLATS, TEST_SPOT } from './helpers';

const FLAT = TEST_FLATS[1]; // A02

test.describe('Calendar interactions', () => {
	test('booking appears on the calendar', async ({ page }) => {
		await login(page, FLAT.number, FLAT.pin);
		const cookies = await getSessionCookie(page);
		const tomorrow = getTomorrowDate();

		// Create a booking via API
		const res = await createBookingViaAPI(
			page.request,
			cookies,
			TEST_SPOT,
			`${tomorrow}T09:00:00`,
			`${tomorrow}T11:00:00`
		);
		expect(res.ok()).toBeTruthy();

		// Navigate to calendar
		await page.goto('/calendar');

		// Verify an event block is visible (it shows the flat number)
		await expect(page.locator(`.ec-event:has-text("${FLAT.number}")`)).toBeVisible({ timeout: 5000 });
	});

	test('clicking an event shows popover with details', async ({ page }) => {
		await login(page, FLAT.number, FLAT.pin);
		const cookies = await getSessionCookie(page);
		const tomorrow = getTomorrowDate();

		// Create a booking
		const res = await createBookingViaAPI(
			page.request,
			cookies,
			TEST_SPOT,
			`${tomorrow}T13:00:00`,
			`${tomorrow}T15:00:00`
		);
		expect(res.ok()).toBeTruthy();

		await page.goto('/calendar');

		// Click on the event
		const event = page.locator(`.ec-event`).first();
		await event.click();

		// Verify popover appears with flat info
		await expect(page.locator('text=Annuler la réservation')).toBeVisible({ timeout: 3000 });
	});

	test('cancel a booking from the calendar popover', async ({ page }) => {
		await login(page, FLAT.number, FLAT.pin);
		const cookies = await getSessionCookie(page);
		const tomorrow = getTomorrowDate();

		// Create a booking
		const res = await createBookingViaAPI(
			page.request,
			cookies,
			TEST_SPOT,
			`${tomorrow}T16:00:00`,
			`${tomorrow}T18:00:00`
		);
		expect(res.ok()).toBeTruthy();

		await page.goto('/calendar');

		// Click on the event
		const event = page.locator(`.ec-event`).first();
		await event.click();

		// Click "Annuler la réservation"
		await page.locator('button:text("Annuler la réservation")').click();

		// Click "Confirmer" in the inline confirmation
		await page.locator('button:text("Confirmer")').click();

		// Verify success toast
		await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 });
	});
});
