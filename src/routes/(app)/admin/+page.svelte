<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
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
	type AdminDialog = 'addSpot' | 'editSpot' | 'addFlat' | 'flatDetail' | null;
	let openDialog = $state<AdminDialog>(null);

	// Form state
	let newFlatNumber = $state('');
	let newSpotNumber = $state('');
	let newSpotDescription = $state('');
	let editSpotTarget = $state<(typeof data.spots)[0] | null>(null);
	let editSpotDescription = $state('');
	let flatSpotInputs = $state(['']);
	let selectedFlat = $state<(typeof data.flats)[0] | null>(null);

	// Derived
	const sharedSpots = $derived(data.spots.filter((s) => !s.flatNumber));

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
		| { type: 'rejectRequest'; requestId: number }
		| null
	>(null);

	// Request actions
	let approvingRequest = $state<number | null>(null);

	const pendingRequests = $derived(data.requests.filter((r) => r.status === 'pending'));

	function parseSpotNumbers(val: unknown): string[] {
		if (Array.isArray(val)) return val;
		return [];
	}

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

	function getStateLabel(state: FlatState): string {
		switch (state) {
			case 'active': return 'Actif';
			case 'pending': return 'En attente';
			case 'expired': return 'Expiré';
			case 'inactive': return 'Inactif';
		}
	}

	function getStateBadgeClass(state: FlatState): string {
		switch (state) {
			case 'active': return 'flat-badge-active';
			case 'pending': return 'flat-badge-pending';
			case 'expired': return 'flat-badge-expired';
			default: return '';
		}
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

	function getBoundSpots(f: (typeof data.flats)[0]): string[] {
		return data.spots.filter((s) => s.flatNumber === f.number).map((s) => s.number);
	}

	function openFlatDetail(f: (typeof data.flats)[0]) {
		selectedFlat = f;
		openDialog = 'flatDetail';
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

	async function generateActivationCode(flatNumber: string) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
			method: 'POST'
		});
		if (res.ok) {
			await invalidateAll();
			const updated = data.flats.find((f) => f.number === flatNumber);
			if (updated) selectedFlat = updated;
			toast.success("Code d'activation généré");
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de générer le code');
		}
	}

	async function regenerateInvite() {
		if (!selectedFlat) return;
		const flatNumber = selectedFlat.number;
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
			method: 'POST'
		});
		if (res.ok) {
			await invalidateAll();
			const updated = data.flats.find((f) => f.number === flatNumber);
			if (updated) selectedFlat = updated;
			toast.success("Lien régénéré (valable 24h)");
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de régénérer le lien');
		}
	}

	async function revokeInvite() {
		if (!selectedFlat) return;
		const flatNumber = selectedFlat.number;
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
			method: 'DELETE'
		});
		if (res.ok) {
			toast.success("Invitation révoquée");
			openDialog = null;
			selectedFlat = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de révoquer');
		}
	}

	const validFlatSpots = $derived(flatSpotInputs.map((s) => s.trim()).filter((s) => s.length > 0));

	function addFlatSpot() {
		flatSpotInputs = [...flatSpotInputs, ''];
	}

	function removeFlatSpot(index: number) {
		if (flatSpotInputs.length <= 1) return;
		flatSpotInputs = flatSpotInputs.filter((_, i) => i !== index);
	}

	function updateFlatSpot(index: number, value: string) {
		flatSpotInputs = flatSpotInputs.map((s, i) => (i === index ? value : s));
	}

	async function addFlat() {
		if (!newFlatNumber.trim() || validFlatSpots.length === 0) return;

		const res = await fetch('/api/admin/flats', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ number: newFlatNumber.trim(), spotNumbers: validFlatSpots })
		});

		if (res.ok) {
			toast.success(`Appartement ${newFlatNumber.trim()} ajouté`);
			newFlatNumber = '';
			flatSpotInputs = [''];
			openDialog = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || "Impossible d'ajouter l'appartement");
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
			openDialog = null;
			selectedFlat = null;
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
			openDialog = null;
			selectedFlat = null;
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

	function confirmRejectRequest(requestId: number) {
		confirmAction = { type: 'rejectRequest', requestId };
	}

	async function approveRequest(requestId: number) {
		approvingRequest = requestId;
		try {
			const res = await fetch(`/api/admin/requests/${requestId}`, { method: 'POST' });
			if (res.ok) {
				const result = await res.json();
				toast.success(`Appartement ${result.flat.number} créé avec succès`);
				invalidateAll();
			} else {
				const result = await res.json();
				toast.error(result.error || "Impossible d'approuver la demande");
			}
		} catch {
			toast.error('Erreur de connexion');
		} finally {
			approvingRequest = null;
		}
	}

	async function rejectRequest(requestId: number) {
		const res = await fetch(`/api/admin/requests/${requestId}`, { method: 'PATCH' });
		if (res.ok) {
			toast.success('Demande rejetée');
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de rejeter la demande');
		}
	}

	async function executeConfirmAction() {
		if (!confirmAction) return;
		if (confirmAction.type === 'reset') {
			await resetFlat(confirmAction.flatNumber);
		} else if (confirmAction.type === 'delete') {
			await deleteFlat(confirmAction.flatNumber);
		} else if (confirmAction.type === 'deleteSpot') {
			await deleteSpot(confirmAction.spotNumber);
		} else if (confirmAction.type === 'rejectRequest') {
			await rejectRequest(confirmAction.requestId);
		}
		confirmAction = null;
	}
</script>

<div class="space-y-8">
	<h2 class="page-title">Administration</h2>

	<!-- Demandes en attente -->
	{#if pendingRequests.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title>Demandes en attente</Card.Title>
				<Card.Description>Les résidents ont demandé à rejoindre l'application.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#each pendingRequests as req}
					{@const spots = parseSpotNumbers(req.spotNumbers)}
					<div class="rounded-md border p-3">
						<div class="flex items-center justify-between">
							<div>
								<p class="font-medium">
									Appartement {req.flatNumber}
									{#if req.requesterName}
										<span class="text-muted-foreground text-sm">— {req.requesterName}</span>
									{/if}
								</p>
								<p class="text-muted-foreground text-sm">
									Place{spots.length > 1 ? 's' : ''} : {spots.join(', ')}
								</p>
							</div>
							<div class="flex items-center gap-1">
								<Button
									size="sm"
									variant="ghost"
									disabled={approvingRequest === req.id}
									onclick={() => approveRequest(req.id)}
								>
									<Check class="mr-1 h-3.5 w-3.5" />
									{approvingRequest === req.id ? 'Création...' : 'Approuver'}
								</Button>
								<Button
									size="sm"
									variant="ghost"
									class="text-destructive hover:text-destructive"
									onclick={() => confirmRejectRequest(req.id)}
								>
									<X class="mr-1 h-3.5 w-3.5" />
									Rejeter
								</Button>
							</div>
						</div>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Places de parking (shared only) -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Place de parking partagée</Card.Title>
			<Card.Description>Place disponible pour les réservations de tous les résidents.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if sharedSpots.length === 0}
				<p class="text-muted-foreground text-sm">Aucune place partagée configurée.</p>
			{:else}
				<div class="space-y-2">
				{#each sharedSpots as s}
					<div class="flex items-center justify-between rounded-md border p-3">
						<div>
							<p class="font-medium">Place {s.number}</p>
							{#if s.description}
								<p class="text-muted-foreground text-sm">{s.description}</p>
							{/if}
						</div>
						<div class="flex items-center gap-1">
							<Button size="sm" variant="ghost" onclick={() => showEditSpot(s)}>
								<Pencil class="h-3.5 w-3.5" />
							</Button>
						<Button size="sm" variant="ghost" class="text-destructive hover:text-destructive" aria-label="Supprimer" onclick={() => confirmDeleteSpot(s.number)}>
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
						<div class="flex items-center justify-between rounded-md border p-3">
							<div class="flex min-w-0 flex-wrap items-center gap-2">
								<span class="font-medium">{f.number}</span>
								{#if f.isAdmin}
									<Badge>Admin</Badge>
								{/if}
								<Badge variant="secondary" class={getStateBadgeClass(state)}>
									{getStateLabel(state)}
									{#if state === 'pending' && f.activationCodeExpiresAt}
										· {getExpiryLabel(f.activationCodeExpiresAt)}
									{:else if state === 'expired'}
										· lien périmé
									{/if}
								</Badge>
							</div>
							<div class="flex shrink-0 items-center gap-1">
								<Button size="sm" variant="ghost" onclick={() => openFlatDetail(f)}>
									Voir détails
								</Button>
								<Button size="sm" variant="ghost" class="text-destructive hover:text-destructive" aria-label="Supprimer" onclick={() => confirmDeleteFlat(f.number)}>
									<Trash2 class="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>
					{:else}
						<p class="text-muted-foreground text-sm">Aucun appartement trouvé.</p>
					{/each}
				</div>
			{/if}

			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={() => { flatSpotInputs = ['']; newFlatNumber = ''; openDialog = 'addFlat'; }}>
					<Plus class="mr-1.5 h-3.5 w-3.5" />
					Ajouter
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- Dialog: Flat Detail -->
<Dialog.Root
	open={openDialog === 'flatDetail'}
	onOpenChange={(o) => {
		if (!o) {
			openDialog = null;
			selectedFlat = null;
		}
	}}
>
	<Dialog.Content>
		{#if selectedFlat}
			{@const state = getFlatState(selectedFlat)}
			{@const boundSpots = getBoundSpots(selectedFlat)}
			<Dialog.Header>
				<Dialog.Title class="flex items-center gap-2">
					Appartement {selectedFlat.number}
					<Badge variant="secondary" class={getStateBadgeClass(state)}>
						{getStateLabel(state)}
					</Badge>
					{#if selectedFlat.isAdmin}
						<Badge>Admin</Badge>
					{/if}
				</Dialog.Title>
				{#if selectedFlat.displayName}
					<Dialog.Description>{selectedFlat.displayName}</Dialog.Description>
				{/if}
			</Dialog.Header>

			<div class="space-y-4">
				<!-- Info -->
				<div class="space-y-2 text-sm">
					{#if boundSpots.length > 0}
						<p><span class="font-medium">Place{boundSpots.length > 1 ? 's' : ''} :</span> {boundSpots.join(', ')}</p>
					{:else}
						<p class="text-muted-foreground">Aucune place assignée</p>
					{/if}
					{#if selectedFlat.activatedAt}
						<p><span class="font-medium">Activé le :</span> {new Date(selectedFlat.activatedAt).toLocaleDateString('fr-FR')}</p>
					{/if}
				</div>

				<!-- Invitation section (for non-active flats) -->
				{#if state !== 'active'}
					<Separator />
					<div class="space-y-3">
						<p class="text-sm font-medium">Invitation</p>
						{#if selectedFlat.activationCode}
							<div class="flex gap-2">
								<Input readonly value={getActivationLink(selectedFlat)} class="font-mono text-xs" />
								<Button variant="outline" size="sm" onclick={() => copyLink(selectedFlat)}>
									<ClipboardCopy class="h-4 w-4" />
								</Button>
							</div>
							<div class="relative">
								<div class="absolute inset-0 flex items-center">
									<span class="border-t w-full"></span>
								</div>
								<div class="relative flex justify-center text-xs uppercase">
									<span class="bg-background text-muted-foreground px-2">ou scanner</span>
								</div>
							</div>
							<div class="flex justify-center">
								<div class="rounded-lg bg-white p-4">
									<QrCode value={getActivationLink(selectedFlat)} size={200} />
								</div>
							</div>
							<div class="flex justify-between">
								<Button variant="outline" size="sm" onclick={regenerateInvite}>
									Régénérer un lien
								</Button>
								<Button variant="destructive" size="sm" onclick={revokeInvite}>
									Révoquer
								</Button>
							</div>
						{:else}
							<Button size="sm" onclick={() => generateActivationCode(selectedFlat!.number)}>
								Générer un code d'activation
							</Button>
						{/if}
					</div>
				{/if}

				<!-- Actions (for active flats) -->
				{#if state === 'active'}
					<Separator />
					<div class="space-y-2">
						<p class="text-sm font-medium">Actions</p>
						<div class="flex flex-wrap gap-2">
							<Button size="sm" variant="outline" onclick={() => toggleAdmin(selectedFlat!.number, selectedFlat!.isAdmin)}>
								{selectedFlat!.isAdmin ? 'Retirer admin' : 'Rendre admin'}
							</Button>
							<Button size="sm" variant="outline" onclick={() => confirmResetFlat(selectedFlat!.number)}>
								Réinitialiser
							</Button>
						</div>
					</div>
				{/if}

				<!-- Delete (always shown) -->
				<Separator />
				<Button size="sm" variant="destructive" class="w-full" onclick={() => confirmDeleteFlat(selectedFlat!.number)}>
					Supprimer l'appartement
				</Button>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

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
			<div class="space-y-2">
				<Label>Place(s) assignée(s)</Label>
				{#each flatSpotInputs as _, i}
					<div class="flex gap-2">
						<Input
							type="text"
							placeholder="ex. 01"
							value={flatSpotInputs[i]}
							oninput={(e) => updateFlatSpot(i, e.currentTarget.value)}
							required
						/>
						{#if flatSpotInputs.length > 1}
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="shrink-0"
								onclick={() => removeFlatSpot(i)}
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						{/if}
					</div>
				{/each}
				<Button type="button" variant="outline" size="sm" class="w-full" onclick={addFlatSpot}>
					<Plus class="mr-1 h-4 w-4" />
					Ajouter une place
				</Button>
			</div>
			<Button class="w-full" onclick={addFlat} disabled={!newFlatNumber.trim() || validFlatSpots.length === 0}>Ajouter</Button>
		</div>
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
			{:else if confirmAction?.type === 'rejectRequest'}
				Rejeter la demande
			{:else}
				Supprimer l'appartement
			{/if}
		</AlertDialog.Title>
		<AlertDialog.Description>
			{#if confirmAction?.type === 'reset'}
				Cela va déconnecter le résident et supprimer son code PIN. Cette action est réversible.
			{:else if confirmAction?.type === 'deleteSpot'}
				Supprimer cette place et toutes ses réservations ? Cette action est irréversible.
			{:else if confirmAction?.type === 'rejectRequest'}
				Rejeter cette demande ? Le résident ne sera pas notifié.
			{:else}
				Supprimer cet appartement et toutes ses réservations ? Cette action est irréversible.
			{/if}
		</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
			<AlertDialog.Action onclick={executeConfirmAction}>
				{confirmAction?.type === 'reset' ? 'Réinitialiser' : confirmAction?.type === 'rejectRequest' ? 'Rejeter' : 'Supprimer'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
