import { toast } from 'svelte-sonner';

/** Delivery failed but the action succeeded — failure-only mail receipt. */
export const MAIL_FAILED_WARNING = "L'envoi de l'email a échoué — vérifiez la configuration du serveur mail";

/** Generic mutation fallback when the server gives no message. */
export const UPDATE_FAILED = 'Erreur lors de la mise à jour';

/** Warn on mail failure (no-op on success — keeps the receipt one-liner). */
export function notifyMailFailed(mailFailed?: boolean): void {
	if (mailFailed) toast.warning(MAIL_FAILED_WARNING);
}

/**
 * Toast an `apiFetch` outcome in one line: `success` on ok (null = silent),
 * server message or `fallback` on failure. Only for clean pairs — flows with
 * interleaved logic (conflict branches, extra success arms) keep hand-rolled toasts.
 */
export function notifyResult(
	result: { ok: boolean; error?: string | null },
	success: string | null,
	fallback: string = UPDATE_FAILED
): void {
	if (result.ok) {
		if (success !== null) toast.success(success);
	} else {
		toast.error(result.error ?? fallback);
	}
}
