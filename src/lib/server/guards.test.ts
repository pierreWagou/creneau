import { describe, expect, it } from 'vitest';
import type { SessionFlat } from '$lib/types';
import { requireAdmin, requireAuth } from './guards';

const resident: SessionFlat = {
	number: 'A01',
	displayName: 'Test Resident',
	isAdmin: false,
	emails: ['a01@test.com'],
	phones: []
};

const admin: SessionFlat = { ...resident, number: 'B12', isAdmin: true };

describe('requireAuth', () => {
	it('returns 401 without a session flat', async () => {
		const res = requireAuth({});
		expect(res).not.toBeNull();
		expect(res!.status).toBe(401);
		expect(await res!.json()).toEqual({ error: 'Non autorisé' });
	});

	it('passes with any session flat', () => {
		expect(requireAuth({ flat: resident })).toBeNull();
	});
});

describe('requireAdmin', () => {
	it('answers 401 (not 403) when unauthenticated', async () => {
		const res = requireAdmin({});
		expect(res).not.toBeNull();
		expect(res!.status).toBe(401);
		expect(await res!.json()).toEqual({ error: 'Non autorisé' });
	});

	it('answers 403 when authenticated as a resident', async () => {
		const res = requireAdmin({ flat: resident });
		expect(res).not.toBeNull();
		expect(res!.status).toBe(403);
		expect(await res!.json()).toEqual({ error: 'Accès interdit' });
	});

	it('passes for an admin flat', () => {
		expect(requireAdmin({ flat: admin })).toBeNull();
	});
});
