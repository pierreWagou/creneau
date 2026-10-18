import { describe, expect, it, vi } from 'vitest';
import { resolveRedirect } from './sender';

describe('resolveRedirect', () => {
	it('is identity when no redirect is configured (production path untouched)', () => {
		const to = ['a@test.com', 'b@test.com'];
		const resolved = resolveRedirect(to, undefined);
		expect(resolved.to).toEqual(to);
		expect(resolved.headers).toEqual({});
		expect(resolved.subjectTag).toBeNull();
	});

	it('swaps every recipient for the redirect address, preserving originals', () => {
		const resolved = resolveRedirect(['a@test.com', 'b@test.com'], 'preview@wagou.fr');
		expect(resolved.to).toEqual(['preview@wagou.fr']);
		expect(resolved.headers).toEqual({ 'X-Original-To': 'a@test.com, b@test.com' });
		expect(resolved.subjectTag).toBe('[Preview]');
	});

	it('keeps an empty recipient list empty (nothing to redirect)', () => {
		const resolved = resolveRedirect([], 'preview@wagou.fr');
		expect(resolved.to).toEqual([]);
		expect(resolved.headers).toEqual({});
		expect(resolved.subjectTag).toBeNull();
	});

	it('warns and proceeds on an invalid redirect address', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const resolved = resolveRedirect(['a@test.com'], 'not-an-email');
		expect(resolved.to).toEqual(['not-an-email']);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid SMTP_REDIRECT_ALL_TO'));
		warn.mockRestore();
	});
});
