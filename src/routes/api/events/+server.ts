import { randomUUID } from 'node:crypto';
import { requireAuth } from '$lib/server/guards';
import { sseManager } from '$lib/server/sse';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const guard = requireAuth(locals);
	if (guard) return guard;

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
