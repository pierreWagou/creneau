import { errorJson } from '$lib/server/handler';

export function requireAuth(locals: App.Locals): Response | null {
	if (!locals.flat) {
		return errorJson('Non autorisé', 401);
	}
	return null;
}

export function requireAdmin(locals: App.Locals): Response | null {
	if (!locals.flat) {
		return errorJson('Non autorisé', 401);
	}
	if (!locals.flat.isAdmin) {
		return errorJson('Accès interdit', 403);
	}
	return null;
}
