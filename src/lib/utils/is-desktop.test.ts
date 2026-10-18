import { afterEach, describe, expect, it, vi } from 'vitest';
import { desktopQuery } from './is-desktop.svelte';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('desktopQuery', () => {
	it('builds the min-width query for the breakpoint', () => {
		const matchMedia = vi.fn(() => ({ matches: true }) as unknown as MediaQueryList);
		vi.stubGlobal('window', { matchMedia });
		desktopQuery(640);
		expect(matchMedia).toHaveBeenCalledWith('(min-width: 640px)');
	});

	it('returns null on the server (no window)', () => {
		vi.stubGlobal('window', undefined);
		expect(desktopQuery(640)).toBeNull();
	});
});
