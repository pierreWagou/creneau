import { expect, test } from '@playwright/test';
import {
	cancelBookingViaAPI,
	createBookingViaAPI,
	getSessionCookie,
	getTomorrowDate,
	login,
	navigateTo,
	TEST_FLATS,
	TEST_SPOT
} from './helpers';

const FLAT = TEST_FLATS[1]; // A02

test.describe
	.serial('Calendar interactions', () => {
		// Cancel any booking created in the test so retries don't hit a conflict
		let lastBookingId: number | null = null;
		let lastCookies: string = '';

		test.afterEach(async ({ page }) => {
			if (lastBookingId !== null) {
				await cancelBookingViaAPI(page.request, lastCookies, lastBookingId);
				lastBookingId = null;
			}
		});

		test('booking appears on the calendar', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);
			const cookies = await getSessionCookie(page);
			lastCookies = cookies;
			const tomorrow = getTomorrowDate();

			// Create a booking via API (use midday to be visible without scrolling)
			const res = await createBookingViaAPI(
				page.request,
				cookies,
				TEST_SPOT,
				`${tomorrow}T12:00:00`,
				`${tomorrow}T14:00:00`
			);
			expect(res.ok()).toBeTruthy();
			const { booking } = await res.json();
			lastBookingId = booking.id;

			// Navigate to calendar with tomorrow's date so the week is always correct
			await navigateTo(page, `/calendar?date=${tomorrow}`);

			// Verify an event block is visible (it shows the flat number)
			await expect(page.locator(`.ec-event:has-text("${FLAT.number}")`)).toBeVisible({ timeout: 10000 });
		});

		test('clicking an event opens the booking drawer with details', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);
			const cookies = await getSessionCookie(page);
			lastCookies = cookies;
			const tomorrow = getTomorrowDate();

			// Create a booking
			const res = await createBookingViaAPI(
				page.request,
				cookies,
				TEST_SPOT,
				`${tomorrow}T14:00:00`,
				`${tomorrow}T16:00:00`
			);
			expect(res.ok()).toBeTruthy();
			const { booking } = await res.json();
			lastBookingId = booking.id;

			await navigateTo(page, `/calendar?date=${tomorrow}`);

			// Click on our own event (A02)
			const event = page.locator(`.ec-event:has-text("${FLAT.number}")`).first();
			await event.click();

			// Verify the shared drawer opens with details + owner actions
			await expect(page.locator(`text=Réservation #${booking.id}`)).toBeVisible({ timeout: 5000 });
			await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeVisible();
		});

		test('cancel a booking from the calendar drawer', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);
			const cookies = await getSessionCookie(page);
			lastCookies = cookies;
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
			const { booking } = await res.json();
			lastBookingId = booking.id;

			await navigateTo(page, `/calendar?date=${tomorrow}`);

			// Click on our own event (A02)
			const event = page.locator(`.ec-event:has-text("${FLAT.number}")`).first();
			await event.click();

			// Drawer footer Annuler, then confirm in the dialog
			await page.getByRole('button', { name: 'Annuler' }).click();
			await page.getByRole('button', { name: 'Annuler la réservation' }).click();

			// Booking was cancelled via UI — no need for afterEach cleanup
			lastBookingId = null;

			// Verify success toast
			await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 5000 });
		});
	});
