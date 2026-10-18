import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';

function jsonResponse(body: unknown, status: number): Response {
	return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
}

describe('apiFetch', () => {
	it('returns parsed data on success', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 1 }, 200)));
		try {
			const result = await apiFetch<{ id: number }>('/api/x');
			expect(result).toEqual({ ok: true, status: 200, data: { id: 1 }, error: null });
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('returns null data on empty success bodies instead of throwing', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
		try {
			const result = await apiFetch('/api/x');
			expect(result.ok).toBe(true);
			expect(result.data).toBeNull();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('extracts the server error message on failure', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Raté' }, 400)));
		try {
			const result = await apiFetch('/api/x');
			expect(result).toEqual({ ok: false, status: 400, data: { error: 'Raté' }, error: 'Raté' });
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('falls back when the failure body is not JSON', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })));
		try {
			const result = await apiFetch('/api/x', undefined, 'Personnalisé');
			expect(result).toEqual({ ok: false, status: 500, data: null, error: 'Personnalisé' });
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('never throws on network failure', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
		try {
			const result = await apiFetch('/api/x');
			expect(result).toEqual({ ok: false, status: 0, data: null, error: 'Erreur de connexion' });
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
