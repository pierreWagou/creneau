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
		try {
			handlers.onCreated(JSON.parse(e.data) as BookingWithFlat);
		} catch {
			/* ignore malformed SSE data */
		}
	});

	source.addEventListener('booking_cancelled', (e) => {
		if (!handlers.onCancelled) return;
		try {
			handlers.onCancelled(JSON.parse(e.data));
		} catch {
			/* ignore malformed SSE data */
		}
	});

	source.addEventListener('booking_updated', (e) => {
		if (!handlers.onUpdated) return;
		try {
			handlers.onUpdated(JSON.parse(e.data) as BookingWithFlat);
		} catch {
			/* ignore malformed SSE data */
		}
	});

	return {
		destroy() {
			source.close();
		}
	};
}
