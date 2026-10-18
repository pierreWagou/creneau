import { beforeEach, describe, expect, it, vi } from 'vitest';

const urlHolder = { url: new URL('http://x.test/my-bookings?booking=7') };

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return urlHolder.url;
		}
	}
}));

import { createBookingDeepLink } from './booking-deep-link.svelte';

beforeEach(() => {
	vi.unstubAllGlobals();
	urlHolder.url = new URL('http://x.test/my-bookings?booking=7');
});

function stubDocument(found: boolean): {
	scrollIntoView: ReturnType<typeof vi.fn>;
	querySelector: ReturnType<typeof vi.fn>;
} {
	const scrollIntoView = vi.fn();
	const querySelector = vi.fn(() => (found ? { scrollIntoView } : null));
	vi.stubGlobal('document', { querySelector });
	vi.stubGlobal('CSS', { escape: (s: string) => s });
	return { scrollIntoView, querySelector };
}

describe('createBookingDeepLink', () => {
	it('reads the highlighted id from the URL', () => {
		const deepLink = createBookingDeepLink();
		expect(deepLink.highlightedId).toBe('7');
	});

	it('scrolls the highlighted row into view', async () => {
		const { scrollIntoView, querySelector } = stubDocument(true);
		const deepLink = createBookingDeepLink();
		deepLink.scrollToHighlighted();
		await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' }));
		expect(querySelector).toHaveBeenCalledWith('[data-booking-id="7"]');
	});

	it('degrades silently for unknown ids (no matching row)', async () => {
		const { scrollIntoView } = stubDocument(false);
		const deepLink = createBookingDeepLink();
		expect(() => deepLink.scrollToHighlighted()).not.toThrow();
		await Promise.resolve();
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	it('does nothing without the param', () => {
		urlHolder.url = new URL('http://x.test/my-bookings');
		const querySelector = vi.fn();
		vi.stubGlobal('document', { querySelector });
		const deepLink = createBookingDeepLink();
		expect(deepLink.highlightedId).toBeNull();
		deepLink.scrollToHighlighted();
		expect(querySelector).not.toHaveBeenCalled();
	});
});
