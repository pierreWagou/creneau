import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { hashPin, createSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { flatNumber, activationCode, displayName, pin } = await request.json();

	// Validate input
	if (!flatNumber || !activationCode || !pin) {
		return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
	}

	if (pin.length < 4 || pin.length > 6) {
		return json({ error: 'Le PIN doit contenir 4 à 6 chiffres' }, { status: 400 });
	}

	// Find the flat
	const existingFlat = await db
		.select()
		.from(flat)
		.where(and(eq(flat.number, flatNumber), eq(flat.activationCode, activationCode)))
		.get();

	if (!existingFlat) {
		return json({ error: "Numéro d'appartement ou code d'activation invalide" }, { status: 401 });
	}

	if (existingFlat.isActive) {
		return json({ error: 'Cet appartement a déjà été activé' }, { status: 409 });
	}

	// Activate the flat
	const pinHash = await hashPin(pin);
	await db
		.update(flat)
		.set({
			displayName: displayName || null,
			pinHash,
			isActive: true,
			activatedAt: new Date().toISOString()
		})
		.where(eq(flat.id, existingFlat.id));

	// Create session
	const sessionId = await createSession(existingFlat.id);

	cookies.set('session', sessionId, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 30 * 24 * 60 * 60 // 30 days
	});

	return json({
		success: true,
		flat: {
			number: existingFlat.number,
			displayName: displayName || null,
			isAdmin: existingFlat.isAdmin
		}
	});
};
