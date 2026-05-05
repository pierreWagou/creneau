import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { generateActivationCode } from '$lib/server/auth';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user?.isAdmin) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const flats = await db
		.select({
			id: flat.id,
			number: flat.number,
			displayName: flat.displayName,
			activationCode: flat.activationCode,
			isAdmin: flat.isAdmin,
			isActive: flat.isActive,
			activatedAt: flat.activatedAt
		})
		.from(flat)
		.all();

	return json({ flats });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user?.isAdmin) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const { number } = await request.json();

	if (!number) {
		return json({ error: 'Flat number is required' }, { status: 400 });
	}

	const activationCode = generateActivationCode();

	const result = await db
		.insert(flat)
		.values({ number, activationCode })
		.returning()
		.get();

	return json({ flat: result }, { status: 201 });
};
