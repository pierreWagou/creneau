import { toast } from 'svelte-sonner';
import { describe, expect, it, vi } from 'vitest';
import { MAIL_FAILED_WARNING, notifyMailFailed, UPDATE_FAILED } from './toasts';

vi.mock('svelte-sonner', () => ({ toast: { warning: vi.fn() } }));

describe('toast copy', () => {
	it('keeps the failure-only mail receipt in one place', () => {
		expect(MAIL_FAILED_WARNING).toBe("L'envoi de l'email a échoué — vérifiez la configuration du serveur mail");
		expect(UPDATE_FAILED).toBe('Erreur lors de la mise à jour');
	});
});

describe('notifyMailFailed', () => {
	it('warns only on failure', () => {
		notifyMailFailed(true);
		expect(toast.warning).toHaveBeenCalledWith(MAIL_FAILED_WARNING);
		vi.mocked(toast.warning).mockClear();
		notifyMailFailed(false);
		notifyMailFailed(undefined);
		expect(toast.warning).not.toHaveBeenCalled();
	});
});
