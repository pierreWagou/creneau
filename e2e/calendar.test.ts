import { expect, test } from '@playwright/test';
import {
	createBookingViaAPI,
	getDatePlusDays,
	getSessionCookie,
	login,
	navigateTo,
	TEST_FLATS,
	TEST_SPOT
} from './helpers';

const FLAT = TEST_FLATS[1]; // A02

test.describe
	.serial('Calendar interactions', () => {
		test('booking appears on the calendar', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);
			const cookies = await getSessionCookie(page);
			const tomorrow = getDatePlusDays(3);

			// Create a booking via API (use early morning to avoid conflicts with booking tests)
			const res = await createBookingViaAPI(
				page.request,
				cookies,
				TEST_SPOT,
				`${tomorrow}T01:00:00`,
				`${tomorrow}T03:00:00`
			);
			expect(res.ok()).toBeTruthy();

			// Navigate to calendar
			await navigateTo(page, '/calendar');

			// Verify an event block is visible (it shows the flat number)
			await expect(page.locator(`.ec-event:has-text("${FLAT.number}")`)).toBeVisible({ timeout: 5000 });
		});

		test('clicking an event shows popover with details', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);
			const cookies = await getSessionCookie(page);
			const tomorrow = getDatePlusDays(3);

			// Create a booking
			const res = await createBookingViaAPI(
				page.request,
				cookies,
				TEST_SPOT,
				`${tomorrow}T03:00:00`,
				`${tomorrow}T05:00:00`
			);
			expect(res.ok()).toBeTruthy();

			await navigateTo(page, '/calendar');

			// Click on our own event (A02)
			const event = page.locator(`.ec-event:has-text("${FLAT.number}")`).first();
			await event.click();

			// Verify popover appears with cancel button (own booking)
			await expect(page.locator('text=Annuler la réservation')).toBeVisible({ timeout: 5000 });
		});

		test('cancel a booking from the calendar popover', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);
			const cookies = await getSessionCookie(page);
			const tomorrow = getDatePlusDays(3);

			// Create a booking
			const res = await createBookingViaAPI(
				page.request,
				cookies,
				TEST_SPOT,
				`${tomorrow}T05:00:00`,
				`${tomorrow}T07:00:00`
			);
			expect(res.ok()).toBeTruthy();

			await navigateTo(page, '/calendar');

			// Click on our own event (A02)
			const event = page.locator(`.ec-event:has-text("${FLAT.number}")`).first();
			await event.click();

			// Click "Annuler la réservation"
			await page.locator('button:text("Annuler la réservation")').click();

			// Click "Confirmer" in the inline confirmation
			await page.locator('button:text("Confirmer")').click();

			// Verify success toast
			await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 5000 });
		});
	});
