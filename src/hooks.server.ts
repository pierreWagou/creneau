import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');

	if (sessionId) {
		const sessionData = await validateSession(sessionId);
		if (sessionData) {
			event.locals.user = sessionData.flat;
		} else {
			// Invalid/expired session, clear cookie
			event.cookies.delete('session', { path: '/' });
		}
	}

	return resolve(event);
};
