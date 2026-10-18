<script lang="ts">
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import { DIALOG_FOOTER_CLASS } from '$lib/constants';
	import { apiFetch } from '$lib/utils/api';
	import { notifyMailFailed, notifyResult } from '$lib/utils/toasts';
	import AsyncButton from './async-button.svelte';
	import DialogHeader from './dialog-header.svelte';
	import DialogShell from './dialog-shell.svelte';
	import * as AlertDialog from './ui/alert-dialog';

	interface Props {
		bookingId: number | null;
		onClose: () => void;
		onCancelled: () => void;
	}

	let { bookingId, onClose, onCancelled }: Props = $props();

	let cancelling = $state(false);

	async function executeCancelBooking() {
		if (bookingId === null || cancelling) return;
		cancelling = true;
		try {
			const result = await apiFetch<{ mailFailed?: boolean }>(
				`/api/bookings/${bookingId}`,
				{ method: 'DELETE' },
				"Impossible d'annuler"
			);
			if (result.ok) {
				toast.success('Réservation annulée');
				notifyMailFailed(result.data?.mailFailed);
				onClose();
				onCancelled();
			} else {
				notifyResult(result, null, "Impossible d'annuler");
			}
		} finally {
			cancelling = false;
		}
	}
</script>

<DialogShell kind="alert" open={bookingId !== null} {onClose}>
	<DialogHeader
		kind="alert"
		icon={Trash2}
		tone="destructive"
		title="Annuler la réservation"
		subtitle="L'opération est irréversible."
		{onClose}
	/>
	<div class="space-y-2">
		<p class="text-sm">Cette réservation sera définitivement annulée.</p>
		<p class="text-sm font-medium">Êtes-vous sûr de vouloir annuler la réservation n°{bookingId} ?</p>
	</div>
	<AlertDialog.Footer class={DIALOG_FOOTER_CLASS}>
		<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
		<AsyncButton
			variant="default"
			class="bg-destructive on-solid hover:bg-destructive/80"
			loading={cancelling}
			onclick={executeCancelBooking}
		>
			Annuler la réservation
		</AsyncButton>
	</AlertDialog.Footer>
	</DialogShell>
