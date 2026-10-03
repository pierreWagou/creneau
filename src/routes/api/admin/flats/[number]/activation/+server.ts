import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { FlatTransitionError, inviteFlat, revokeFlatInvite } from '$lib/server/flat-state';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

/**
 * POST — Generate an activation code (inactive → pending, refresh on pending)
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		// A lot without spots must not be invited
		const held = await db.select({ number: spot.number }).from(spot).where(eq(spot.flatNumber, params.number)).all();
		if (held.length === 0) {
			return json({ error: `Attribuez d'abord une place de parking au lot ${params.number}` }, { status: 400 });
		}
		const updated = await inviteFlat(params.number);
		return json({ flat: updated });
	} catch (e) {
		if (e instanceof FlatTransitionError) {
			return json({ error: e.message }, { status: e.statusCode });
		}
		console.error('[POST /api/admin/flats/:number/activation]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

/**
 * DELETE — Revoke an activation code (pending → inactive)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const updated = await revokeFlatInvite(params.number);
		return json({ flat: updated });
	} catch (e) {
		if (e instanceof FlatTransitionError) {
			return json({ error: e.message }, { status: e.statusCode });
		}
		console.error('[DELETE /api/admin/flats/:number/activation]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
