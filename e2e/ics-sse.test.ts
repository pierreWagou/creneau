import { type APIRequestContext, expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN, getDatePlusDays, login, navigateTo } from './helpers';

/**
 * ICS download + SSE live stream (mixed API/page). Self-contained fixtures:
 * shared spot 74, booking owned by A01 (activated earlier in the chain).
 */

async function admin(request: APIRequestContext) {
	const res = await request.post('/api/auth/login', { data: { flatNumber: ADMIN_FLAT, pin: ADMIN_PIN } });
	expect(res.ok()).toBe(true);
}

async function resident(request: APIRequestContext) {
	const res = await request.post('/api/auth/login', { data: { flatNumber: 'A01', pin: '1234' } });
	expect(res.ok()).toBe(true);
}

test.describe
	.serial('ICS download and SSE stream', () => {
		let bookingId = 0;

		test.beforeAll(async ({ playwright }, testInfo) => {
			// beforeAll cannot use the test-scoped `request` fixture — dedicated context.
			const setup = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
			try {
				await admin(setup);
				// Shared spot 74: creation lands unassigned, then route it to the pool
				const created = await setup.post('/api/spots', { data: { number: '74' } });
				expect(created.ok()).toBe(true);
				const shared = await setup.patch('/api/spots/74', { data: { status: 'shared' } });
				expect(shared.ok()).toBe(true);
			} finally {
				await setup.dispose();
			}
		});

		test('booking a shared spot then downloading its ICS invite', async ({ request }) => {
			await resident(request);
			const day = getDatePlusDays(30);
			const booked = await request.post('/api/bookings', {
				data: { spotNumber: '74', startTime: `${day}T10:00:00`, endTime: `${day}T12:00:00` }
			});
			expect(booked.status()).toBe(201);
			bookingId = ((await booked.json()).booking.id as number) ?? 0;
			expect(bookingId).toBeGreaterThan(0);

			const ics = await request.get(`/api/bookings/${bookingId}/ics`);
			expect(ics.status()).toBe(200);
			expect(ics.headers()['content-type']).toContain('text/calendar');
			const body = await ics.text();
			expect(body).toContain('BEGIN:VCALENDAR');
			expect(body).toContain('METHOD:PUBLISH');
			expect(body).toContain('74');
		});

		test('deep link highlights the booked card', async ({ page }) => {
			await login(page, 'A01', '1234');
			await navigateTo(page, `/my-bookings?booking=${bookingId}`);
			const card = page.locator(`[data-booking-id="${bookingId}"]`);
			await expect(card.first()).toBeVisible();
		});

		test('SSE stream opens with a connected event', async ({ page }) => {
			await login(page, 'A01', '1234');
			await navigateTo(page, '/calendar');
			const first = await page.evaluate(async () => {
				const ctrl = new AbortController();
				try {
					const res = await fetch('/api/events', { signal: ctrl.signal });
					const reader = res.body?.getReader();
					if (!reader) return '';
					const { value } = await reader.read();
					ctrl.abort();
					await reader.cancel().catch(() => {});
					return new TextDecoder().decode(value);
				} catch {
					return '';
				}
			});
			expect(first).toContain('event: connected');
		});
	});
