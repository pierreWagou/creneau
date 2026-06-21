import { expect, test } from '@playwright/test';
import { createBookingViaAPI, getDatePlusDays, getSessionCookie, login, TEST_FLATS, TEST_SPOT } from './helpers';

const FLAT = TEST_FLATS[2]; // A03

test.describe('Drag to move/resize (via PATCH API)', () => {
	test('move a booking to a new time', async ({ page }) => {
		await login(page, FLAT.number, FLAT.pin);
		const cookies = await getSessionCookie(page);
		const date = getDatePlusDays(2);

		const startTime = `${date}T14:00:00`;
		const endTime = `${date}T16:00:00`;

		// Create a booking
		const createRes = await createBookingViaAPI(page.request, cookies, TEST_SPOT, startTime, endTime);
		expect(createRes.ok()).toBeTruthy();
		const { booking } = await createRes.json();

		// PATCH to move to 16h-18h
		const patchRes = await page.request.patch(`/api/bookings/${booking.id}`, {
			headers: { 'Content-Type': 'application/json', Cookie: cookies },
			data: { startTime: `${date}T16:00:00`, endTime: `${date}T18:00:00` }
		});
		expect(patchRes.ok()).toBeTruthy();
		const { booking: updated } = await patchRes.json();
		expect(updated.startTime).toBe(`${date}T16:00:00`);
		expect(updated.endTime).toBe(`${date}T18:00:00`);
	});

	test('undo a move (PATCH back to original)', async ({ page }) => {
		await login(page, FLAT.number, FLAT.pin);
		const cookies = await getSessionCookie(page);
		const date = getDatePlusDays(2);

		const startTime = `${date}T08:00:00`;
		const endTime = `${date}T10:00:00`;

		// Create a booking
		const createRes = await createBookingViaAPI(page.request, cookies, TEST_SPOT, startTime, endTime);
		expect(createRes.ok()).toBeTruthy();
		const { booking } = await createRes.json();

		// Move it
		const patchRes = await page.request.patch(`/api/bookings/${booking.id}`, {
			headers: { 'Content-Type': 'application/json', Cookie: cookies },
			data: { startTime: `${date}T10:00:00`, endTime: `${date}T12:00:00` }
		});
		expect(patchRes.ok()).toBeTruthy();

		// Undo — move back to original
		const undoRes = await page.request.patch(`/api/bookings/${booking.id}`, {
			headers: { 'Content-Type': 'application/json', Cookie: cookies },
			data: { startTime, endTime }
		});
		expect(undoRes.ok()).toBeTruthy();
		const { booking: reverted } = await undoRes.json();
		expect(reverted.startTime).toBe(startTime);
		expect(reverted.endTime).toBe(endTime);
	});

	test('move to conflicting time returns 409', async ({ page }) => {
		await login(page, FLAT.number, FLAT.pin);
		const cookies = await getSessionCookie(page);
		const date = getDatePlusDays(2);

		// Create two bookings
		const res1 = await createBookingViaAPI(page.request, cookies, TEST_SPOT, `${date}T20:00:00`, `${date}T22:00:00`);
		const res2 = await createBookingViaAPI(page.request, cookies, TEST_SPOT, `${date}T22:00:00`, `${date}T24:00:00`);
		expect(res1.ok()).toBeTruthy();
		expect(res2.ok()).toBeTruthy();
		const { booking: booking2 } = await res2.json();

		// Try to move booking2 to overlap with booking1
		const patchRes = await page.request.patch(`/api/bookings/${booking2.id}`, {
			headers: { 'Content-Type': 'application/json', Cookie: cookies },
			data: { startTime: `${date}T20:00:00`, endTime: `${date}T22:00:00` }
		});
		expect(patchRes.status()).toBe(409);
	});

	test('resize a booking (extend end time)', async ({ page }) => {
		await login(page, FLAT.number, FLAT.pin);
		const cookies = await getSessionCookie(page);
		const date = getDatePlusDays(2);

		const startTime = `${date}T01:00:00`;
		const endTime = `${date}T02:00:00`;

		// Create a 1h booking
		const createRes = await createBookingViaAPI(page.request, cookies, TEST_SPOT, startTime, endTime);
		expect(createRes.ok()).toBeTruthy();
		const { booking } = await createRes.json();

		// Resize to 3h (extend end to 04:00)
		const patchRes = await page.request.patch(`/api/bookings/${booking.id}`, {
			headers: { 'Content-Type': 'application/json', Cookie: cookies },
			data: { startTime, endTime: `${date}T04:00:00` }
		});
		expect(patchRes.ok()).toBeTruthy();
		const { booking: resized } = await patchRes.json();
		expect(resized.startTime).toBe(startTime);
		expect(resized.endTime).toBe(`${date}T04:00:00`);
	});

	test('cannot move another user booking', async ({ page }) => {
		// Login as A03 and create a booking
		await login(page, FLAT.number, FLAT.pin);
		const cookies = await getSessionCookie(page);
		const date = getDatePlusDays(2);

		const createRes = await createBookingViaAPI(
			page.request,
			cookies,
			TEST_SPOT,
			`${date}T04:00:00`,
			`${date}T05:00:00`
		);
		expect(createRes.ok()).toBeTruthy();
		const { booking } = await createRes.json();

		// Logout and login as another flat (A01)
		await page.context().clearCookies();
		await login(page, TEST_FLATS[0].number, TEST_FLATS[0].pin);
		const otherCookies = await getSessionCookie(page);

		// Try to PATCH — should get 403
		const patchRes = await page.request.patch(`/api/bookings/${booking.id}`, {
			headers: { 'Content-Type': 'application/json', Cookie: otherCookies },
			data: { startTime: `${date}T05:00:00`, endTime: `${date}T06:00:00` }
		});
		expect(patchRes.status()).toBe(403);
	});
});
