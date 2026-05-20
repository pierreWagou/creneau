import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { validateSetupToken } from '$lib/server/setup-token';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// If flats already exist, setup is done — redirect to login
	const existingFlats = await db.select().from(flat).all();
	if (existingFlats.length > 0) {
		throw redirect(302, '/login');
	}

	// Check for valid setup token in URL
	const token = url.searchParams.get('token');
	if (!token || !validateSetupToken(token)) {
		return { locked: true, token: null };
	}

	return { locked: false, token };
};
