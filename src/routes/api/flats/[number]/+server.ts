import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { errorJson, handleHandlerError } from '$lib/server/handler';
import type { RequestHandler } from './$types';

/**
 * Public display-name lookup for the activation screen.
 * Returns only number + displayName (no contacts, codes, or PIN material).
 * No rate limit: read-only, same data class as the public login combobox.
 */
export const GET: RequestHandler = async ({ params }) => {
	const number = (params.number ?? '').trim().toUpperCase();
	if (!number) {
		return errorJson('Numéro de lot manquant', 400);
	}

	try {
		const found = await db
			.select({ number: flat.number, displayName: flat.displayName })
			.from(flat)
			.where(eq(flat.number, number))
			.get();

		if (!found) {
			return errorJson('Lot introuvable', 404);
		}

		return json({ number: found.number, displayName: found.displayName });
	} catch (e) {
		return handleHandlerError('GET /api/flats/:number', e);
	}
};
