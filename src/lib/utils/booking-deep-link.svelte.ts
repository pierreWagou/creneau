import { tick } from 'svelte';
import { page } from '$app/state';

/**
 * Booking drawer deep link (`?booking=id`) shared by Mes réservations and the
 * admin reservations tab: highlight ring + scroll into view. Auto-open + URL
 * sync live in the admin page only (lot/spot parity); my-bookings keeps
 * highlight-only. Unknown ids degrade to the plain list.
 * Must be called at component top level (runes init context).
 */
export function createBookingDeepLink(param = 'booking') {
	const highlightedId = $derived(page.url.searchParams.get(param));

	function scrollToHighlighted() {
		const id = highlightedId;
		if (!id) return;
		tick()
			.then(() => {
				document.querySelector(`[data-booking-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center' });
			})
			.catch(() => {
				// Element gone mid-flight (list re-rendered) — highlight simply doesn't scroll.
			});
	}

	return {
		get highlightedId() {
			return highlightedId;
		},
		scrollToHighlighted
	};
}
