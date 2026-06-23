<script lang="ts">
	import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import QrCode from '$lib/components/qr-code.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { data } = $props();

	// Dialog state
	type AdminDialog = 'addSpot' | 'editSpot' | 'addFlat' | 'bulkFlats' | 'invite' | null;
	let openDialog = $state<AdminDialog>(null);

	// Form state
	let newFlatNumber = $state('');
	let newSpotNumber = $state('');
	let newSpotDescription = $state('');
	let editSpotTarget = $state<(typeof data.spots)[0] | null>(null);
	let editSpotDescription = $state('');
	let bulkInput = $state('');
	let bulkLoading = $state(false);
	let inviteFlat = $state<(typeof data.flats)[0] | null>(null);

	// Search
	let searchQuery = $state('');
	let filteredFlats = $derived(
		searchQuery.trim() === ''
			? data.flats
			: data.flats.filter(
					(f) =>
						f.number.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
						(f.displayName?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ?? false)
				)
	);

	// Confirmation dialog state
	let confirmAction = $state<
		| { type: 'reset' | 'delete'; flatNumber: string }
		| { type: 'deleteSpot'; spotNumber: string }
		| null
	>(null);

	type FlatState = 'inactive' | 'pending' | 'expired' | 'active';

	function getFlatState(f: (typeof data.flats)[0]): FlatState {
		if (f.isActive) return 'active';
		if (f.activationCode) {
			if (f.activationCodeExpiresAt && new Date(f.activationCodeExpiresAt).getTime() < Date.now()) {
				return 'expired';
			}
			return 'pending';
		}
		return 'inactive';
	}

	function getExpiryLabel(expiresAt: string): string {
		const diff = new Date(expiresAt).getTime() - Date.now();
		if (diff <= 0) return 'Expiré';
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		if (hours > 0) return `expire dans ${hours}h${String(minutes).padStart(2, '0')}`;
		return `expire dans ${minutes}min`;
	}

	function getActivationLink(f: (typeof data.flats)[0]): string {
		return `${window.location.origin}/activate?flat=${encodeURIComponent(f.number)}&code=${f.activationCode}`;
	}

	async function copyLink(f: (typeof data.flats)[0] | null) {
		if (!f) return;
		try {
			await navigator.clipboard.writeText(getActivationLink(f));
			toast.success("Lien d'activation copié");
		} catch {
			toast.error('Impossible de copier le lien');
		}
	}

	function showInvite(f: (typeof data.flats)[0]) {
		inviteFlat = f;
		openDialog = 'invite';
	}

	async function generateAndInvite(flatNumber: string) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
			method: 'POST'
		});
		if (res.ok) {
			await invalidateAll();
			const updated = data.flats.find((f) => f.number === flatNumber);
			if (updated) {
				inviteFlat = updated;
				openDialog = 'invite';
			}
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de générer le code');
		}
	}

	async function regenerateInvite() {
		if (!inviteFlat) return;
		const flatNumber = inviteFlat.number;
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
			method: 'POST'
		});
		if (res.ok) {
			await invalidateAll();
			const updated = data.flats.find((f) => f.number === flatNumber);
			if (updated) inviteFlat = updated;
			toast.success("Lien régénéré (valable 24h)");
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de régénérer le lien');
		}
	}

	async function revokeInvite() {
		if (!inviteFlat) return;
		const flatNumber = inviteFlat.number;
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
			method: 'DELETE'
		});
		if (res.ok) {
			toast.success("Invitation révoquée");
			openDialog = null;
			inviteFlat = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de révoquer');
		}
	}

	async function addFlat() {
		if (!newFlatNumber.trim()) return;

		const res = await fetch('/api/admin/flats', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ number: newFlatNumber.trim() })
		});

		if (res.ok) {
			toast.success(`Appartement ${newFlatNumber} ajouté`);
			newFlatNumber = '';
			openDialog = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || "Impossible d'ajouter l'appartement");
		}
	}

	let bulkParsed = $derived([...new Set(bulkInput.split(',').map((s) => s.trim()).filter((s) => s.length > 0))]);

	async function addBulkFlats() {
		if (bulkParsed.length === 0) return;
		bulkLoading = true;

		try {
			const res = await fetch('/api/admin/flats/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ flats: bulkParsed })
			});

			if (res.ok) {
				const { created, skipped } = await res.json();
				if (skipped.length > 0) {
					toast.success(
						`${created} appartement${created > 1 ? 's' : ''} créé${created > 1 ? 's' : ''}, ${skipped.length} déjà existant${skipped.length > 1 ? 's' : ''} (${skipped.join(', ')})`
					);
				} else {
					toast.success(`${created} appartement${created > 1 ? 's' : ''} créé${created > 1 ? 's' : ''}`);
				}
				bulkInput = '';
				openDialog = null;
				invalidateAll();
			} else {
				const result = await res.json();
				toast.error(result.error || 'Impossible de créer les appartements');
			}
		} catch {
			toast.error('Erreur de connexion');
		} finally {
			bulkLoading = false;
		}
	}

	async function addSpot() {
		if (!newSpotNumber.trim()) return;

		const res = await fetch('/api/spots', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ number: newSpotNumber.trim(), description: newSpotDescription.trim() || null })
		});

		if (res.ok) {
			toast.success(`Place "${newSpotNumber}" ajoutée`);
			newSpotNumber = '';
			newSpotDescription = '';
			openDialog = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || "Impossible d'ajouter la place");
		}
	}

	function showEditSpot(s: (typeof data.spots)[0]) {
		editSpotTarget = s;
		editSpotDescription = s.description ?? '';
		openDialog = 'editSpot';
	}

	async function saveEditSpot() {
		if (!editSpotTarget) return;
		const res = await fetch(`/api/spots/${encodeURIComponent(editSpotTarget.number)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ description: editSpotDescription.trim() || null })
		});
		if (res.ok) {
			toast.success(`Place "${editSpotTarget.number}" mise à jour`);
			openDialog = null;
			editSpotTarget = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de modifier la place');
		}
	}

	async function deleteSpot(spotNumber: string) {
		const res = await fetch(`/api/spots/${encodeURIComponent(spotNumber)}`, { method: 'DELETE' });
		if (res.ok) {
			toast.success(`Place "${spotNumber}" supprimée`);
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de supprimer la place');
		}
	}

	function confirmDeleteSpot(spotNumber: string) {
		confirmAction = { type: 'deleteSpot', spotNumber };
	}

	async function resetFlat(flatNumber: string) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/reset`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ confirm: true })
		});

		if (res.ok) {
			toast.success('Appartement réinitialisé');
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de réinitialiser');
		}
	}

	async function toggleAdmin(flatNumber: string, currentIsAdmin: boolean) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isAdmin: !currentIsAdmin })
		});

		if (res.ok) {
			toast.success('Statut admin mis à jour');
			invalidateAll();
		} else {
			toast.error('Impossible de modifier le statut');
		}
	}

	async function deleteFlat(flatNumber: string) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}`, { method: 'DELETE' });

		if (res.ok) {
			toast.success('Appartement supprimé');
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de supprimer');
		}
	}

	function confirmResetFlat(flatNumber: string) {
		confirmAction = { type: 'reset', flatNumber };
	}

	function confirmDeleteFlat(flatNumber: string) {
		confirmAction = { type: 'delete', flatNumber };
	}

	async function executeConfirmAction() {
		if (!confirmAction) return;
		if (confirmAction.type === 'reset') {
			await resetFlat(confirmAction.flatNumber);
		} else if (confirmAction.type === 'delete') {
			await deleteFlat(confirmAction.flatNumber);
		} else if (confirmAction.type === 'deleteSpot') {
			await deleteSpot(confirmAction.spotNumber);
		}
		confirmAction = null;
	}
</script>

<div class="space-y-8">
	<h2 class="page-title">Administration</h2>

	<!-- Places de parking -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Places de parking</Card.Title>
			<Card.Description>Gérez les places de parking disponibles dans votre immeuble.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if data.spots.length === 0}
				<p class="text-muted-foreground text-sm">Aucune place configurée.</p>
			{:else}
				<div class="space-y-2">
				{#each data.spots as s}
					<div class="flex items-center justify-between rounded-md border p-3">
						<div>
							<p class="font-medium">{s.number}</p>
							{#if s.description}
								<p class="text-muted-foreground text-sm">{s.description}</p>
							{/if}
						</div>
						<div class="flex items-center gap-1">
							<Button size="sm" variant="ghost" onclick={() => showEditSpot(s)}>
								<Pencil class="h-3.5 w-3.5" />
							</Button>
							<Button size="sm" variant="ghost" class="text-destructive hover:text-destructive" onclick={() => confirmDeleteSpot(s.number)}>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
				{/each}
				</div>
			{/if}

			<Button variant="outline" size="sm" onclick={() => (openDialog = 'addSpot')}>
				<Plus class="mr-1.5 h-3.5 w-3.5" />
				Ajouter une place
			</Button>
		</Card.Content>
	</Card.Root>

	<!-- Appartements -->
	<Card.Root>
		<Card.Header class="flex flex-row items-start justify-between gap-4">
			<div>
				<Card.Title>Appartements</Card.Title>
				<Card.Description>Gérez les appartements et les accès des résidents.</Card.Description>
			</div>
			{#if data.flats.length > 0}
				<div class="relative shrink-0">
					<Search class="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
					<Input
						placeholder="Rechercher..."
						bind:value={searchQuery}
						class="h-7 w-36 pl-7 text-xs"
					/>
				</div>
			{/if}
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if data.flats.length === 0}
				<p class="text-muted-foreground text-sm">
					Aucun appartement configuré. Ajoutez les appartements de votre immeuble, puis invitez chaque résident.
				</p>
			{:else}
				<div class="space-y-2">
					{#each filteredFlats as f}
						{@const state = getFlatState(f)}
						<div class="rounded-md border p-3">
							<div class="flex items-center justify-between">
								<!-- Left: identity + state pill -->
								<div class="flex min-w-0 flex-wrap items-center gap-2">
									<span class="font-medium">{f.number}</span>
									{#if f.displayName}
										<span class="text-muted-foreground text-sm">({f.displayName})</span>
									{/if}
									{#if f.isAdmin}
										<Badge>Admin</Badge>
									{/if}
									{#if state === 'active'}
										<Badge variant="secondary" class="flat-badge-active">Actif</Badge>
								{:else if state === 'pending'}
									<Badge variant="secondary" class="flat-badge-pending">
										En attente · {f.activationCodeExpiresAt ? getExpiryLabel(f.activationCodeExpiresAt) : ''}
									</Badge>
									{:else if state === 'expired'}
										<Badge variant="secondary" class="flat-badge-expired">Expiré · lien périmé</Badge>
									{:else}
										<Badge variant="outline">Inactif</Badge>
									{/if}
								</div>
								<!-- Right: actions -->
								<div class="ml-2 flex shrink-0 items-center gap-1">
								{#if state === 'active'}
									<Button size="sm" variant="ghost" onclick={() => toggleAdmin(f.number, f.isAdmin)}>
										{f.isAdmin ? 'Retirer admin' : 'Rendre admin'}
									</Button>
									<Button size="sm" variant="ghost" onclick={() => confirmResetFlat(f.number)}>Réinitialiser</Button>
								{:else if state === 'pending'}
									<Button size="sm" variant="ghost" onclick={() => showInvite(f)}>Inviter</Button>
								{:else if state === 'expired'}
									<Button size="sm" variant="ghost" onclick={() => generateAndInvite(f.number)}>
										Renvoyer une invitation
									</Button>
								{:else}
									<Button size="sm" variant="ghost" onclick={() => generateAndInvite(f.number)}>Inviter</Button>
								{/if}
									<Button size="sm" variant="ghost" class="text-destructive hover:text-destructive" onclick={() => confirmDeleteFlat(f.number)}>
									<Trash2 class="h-3.5 w-3.5" />
								</Button>
								</div>
							</div>
						</div>
					{:else}
						<p class="text-muted-foreground text-sm">Aucun appartement trouvé.</p>
					{/each}
				</div>
			{/if}

			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={() => (openDialog = 'addFlat')}>
					<Plus class="mr-1.5 h-3.5 w-3.5" />
					Ajouter
				</Button>
				<Button variant="outline" size="sm" onclick={() => (openDialog = 'bulkFlats')}>
					<Plus class="mr-1.5 h-3.5 w-3.5" />
					Création en lot
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- Dialog: Ajouter une place -->
<Dialog.Root
	open={openDialog === 'addSpot'}
	onOpenChange={(o) => {
		if (!o) openDialog = null;
	}}
>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Ajouter une place de parking</Dialog.Title>
			<Dialog.Description>La place sera disponible immédiatement pour les réservations.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="spot-number">Numéro</Label>
				<Input id="spot-number" placeholder="ex. 36" bind:value={newSpotNumber} />
			</div>
			<div class="space-y-2">
				<Label for="spot-desc">Description (optionnel)</Label>
				<Input id="spot-desc" placeholder="ex. Place handicapé" bind:value={newSpotDescription} />
			</div>
			<Button class="w-full" onclick={addSpot} disabled={!newSpotNumber.trim()}>Ajouter</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Dialog: Modifier une place -->
<Dialog.Root
	open={openDialog === 'editSpot'}
	onOpenChange={(o) => {
		if (!o) {
			openDialog = null;
			editSpotTarget = null;
		}
	}}
>
	<Dialog.Content>
		{#if editSpotTarget}
			<Dialog.Header>
				<Dialog.Title>Modifier la place {editSpotTarget.number}</Dialog.Title>
				<Dialog.Description>Le numéro de la place ne peut pas être modifié.</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="edit-spot-desc">Description (optionnel)</Label>
					<Input id="edit-spot-desc" placeholder="ex. Place handicapé" bind:value={editSpotDescription} />
				</div>
				<Button class="w-full" onclick={saveEditSpot}>Enregistrer</Button>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Dialog: Ajouter un appartement -->
<Dialog.Root
	open={openDialog === 'addFlat'}
	onOpenChange={(o) => {
		if (!o) openDialog = null;
	}}
>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Ajouter un appartement</Dialog.Title>
			<Dialog.Description>L'appartement sera créé en état inactif. Vous pourrez l'inviter ensuite.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="flat-number">Numéro d'appartement</Label>
				<Input id="flat-number" placeholder="ex. B12" bind:value={newFlatNumber} />
			</div>
			<Button class="w-full" onclick={addFlat} disabled={!newFlatNumber.trim()}>Ajouter</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Dialog: Création en lot -->
<Dialog.Root
	open={openDialog === 'bulkFlats'}
	onOpenChange={(o) => {
		if (!o) openDialog = null;
	}}
>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Création en lot</Dialog.Title>
			<Dialog.Description>Entrez les numéros d'appartements séparés par des virgules.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="bulk-input">Numéros</Label>
				<Input id="bulk-input" placeholder="ex. A01, A02, B01, B02" bind:value={bulkInput} />
				{#if bulkParsed.length > 0}
					<p class="text-muted-foreground text-xs">
						{bulkParsed.length} appartement{bulkParsed.length > 1 ? 's' : ''} : {bulkParsed.join(', ')}
					</p>
				{/if}
			</div>
			<Button class="w-full" onclick={addBulkFlats} disabled={bulkParsed.length === 0 || bulkLoading}>
				{bulkLoading ? 'Création...' : `Créer ${bulkParsed.length} appartement${bulkParsed.length > 1 ? 's' : ''}`}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Dialog: Inviter un résident -->
<Dialog.Root
	open={openDialog === 'invite'}
	onOpenChange={(o) => {
		if (!o) {
			openDialog = null;
			inviteFlat = null;
		}
	}}
>
	<Dialog.Content>
		{#if inviteFlat}
			<Dialog.Header>
				<Dialog.Title>Inviter l'appartement {inviteFlat.number}</Dialog.Title>
				<Dialog.Description>
					Partagez ce lien avec le résident pour qu'il puisse activer son compte. Valable 24h.
				</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-4">
				<!-- Copiable URL -->
				<div class="flex gap-2">
					<Input readonly value={getActivationLink(inviteFlat)} class="font-mono text-xs" />
					<Button variant="outline" size="sm" onclick={() => copyLink(inviteFlat)}>
						<ClipboardCopy class="h-4 w-4" />
					</Button>
				</div>
				<!-- Divider -->
				<div class="relative">
					<div class="absolute inset-0 flex items-center">
						<span class="border-t w-full"></span>
					</div>
					<div class="relative flex justify-center text-xs uppercase">
						<span class="bg-background text-muted-foreground px-2">ou scanner</span>
					</div>
				</div>
				<!-- QR code -->
				<div class="flex justify-center">
					<div class="rounded-lg bg-white p-4">
						<QrCode value={getActivationLink(inviteFlat)} size={200} />
					</div>
				</div>
				<!-- Footer actions -->
				<div class="border-t pt-3 flex justify-between">
					<Button variant="outline" size="sm" onclick={regenerateInvite}>
						Régénérer un lien
					</Button>
					<Button variant="destructive" size="sm" onclick={revokeInvite}>
						Révoquer
					</Button>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- AlertDialog: Confirmation -->
<AlertDialog.Root
	open={confirmAction !== null}
	onOpenChange={(o) => {
		if (!o) confirmAction = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>
				{#if confirmAction?.type === 'reset'}
					Réinitialiser l'appartement
				{:else if confirmAction?.type === 'deleteSpot'}
					Supprimer la place
				{:else}
					Supprimer l'appartement
				{/if}
			</AlertDialog.Title>
			<AlertDialog.Description>
				{#if confirmAction?.type === 'reset'}
					Cela va déconnecter le résident et supprimer son code PIN. Cette action est réversible.
				{:else if confirmAction?.type === 'deleteSpot'}
					Supprimer cette place et toutes ses réservations ? Cette action est irréversible.
				{:else}
					Supprimer cet appartement et toutes ses réservations ? Cette action est irréversible.
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
			<AlertDialog.Action onclick={executeConfirmAction}>
				{confirmAction?.type === 'reset' ? 'Réinitialiser' : 'Supprimer'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
