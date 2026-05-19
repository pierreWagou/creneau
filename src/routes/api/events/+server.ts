import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sseManager } from '$lib/server/sse';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const clientId = randomUUID();

	const stream = new ReadableStream({
		start(controller) {
			sseManager.addClient(clientId, controller);

			// Send initial connection message
			const encoder = new TextEncoder();
			controller.enqueue(encoder.encode(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`));
		},
		cancel() {
			sseManager.removeClient(clientId);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
