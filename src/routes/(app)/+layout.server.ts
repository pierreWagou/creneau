import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.flat) {
		throw redirect(302, '/login');
	}
	return { flat: locals.flat };
};
