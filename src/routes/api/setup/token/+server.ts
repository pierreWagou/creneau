import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { generateSetupToken } from '$lib/server/setup-token';
import type { RequestHandler } from './$types';

const LOCALHOST_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export const GET: RequestHandler = async ({ getClientAddress, url }) => {
	// Only allow from localhost
	const clientAddress = getClientAddress();
	if (!LOCALHOST_ADDRESSES.has(clientAddress)) {
		return json({ error: 'Accès réservé au serveur local' }, { status: 403 });
	}

	// Only allow if no flats exist (first-time setup)
	const existingFlats = await db.select().from(flat).all();
	if (existingFlats.length > 0) {
		return json({ error: "L'application est déjà configurée" }, { status: 409 });
	}

	const token = generateSetupToken();
	const setupUrl = `${url.origin}/setup?token=${token}`;

	return json({
		url: setupUrl,
		token,
		expiresIn: '15 minutes'
	});
};
