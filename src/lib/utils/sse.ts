import type { BookingWithFlat } from '$lib/types';

export interface BookingSSEHandlers {
	onCreated?: (booking: BookingWithFlat) => void;
	onCancelled?: (data: { id: number }) => void;
	onUpdated?: (booking: BookingWithFlat) => void;
}

export function createBookingSSE(handlers: BookingSSEHandlers): { destroy: () => void } {
	const source = new EventSource('/api/events');

	source.addEventListener('booking_created', (e) => {
		if (!handlers.onCreated) return;
		const booking = parseSSEPayload<BookingWithFlat>(e, 'booking_created');
		if (booking) handlers.onCreated(booking);
	});

	source.addEventListener('booking_cancelled', (e) => {
		if (!handlers.onCancelled) return;
		const data = parseSSEPayload<{ id: number }>(e, 'booking_cancelled');
		if (data) handlers.onCancelled(data);
	});

	source.addEventListener('booking_updated', (e) => {
		if (!handlers.onUpdated) return;
		const booking = parseSSEPayload<BookingWithFlat>(e, 'booking_updated');
		if (booking) handlers.onUpdated(booking);
	});

	return {
		destroy() {
			source.close();
		}
	};
}

/**
 * Parse an SSE payload without crashing the stream: malformed events are
 * logged (with type + preview) and skipped by the caller.
 */
function parseSSEPayload<T>(e: Event, name: string): T | null {
	const raw = (e as MessageEvent).data;
	if (typeof raw !== 'string') {
		console.warn(`[sse] ignoring ${name} event without string payload`);
		return null;
	}
	try {
		return JSON.parse(raw) as T;
	} catch {
		console.warn(`[sse] ignoring malformed ${name} payload: ${raw.slice(0, 80)}`);
		return null;
	}
}
