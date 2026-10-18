import { type APIRequestContext, expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN, createFlatViaAPI } from './helpers';

/**
 * Bourse aux places + single-spot swap + force-retry flows (API-level).
 * Self-contained fixtures (flats A06/A09, spots 97-99) so the suite never
 * depends on other projects' holdings. Runs serially: holdings evolve.
 */

async function admin(request: APIRequestContext) {
	const res = await request.post('/api/auth/login', { data: { flatNumber: ADMIN_FLAT, pin: ADMIN_PIN } });
	expect(res.ok()).toBe(true);
}

test.describe
	.serial('Bourse aux places and swap strand rule', () => {
		test.beforeAll(async ({ playwright }, testInfo) => {
			// beforeAll cannot use the test-scoped `request` fixture — dedicated context.
			const setup = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
			try {
				await admin(setup);
				// Fresh spots (creation lands unassigned) then two single-spot lots
				for (const number of ['97', '98', '99', '75']) {
					const res = await setup.post('/api/spots', { data: { number } });
					expect(res.ok()).toBe(true);
				}
				await createFlatViaAPI(setup, { number: 'A06', spotNumbers: ['97'] });
				await createFlatViaAPI(setup, { number: 'A09', spotNumbers: ['98'] });
			} finally {
				await setup.dispose();
			}
		});

		test('moves applies an A↔B swap atomically (each leg alone looks like a conflict)', async ({ request }) => {
			await admin(request);
			const res = await request.post('/api/admin/spots/moves', {
				data: {
					moves: [
						{ spotNumber: '97', to: { type: 'flat', flatNumber: 'A09' } },
						{ spotNumber: '98', to: { type: 'flat', flatNumber: 'A06' } }
					]
				}
			});
			expect(res.ok()).toBe(true);
			expect(await res.json()).toEqual({ updated: 2 });
		});

		test('moves refuses to strand a lot at 0 spots (hard 409, no force)', async ({ request }) => {
			await admin(request);
			// A06 now holds only 98 — moving it to the pool would strand the lot
			const res = await request.post('/api/admin/spots/moves', {
				data: { moves: [{ spotNumber: '98', to: { type: 'shared' } }] }
			});
			expect(res.status()).toBe(409);
			expect(await res.json()).toEqual({
				error: "Impossible de réaffecter la place de parking 98 — le lot A06 n'aurait plus de place de parking"
			});
		});

		test('swap refuses to release the flat last spot (new strand guard)', async ({ request }) => {
			await admin(request);
			// 99 is shared; 98 is A06's only spot — the released leg would strand A06
			const refused = await request.post('/api/admin/spots/swap', {
				data: { spotNumber: '99', flatNumber: 'A06', targetSpotNumber: '98' }
			});
			expect(refused.status()).toBe(409);

			// Give A06 a second spot (75 is unassigned — no holder to strand),
			// then the same swap succeeds and 98 lands unassigned
			const rebalanced = await request.post('/api/admin/spots/moves', {
				data: { moves: [{ spotNumber: '75', to: { type: 'flat', flatNumber: 'A06' } }] }
			});
			expect(rebalanced.ok()).toBe(true);
			const swapped = await request.post('/api/admin/spots/swap', {
				data: { spotNumber: '99', flatNumber: 'A06', targetSpotNumber: '98' }
			});
			expect(swapped.ok()).toBe(true);
		});

		test('flat spot rebind answers 409 conflicts without force, applies with force', async ({ request }) => {
			await admin(request);
			// 99 is now A06's (swap result) — A09 grabbing it unforced is a conflict
			const conflicted = await request.patch('/api/admin/flats/A09', { data: { spotNumbers: ['99'] } });
			expect(conflicted.status()).toBe(409);
			const body = await conflicted.json();
			expect(body.error).toBe('Conflit de place de parking');
			expect(body.conflicts).toEqual([{ spotNumber: '99', currentFlat: 'A06' }]);

			// A06 keeps 75, so the forced move strands nobody
			const forced = await request.patch('/api/admin/flats/A09', { data: { spotNumbers: ['99'], force: true } });
			expect(forced.ok()).toBe(true);
		});
	});
