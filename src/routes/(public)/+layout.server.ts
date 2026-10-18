import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Optional auth: guests keep full access, connected users get the classic toolbar.
	return { flat: locals.flat ?? null };
};
