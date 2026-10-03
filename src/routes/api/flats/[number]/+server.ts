import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/**
 * Public display-name lookup for the activation screen.
 * Returns only number + displayName (no contacts, codes, or PIN material).
 * No rate limit: read-only, same data class as the public login combobox.
 */
export const GET: RequestHandler = async ({ params }) => {
	const number = (params.number ?? '').trim().toUpperCase();
	if (!number) {
		return json({ error: 'Numéro de lot manquant' }, { status: 400 });
	}

	const found = await db
		.select({ number: flat.number, displayName: flat.displayName })
		.from(flat)
		.where(eq(flat.number, number))
		.get();

	if (!found) {
		return json({ error: 'Lot introuvable' }, { status: 404 });
	}

	return json({ number: found.number, displayName: found.displayName });
};
