<script lang="ts">
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import DialogHeader from '$lib/components/dialog-header.svelte';
	import DialogShell from '$lib/components/dialog-shell.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { DIALOG_FOOTER_CLASS } from '$lib/constants';

	export type ConfirmAction =
		| { type: 'reset' | 'delete'; flatNumber: string }
		| { type: 'deleteSpot'; spotNumber: string }
		| { type: 'rejectRequest'; requestId: number; reason?: string | null };

	interface Props {
		action: ConfirmAction | null;
		onClose: () => void;
		onExecute: (action: ConfirmAction) => void;
	}

	let { action, onClose, onExecute }: Props = $props();

	// Rejection reason draft (reject branch only) — reset on each open.
	let rejectReason = $state('');
	$effect(() => {
		if (action) rejectReason = '';
	});

	const headerIcon = $derived(
		action?.type === 'reset' ? RotateCcw : action?.type === 'rejectRequest' ? X : Trash2
	);
	const headerTitle = $derived(
		action?.type === 'reset'
			? 'Réinitialiser le lot'
			: action?.type === 'deleteSpot'
				? 'Supprimer la place de parking'
				: action?.type === 'rejectRequest'
					? 'Rejeter la demande'
					: 'Supprimer le lot'
	);
	const headerSubtitle = $derived(
		action?.type === 'reset'
			? "L'opération est réversible."
			: action?.type === 'rejectRequest'
				? 'Le résident sera notifié par email.'
				: "L'opération est irréversible."
	);
</script>

<DialogShell kind="alert" open={action !== null} {onClose}>
	<DialogHeader
		kind="alert"
		icon={headerIcon}
		tone="destructive"
		title={headerTitle}
		subtitle={headerSubtitle}
		{onClose}
	/>
		{#if action?.type === 'rejectRequest'}
			<div class="space-y-4">
				<p class="text-sm font-medium">Êtes-vous sûr de vouloir rejeter cette demande ?</p>
				<div class="space-y-1.5">
					<Label for="reject-reason">Motif du refus (optionnel)</Label>
					<Textarea
						id="reject-reason"
						bind:value={rejectReason}
						rows={3}
						placeholder="ex. : place déjà attribuée à un autre lot"
					/>
				</div>
			</div>
		{:else if action}
			<div class="space-y-2">
				{#if action.type === 'reset'}
					<p class="text-sm">Le résident sera déconnecté et son code PIN supprimé. Un nouveau code pourra être généré.</p>
					<p class="text-sm font-medium">Êtes-vous sûr de vouloir réinitialiser le lot {action.flatNumber} ?</p>
				{:else if action.type === 'deleteSpot'}
					<p class="text-sm">Cette place et toutes ses réservations seront définitivement supprimées.</p>
					<p class="text-sm font-medium">Êtes-vous sûr de vouloir supprimer la place {action.spotNumber} ?</p>
				{:else}
					<p class="text-sm">Ce lot et toutes ses réservations seront définitivement supprimés.</p>
					<p class="text-sm font-medium">Êtes-vous sûr de vouloir supprimer le lot {action.flatNumber} ?</p>
				{/if}
			</div>
		{/if}
		<AlertDialog.Footer class={DIALOG_FOOTER_CLASS}>
			<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="default"
				class="bg-destructive on-solid hover:bg-destructive/80"
				onclick={() =>
					action &&
					onExecute(
						action.type === 'rejectRequest'
							? { ...action, reason: rejectReason.trim() || null }
							: action
					)}
			>
				{action?.type === 'reset'
					? 'Réinitialiser'
					: action?.type === 'rejectRequest'
						? 'Rejeter'
						: 'Supprimer'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</DialogShell>
