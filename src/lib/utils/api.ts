/** Typed fetch result: parsed JSON (or null when the body isn't JSON). */
interface ApiResult<T = unknown> {
	ok: boolean;
	status: number;
	data: T | null;
	/** Server `{ error }` message, or `fallback` when the body carries none. Null on success. */
	error: string | null;
}

/**
 * JSON fetch with safe body parsing and unified error extraction.
 * Returns the server `{ error }` message on failure, `fallback` when the body
 * is missing or unparseable (e.g. network failure) — never throws.
 * Network-down, CORS, and abort all collapse to `status: 0` + the fallback
 * by design (callers treat every failure as retryable-by-hand, never auto).
 */
export async function apiFetch<T = unknown>(
	url: string,
	init?: RequestInit,
	fallback = 'Erreur de connexion'
): Promise<ApiResult<T>> {
	try {
		const res = await fetch(url, init);
		const data = (await res.json().catch(() => null)) as T | null;
		if (res.ok) return { ok: true, status: res.status, data, error: null };
		const body = data as { error?: unknown } | null;
		const message = body && typeof body.error === 'string' ? body.error : fallback;
		return { ok: false, status: res.status, data, error: message };
	} catch {
		return { ok: false, status: 0, data: null, error: fallback };
	}
}
