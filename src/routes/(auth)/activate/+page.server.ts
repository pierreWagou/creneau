import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.flat) {
		throw redirect(302, '/calendar');
	}

	// If no flats exist, redirect to setup wizard
	const existingFlats = await db.select().from(flat).all();
	if (existingFlats.length === 0) {
		throw redirect(302, '/setup');
	}

	const flatNumber = url.searchParams.get('flat') || '';
	const code = url.searchParams.get('code') || '';

	let displayName = '';
	if (flatNumber) {
		const flatInfo = await db
			.select({ displayName: flat.displayName })
			.from(flat)
			.where(eq(flat.number, flatNumber))
			.get();
		displayName = flatInfo?.displayName || '';
	}

	return {
		prefill: {
			flat: flatNumber,
			code,
			displayName
		}
	};
};
