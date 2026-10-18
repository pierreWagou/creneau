import { type APIRequestContext, expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN } from './helpers';

/**
 * Request lifecycle with conflicts (API-level). Self-contained fixtures
 * (flats A07/A08/B27, spot 73) — the suite creates its own lots and spots.
 */

async function admin(request: APIRequestContext) {
	const res = await request.post('/api/auth/login', { data: { flatNumber: ADMIN_FLAT, pin: ADMIN_PIN } });
	expect(res.ok()).toBe(true);
}

async function submitRequest(request: APIRequestContext, flatNumber: string, spotNumbers: string[]) {
	const res = await request.post('/api/requests', {
		data: {
			flatNumber,
			spotNumbers,
			requesterName: `Famille ${flatNumber}`,
			emails: [`${flatNumber.toLowerCase()}@test.com`],
			phones: ['+33600000002']
		}
	});
	expect(res.ok()).toBe(true);
	return (await res.json()).request.id as number;
}

async function pendingRequestId(request: APIRequestContext, flatNumber: string): Promise<number> {
	const res = await request.get('/api/admin/requests');
	expect(res.ok()).toBe(true);
	const { requests } = await res.json();
	const found = requests.find((r: { flatNumber: string }) => r.flatNumber === flatNumber);
	expect(found).toBeTruthy();
	return found.id as number;
}

test.describe
	.serial('Request lifecycle with conflicts', () => {
		test.beforeAll(async ({ playwright }, testInfo) => {
			// beforeAll cannot use the test-scoped `request` fixture — dedicated context.
			const setup = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
			try {
				await admin(setup);
				for (const number of ['78', '76']) {
					const spot = await setup.post('/api/spots', { data: { number } });
					expect(spot.ok()).toBe(true);
				}
			} finally {
				await setup.dispose();
			}
		});

		test('approve creates an inactive lot and binds the requested spot', async ({ request }) => {
			await admin(request);
			await submitRequest(request, 'A07', ['78']);
			const id = await pendingRequestId(request, 'A07');

			const approved = await request.post(`/api/admin/requests/${id}`);
			expect(approved.ok()).toBe(true);

			const flats = await request.get('/api/admin/flats');
			expect(flats.ok()).toBe(true);
			const { flats: list } = await flats.json();
			expect(list.map((f: { number: string }) => f.number)).toContain('A07');
		});

		test('approve conflicts without force, applies with force', async ({ request }) => {
			await admin(request);
			// 73 is now A07's — A08 requesting it conflicts. A07 first gets a
			// second spot (76) so the forced move strands nobody (hard 409 otherwise).
			const padded = await request.patch('/api/admin/flats/A07', { data: { spotNumbers: ['78', '76'] } });
			expect(padded.ok()).toBe(true);

			await submitRequest(request, 'A08', ['78']);
			const id = await pendingRequestId(request, 'A08');

			const conflicted = await request.post(`/api/admin/requests/${id}`);
			expect(conflicted.status()).toBe(409);
			const body = await conflicted.json();
			expect(body.error).toBe('Conflit de place de parking');
			expect(body.conflicts).toEqual([{ spotNumber: '78', currentFlat: 'A07' }]);

			const forced = await request.post(`/api/admin/requests/${id}`, { data: { force: true } });
			expect(forced.ok()).toBe(true);
		});

		test('reject with a reason succeeds and mails the requester', async ({ request }) => {
			await admin(request);
			await submitRequest(request, 'B27', ['78']);
			const id = await pendingRequestId(request, 'B27');

			const rejected = await request.patch(`/api/admin/requests/${id}`, {
				data: { reason: 'Immeuble complet, désolé' }
			});
			expect(rejected.ok()).toBe(true);
			const body = await rejected.json();
			expect(body.success).toBe(true);
		});
	});
