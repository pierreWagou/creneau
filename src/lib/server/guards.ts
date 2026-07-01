import { json } from '@sveltejs/kit';

export function requireAuth(locals: App.Locals): Response | null {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}
	return null;
}

export function requireAdmin(locals: App.Locals): Response | null {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}
	if (!locals.flat.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}
	return null;
}
