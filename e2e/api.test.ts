import { type APIRequestContext, expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN } from './helpers';

/** API-contract tests (no UI) — run last, sequential, after the fixture chain. */

async function login(request: APIRequestContext, flat: string, pin: string) {
	const res = await request.post('/api/auth/login', { data: { flatNumber: flat, pin } });
	expect(res.ok()).toBe(true);
}

test.describe('Public endpoints', () => {
	test('GET /api/health is public and reports ok', async ({ request }) => {
		const res = await request.get('/api/health');
		expect(res.status()).toBe(200);
		expect(await res.json()).toEqual({ status: 'ok' });
	});

	test('GET /api/flats/:number exposes only the public fields', async ({ request }) => {
		const res = await request.get(`/api/flats/${ADMIN_FLAT}`);
		expect(res.status()).toBe(200);

		const body = await res.json();
		expect(Object.keys(body).sort()).toEqual(['displayName', 'number']);
		expect(body.number).toBe(ADMIN_FLAT);
		// Nothing auth-related leaks on this public lookup
		expect(JSON.stringify(body)).not.toMatch(/pin|activation|hash|password/i);
	});

	test('GET /api/flats/:number 404s an unknown lot', async ({ request }) => {
		const res = await request.get('/api/flats/Z99');
		expect(res.status()).toBe(404);
		expect(await res.json()).toEqual({ error: 'Lot introuvable' });
	});
});

test.describe('Self-service account', () => {
	test('PATCH /api/account rejects an anonymous caller with 401', async ({ request }) => {
		const res = await request.patch('/api/account', { data: { displayName: 'Nope' } });
		expect(res.status()).toBe(401);
		expect(await res.json()).toEqual({ error: 'Non autorisé' });
	});

	test('PATCH /api/account updates name and contacts, then restores them', async ({ request }) => {
		await login(request, ADMIN_FLAT, ADMIN_PIN);

		// Empty PATCH is a no-op read: no key present ⟹ no write, current state returned
		const before = (await (await request.patch('/api/account', { data: {} })).json()).flat;

		try {
			const res = await request.patch('/api/account', {
				data: {
					displayName: 'Nom de test',
					emails: ['admin@test.com'],
					phones: ['+33612345678']
				}
			});
			expect(res.status()).toBe(200);

			const body = (await res.json()).flat;
			expect(body.displayName).toBe('Nom de test');
			expect(body.emails).toEqual(['admin@test.com']);
			expect(body.phones).toEqual(['+33612345678']);
		} finally {
			// Restore exactly what was there — never leave the admin profile emptied
			await request.patch('/api/account', {
				data: {
					displayName: before.displayName,
					emails: before.emails ?? [],
					phones: before.phones ?? []
				}
			});
		}
	});

	test('PATCH /api/account validates name and contact formats', async ({ request }) => {
		await login(request, ADMIN_FLAT, ADMIN_PIN);

		const tooLong = await request.patch('/api/account', {
			data: { displayName: 'x'.repeat(51) }
		});
		expect(tooLong.status()).toBe(400);
		expect((await tooLong.json()).error).toContain('ne doit pas dépasser');

		const badEmail = await request.patch('/api/account', { data: { emails: ['not-an-email'] } });
		expect(badEmail.status()).toBe(400);
		expect((await badEmail.json()).error).toContain('Email invalide');

		const badPhone = await request.patch('/api/account', { data: { phones: ['abc'] } });
		expect(badPhone.status()).toBe(400);
		expect((await badPhone.json()).error).toContain('Téléphone invalide');
	});

	test('POST /api/account (PIN change) enforces auth and input rules', async ({ request }) => {
		const anonymous = await request.post('/api/account', {
			data: { currentPin: ADMIN_PIN, newPin: '4321' }
		});
		expect(anonymous.status()).toBe(401);

		await login(request, ADMIN_FLAT, ADMIN_PIN);

		const missing = await request.post('/api/account', { data: { newPin: '4321' } });
		expect(missing.status()).toBe(400);
		expect((await missing.json()).error).toContain('obligatoires');

		const invalid = await request.post('/api/account', {
			data: { currentPin: ADMIN_PIN, newPin: '12' }
		});
		expect(invalid.status()).toBe(400);
		expect((await invalid.json()).error).toMatch(/PIN/i);

		const wrongCurrent = await request.post('/api/account', {
			data: { currentPin: '9999', newPin: '4321' }
		});
		expect(wrongCurrent.status()).toBe(401);
		expect((await wrongCurrent.json()).error).toContain('PIN');
	});

	test('POST /api/account rotates the PIN and back', async ({ request }) => {
		const temporary = '4321';
		await login(request, ADMIN_FLAT, ADMIN_PIN);

		try {
			const changed = await request.post('/api/account', {
				data: { currentPin: ADMIN_PIN, newPin: temporary }
			});
			expect(changed.status()).toBe(200);

			// The old PIN must stop working
			const oldPin = await request.post('/api/auth/login', {
				data: { flatNumber: ADMIN_FLAT, pin: ADMIN_PIN }
			});
			expect(oldPin.status()).toBe(401);

			// …and the new one must
			await request.post('/api/auth/logout');
			await login(request, ADMIN_FLAT, temporary);
		} finally {
			// Restore the suite's documented admin PIN, whichever PIN is live now
			const current = [temporary, ADMIN_PIN];
			for (const pin of current) {
				await request.post('/api/auth/logout');
				const res = await request.post('/api/auth/login', {
					data: { flatNumber: ADMIN_FLAT, pin }
				});
				if (!res.ok()) continue;
				if (pin !== ADMIN_PIN) {
					await request.post('/api/account', {
						data: { currentPin: pin, newPin: ADMIN_PIN }
					});
				}
				break;
			}
		}
	});
});
