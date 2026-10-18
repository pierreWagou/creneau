import { expect, type Page, test } from '@playwright/test';
import {
	ADMIN_FLAT,
	ADMIN_PIN,
	ensureSpots,
	getDatePlusDays,
	getSessionCookie,
	login,
	navigateTo,
	TEST_FLATS
} from './helpers';

const FLAT = TEST_FLATS[0]; // A01
const SPOT = '21'; // Self-owned: B24 holds 91 from the admin suite, so this file claims its own pool spot
const RUN = Date.now();

async function createBooking(page: Page, cookie: string, dayOffset: number, note: string): Promise<number> {
	const date = getDatePlusDays(dayOffset);
	const res = await page.request.post('/api/bookings', {
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		data: { spotNumber: SPOT, startTime: `${date}T10:00:00`, endTime: `${date}T11:00:00`, note }
	});
	expect(res.ok()).toBeTruthy();
	const { booking } = await res.json();
	return booking.id as number;
}

async function loginAsFlat(page: Page): Promise<string> {
	await login(page, FLAT.number, FLAT.pin);
	return getSessionCookie(page);
}

async function loginAsAdmin(page: Page) {
	await login(page, ADMIN_FLAT, ADMIN_PIN);
	await ensureSpots(page, [SPOT]);
}

async function searchMarker(page: Page, marker: string) {
	await page.getByPlaceholder('Rechercher…').fill(marker);
}

test.describe
	.serial('Admin reservations tab', () => {
		test('admin sees the tab and all flats bookings with owners', async ({ page }) => {
			const marker = `ab-${RUN}-list`;
			await loginAsAdmin(page);
			const cookie = await loginAsFlat(page);
			await createBooking(page, cookie, 30, marker);
			await loginAsAdmin(page);

			await navigateTo(page, '/admin/bookings');
			await expect(page.getByRole('link', { name: 'Réservations', exact: true })).toBeVisible();
			await searchMarker(page, marker);
			const card = page.locator('[data-booking-id]').first();
			await expect(card).toBeVisible();
			// Owner lot lives in the detail drawer (cards show spot/slot only)
			await card.click();
			const drawer = page.locator('[role="dialog"]');
			await expect(drawer.getByText(`Lot ${FLAT.number}`, { exact: true })).toBeVisible();
			await page.keyboard.press('Escape');
		});

		test('non-admins are redirected to the calendar', async ({ page }) => {
			await loginAsFlat(page);
			await navigateTo(page, '/admin/bookings');
			await expect(page).toHaveURL(/\/calendar/);
		});

		test('drawer shows lot and note, deep link highlights the card', async ({ page }) => {
			const marker = `ab-${RUN}-drawer`;
			await loginAsAdmin(page);
			const cookie = await loginAsFlat(page);
			const id = await createBooking(page, cookie, 31, marker);
			await loginAsAdmin(page);

			await navigateTo(page, '/admin/bookings');
			await searchMarker(page, marker);
			await page.locator(`[data-booking-id="${id}"]`).click();
			await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible();

			await navigateTo(page, `/admin/bookings?booking=${id}`);
			// Deep link auto-opens the drawer (admin-only behavior) on the
			// highlighted card.
			await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible();
			await expect(page.locator(`[data-booking-id="${id}"] .ring-2`)).toBeVisible();
		});

		test('admin cancels a booking from the drawer', async ({ page }) => {
			const marker = `ab-${RUN}-cancel`;
			await loginAsAdmin(page);
			const cookie = await loginAsFlat(page);
			const id = await createBooking(page, cookie, 32, marker);
			await loginAsAdmin(page);

			await navigateTo(page, '/admin/bookings');
			await searchMarker(page, marker);
			await page.locator(`[data-booking-id="${id}"]`).click();
			await page.getByRole('button', { name: 'Annuler' }).click();
			await page.getByRole('button', { name: 'Annuler la réservation' }).click();
			await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 5000 });

			await searchMarker(page, marker);
			// Cancelled bookings soft-delete: the card stays, marked Annulée
			const cancelledCard = page.locator(`[data-booking-id="${id}"]`);
			await expect(cancelledCard).toBeVisible();
			await expect(cancelledCard.getByText('Annulée', { exact: true })).toBeVisible();
		});
	});
