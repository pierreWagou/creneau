<script lang="ts">
	import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
	import Plus from '@lucide/svelte/icons/plus';
	import QrCodeIcon from '@lucide/svelte/icons/qr-code';
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
	import { Separator } from '$lib/components/ui/separator';

	let { data } = $props();

	// Dialog state
	type AdminDialog = 'addSpot' | 'addFlat' | 'bulkFlats' | 'qrCode' | null;
	let openDialog = $state<AdminDialog>(null);

	// Form state
	let newFlatNumber = $state('');
	let newSpotNumber = $state('');
	let newSpotDescription = $state('');
	let bulkInput = $state('');
	let bulkLoading = $state(false);
	let qrFlat = $state<(typeof data.flats)[0] | null>(null);

	// Confirmation dialog state
	let confirmAction = $state<{ type: 'reset' | 'delete'; flatNumber: string } | null>(null);

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
		if (hours > 0) return `Expire dans ${hours}h${String(minutes).padStart(2, '0')}`;
		return `Expire dans ${minutes}min`;
	}

	function getActivationLink(f: (typeof data.flats)[0]): string {
		return `${window.location.origin}/activate?flat=${encodeURIComponent(f.number)}&code=${f.activationCode}`;
	}

	async function copyLink(f: (typeof data.flats)[0]) {
		try {
			await navigator.clipboard.writeText(getActivationLink(f));
			toast.success("Lien d'activation copié");
		} catch {
			toast.error('Impossible de copier le lien');
		}
	}

	function showQrCode(f: (typeof data.flats)[0]) {
		qrFlat = f;
		openDialog = 'qrCode';
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

	async function generateActivation(flatNumber: string) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, { method: 'POST' });

		if (res.ok) {
			toast.success("Code d'activation généré (valable 24h)");
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de générer le code');
		}
	}

	async function revokeActivation(flatNumber: string) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, { method: 'DELETE' });

		if (res.ok) {
			toast.success("Code d'activation révoqué");
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de révoquer le code');
		}
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
		} else {
			await deleteFlat(confirmAction.flatNumber);
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
		<Card.Header>
			<Card.Title>Appartements</Card.Title>
			<Card.Description>Gérez les appartements et les accès des résidents.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if data.flats.length === 0}
				<p class="text-muted-foreground text-sm">Aucun appartement configuré.</p>
			{:else}
				<div class="space-y-2">
					{#each data.flats as f}
						{@const state = getFlatState(f)}
						<div class="rounded-md border p-3">
							<div class="flex items-center justify-between">
								<div class="space-y-1">
									<div class="flex items-center gap-2">
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
										<Badge variant="secondary" class="flat-badge-pending">En attente</Badge>
									{:else if state === 'expired'}
										<Badge variant="secondary" class="flat-badge-expired">Expiré</Badge>
										{:else}
											<Badge variant="outline">Inactif</Badge>
										{/if}
									</div>
									{#if state === 'pending' && f.activationCodeExpiresAt}
										<p class="text-muted-foreground text-xs">
											{getExpiryLabel(f.activationCodeExpiresAt)}
										</p>
									{/if}
									{#if (state === 'pending' || state === 'expired') && f.activationCode}
										<p class="text-xs">
											Code : <span class="font-mono font-medium">{f.activationCode}</span>
										</p>
									{/if}
								</div>
								<div class="flex items-center gap-1">
								{#if state === 'active'}
									<Button size="sm" variant="ghost" onclick={() => toggleAdmin(f.number, f.isAdmin)}>
										{f.isAdmin ? 'Retirer admin' : 'Rendre admin'}
									</Button>
									<Button size="sm" variant="ghost" onclick={() => confirmResetFlat(f.number)}>Réinitialiser</Button>
									{:else if state === 'pending'}
										<Button size="sm" variant="ghost" onclick={() => copyLink(f)}>
											<ClipboardCopy class="mr-1 h-3.5 w-3.5" />
											Copier le lien
										</Button>
										<Button size="sm" variant="ghost" onclick={() => showQrCode(f)}>
											<QrCodeIcon class="mr-1 h-3.5 w-3.5" />
											QR Code
										</Button>
										<Button size="sm" variant="ghost" onclick={() => revokeActivation(f.number)}>Annuler</Button>
										<Button size="sm" variant="ghost" onclick={() => generateActivation(f.number)}>Régénérer</Button>
									{:else if state === 'expired'}
										<Button size="sm" variant="ghost" onclick={() => generateActivation(f.number)}>Régénérer</Button>
										<Button size="sm" variant="ghost" onclick={() => revokeActivation(f.number)}>Annuler</Button>
									{:else}
										<Button size="sm" variant="ghost" onclick={() => generateActivation(f.number)}>Générer un lien</Button>
									{/if}
									<Button size="sm" variant="destructive" onclick={() => confirmDeleteFlat(f.number)}>Supprimer</Button>
								</div>
							</div>
						</div>
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
			<Dialog.Description>L'appartement sera créé en état inactif. Vous pourrez générer un lien d'activation ensuite.</Dialog.Description>
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

<!-- Dialog: QR Code -->
<Dialog.Root
	open={openDialog === 'qrCode'}
	onOpenChange={(o) => {
		if (!o) {
			openDialog = null;
			qrFlat = null;
		}
	}}
>
	<Dialog.Content>
		{#if qrFlat}
			<Dialog.Header>
				<Dialog.Title>Appartement {qrFlat.number}</Dialog.Title>
				<Dialog.Description>Scannez pour activer le compte parking.</Dialog.Description>
			</Dialog.Header>
			<div class="flex justify-center py-4">
				<div class="rounded-lg bg-white p-4">
					<QrCode value={getActivationLink(qrFlat)} size={256} />
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
				{confirmAction?.type === 'reset' ? "Réinitialiser l'appartement" : "Supprimer l'appartement"}
			</AlertDialog.Title>
			<AlertDialog.Description>
				{confirmAction?.type === 'reset'
					? 'Cela va déconnecter le résident et supprimer son code PIN. Cette action est réversible.'
					: 'Supprimer cet appartement et toutes ses réservations ? Cette action est irréversible.'}
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
