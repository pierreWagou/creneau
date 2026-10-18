import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Optional auth: guests keep full access, connected users get the classic toolbar
	// (including on the root error page, which reads page.data.flat).
	return { flat: locals.flat ?? null };
};
