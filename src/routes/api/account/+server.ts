import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { DISPLAY_NAME_MAX_LENGTH } from '$lib/constants';
import { hashPin, PIN_MAX_LENGTH, PIN_MIN_LENGTH, verifyPin } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/**
 * PATCH /api/account — Update display name
 */
export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const allowedFields: Record<string, unknown> = {};

		if ('displayName' in body) {
			const name = body.displayName?.trim() || null;
			if (name && name.length > DISPLAY_NAME_MAX_LENGTH) {
				return json({ error: `Le nom ne peut pas dépasser ${DISPLAY_NAME_MAX_LENGTH} caractères` }, { status: 400 });
			}
			allowedFields.displayName = name;
		}

		if (Object.keys(allowedFields).length === 0) {
			return json({ error: 'Aucun champ valide à mettre à jour' }, { status: 400 });
		}

		await db.update(flat).set(allowedFields).where(eq(flat.id, locals.flat.id));

		return json({ success: true });
	} catch (e) {
		console.error('[PATCH /api/account]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

/**
 * POST /api/account — Change PIN
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	try {
		const { currentPin, newPin } = await request.json();

		if (!currentPin || !newPin) {
			return json({ error: 'PIN actuel et nouveau PIN requis' }, { status: 400 });
		}

		if (newPin.length < PIN_MIN_LENGTH || newPin.length > PIN_MAX_LENGTH) {
			return json(
				{ error: `Le PIN doit contenir entre ${PIN_MIN_LENGTH} et ${PIN_MAX_LENGTH} chiffres` },
				{ status: 400 }
			);
		}

		if (!/^\d+$/.test(newPin)) {
			return json({ error: 'Le PIN ne doit contenir que des chiffres' }, { status: 400 });
		}

		// Fetch current pin hash
		const user = await db.select().from(flat).where(eq(flat.id, locals.flat.id)).get();
		if (!user?.pinHash) {
			return json({ error: 'Utilisateur introuvable' }, { status: 404 });
		}

		// Verify current PIN
		const valid = await verifyPin(currentPin, user.pinHash);
		if (!valid) {
			return json({ error: 'PIN actuel incorrect' }, { status: 403 });
		}

		// Hash and save new PIN
		const newHash = await hashPin(newPin);
		await db.update(flat).set({ pinHash: newHash }).where(eq(flat.id, locals.flat.id));

		return json({ success: true });
	} catch (e) {
		console.error('[POST /api/account]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
