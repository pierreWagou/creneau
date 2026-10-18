import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { inviteFlat, revokeFlatInvite } from '$lib/server/flat-state';
import { requireAdmin } from '$lib/server/guards';
import { errorJson, handleHandlerError } from '$lib/server/handler';
import { normalizeFlatNumber } from '$lib/validation';
import type { RequestHandler } from './$types';

/**
 * POST — Generate an activation code (inactive → pending, refresh on pending)
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		// A lot without spots must not be invited
		const held = await db
			.select({ number: spot.number })
			.from(spot)
			.where(eq(spot.flatNumber, normalizeFlatNumber(params.number ?? '')))
			.all();
		if (held.length === 0) {
			return errorJson(`Attribuez d'abord une place de parking au lot ${params.number}`, 400);
		}
		const updated = await inviteFlat(normalizeFlatNumber(params.number ?? ''));
		return json({ flat: updated });
	} catch (e) {
		return handleHandlerError('POST /api/admin/flats/:number/activation', e);
	}
};

/**
 * DELETE — Revoke an activation code (pending → inactive)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const updated = await revokeFlatInvite(normalizeFlatNumber(params.number ?? ''));
		return json({ flat: updated });
	} catch (e) {
		return handleHandlerError('DELETE /api/admin/flats/:number/activation', e);
	}
};
