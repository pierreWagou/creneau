<script lang="ts">
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';

	export type ConfirmAction =
		| { type: 'reset' | 'delete'; flatNumber: string }
		| { type: 'deleteSpot'; spotNumber: string }
		| { type: 'rejectRequest'; requestId: number };

	interface Props {
		action: ConfirmAction | null;
		onClose: () => void;
		onExecute: (action: ConfirmAction) => void;
	}

	let { action, onClose, onExecute }: Props = $props();
</script>

<AlertDialog.Root
	open={action !== null}
	onOpenChange={(o) => {
		if (!o) onClose();
	}}
>
	<AlertDialog.Content class="sm:p-6">
		<AlertDialog.Header>
			<div class="flex items-center gap-3">
				<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
					{#if action?.type === 'reset'}
						<RotateCcw class="h-6 w-6" />
					{:else if action?.type === 'rejectRequest'}
						<X class="h-6 w-6" />
					{:else}
						<Trash2 class="h-6 w-6" />
					{/if}
				</div>
				<div class="min-w-0">
					<AlertDialog.Title>
						{#if action?.type === 'reset'}
							Réinitialiser le lot
						{:else if action?.type === 'deleteSpot'}
							Supprimer la place de parking
						{:else if action?.type === 'rejectRequest'}
							Rejeter la demande
						{:else}
							Supprimer le lot
						{/if}
					</AlertDialog.Title>
					<AlertDialog.Description>
						{#if action?.type === 'reset'}
							Cela va déconnecter le résident et supprimer son code PIN. Cette action est réversible.
						{:else if action?.type === 'deleteSpot'}
							Supprimer cette place de parking et toutes ses réservations ? Cette action est irréversible.
						{:else if action?.type === 'rejectRequest'}
							Rejeter cette demande ? Le résident ne sera pas notifié.
						{:else}
							Supprimer ce lot et toutes ses réservations ? Cette action est irréversible.
						{/if}
					</AlertDialog.Description>
				</div>
			</div>
		</AlertDialog.Header>
		<AlertDialog.Footer class="bg-transparent border-t-0">
			<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="default"
				class="bg-destructive text-white hover:bg-destructive/80 dark:text-[#1e1e2e]"
				onclick={() => action && onExecute(action)}
			>
				{action?.type === 'reset'
					? 'Réinitialiser'
					: action?.type === 'rejectRequest'
						? 'Rejeter'
						: 'Supprimer'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
