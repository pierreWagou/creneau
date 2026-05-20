<script lang="ts">
	import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';

	let { data } = $props();

	let newFlatNumber = $state('');
	let newSpotName = $state('');
	let newSpotDescription = $state('');

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
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || "Impossible d'ajouter l'appartement");
		}
	}

	async function addSpot() {
		if (!newSpotName.trim()) return;

		const res = await fetch('/api/spots', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newSpotName.trim(), description: newSpotDescription.trim() || null })
		});

		if (res.ok) {
			toast.success(`Place "${newSpotName}" ajoutée`);
			newSpotName = '';
			newSpotDescription = '';
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || "Impossible d'ajouter la place");
		}
	}

	async function generateActivation(flatId: number) {
		const res = await fetch(`/api/admin/flats/${flatId}/activation`, { method: 'POST' });

		if (res.ok) {
			toast.success("Code d'activation généré (valable 24h)");
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de générer le code');
		}
	}

	async function revokeActivation(flatId: number) {
		const res = await fetch(`/api/admin/flats/${flatId}/activation`, { method: 'DELETE' });

		if (res.ok) {
			toast.success("Code d'activation révoqué");
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de révoquer le code');
		}
	}

	async function resetFlat(flatId: number) {
		if (!confirm('Cela va déconnecter le résident et supprimer son code PIN. Continuer ?')) return;

		const res = await fetch(`/api/admin/flats/${flatId}/reset`, {
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

	async function toggleAdmin(flatId: number, currentIsAdmin: boolean) {
		const res = await fetch(`/api/admin/flats/${flatId}`, {
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

	async function deleteFlat(flatId: number) {
		if (!confirm('Supprimer cet appartement ? Cette action est irréversible.')) return;

		const res = await fetch(`/api/admin/flats/${flatId}`, { method: 'DELETE' });

		if (res.ok) {
			toast.success('Appartement supprimé');
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de supprimer');
		}
	}
</script>

<div class="space-y-8">
	<h2 class="text-2xl font-bold">Administration</h2>

	<!-- Gestion des places de parking -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Places de parking</Card.Title>
			<Card.Description>Gérez les places de parking disponibles dans votre immeuble.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if data.spots.length === 0}
				<p class="text-muted-foreground text-sm">Aucune place configurée. Ajoutez votre première place ci-dessous.</p>
			{:else}
				<div class="space-y-2">
					{#each data.spots as s}
						<div class="flex items-center justify-between rounded-md border p-3">
							<div>
								<p class="font-medium">{s.name}</p>
								{#if s.description}
									<p class="text-muted-foreground text-sm">{s.description}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<Separator />

			<div class="space-y-2">
				<Label>Ajouter une place</Label>
				<div class="flex gap-2">
					<Input placeholder="Nom (ex. Place 7)" bind:value={newSpotName} />
					<Input placeholder="Description (optionnel)" bind:value={newSpotDescription} />
					<Button onclick={addSpot}>Ajouter</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Gestion des appartements -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Appartements</Card.Title>
			<Card.Description>Gérez les appartements et les accès des résidents.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
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
										<Badge variant="secondary" class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Actif</Badge>
									{:else if state === 'pending'}
										<Badge variant="secondary" class="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">En attente</Badge>
									{:else if state === 'expired'}
										<Badge variant="secondary" class="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Expiré</Badge>
									{:else}
										<Badge variant="outline">Inactif</Badge>
									{/if}
								</div>
								{#if state === 'pending' && f.activationCodeExpiresAt}
									<p class="text-muted-foreground text-xs">
										{getExpiryLabel(f.activationCodeExpiresAt)}
									</p>
								{/if}
							</div>
							<div class="flex items-center gap-1">
								{#if state === 'active'}
									<Button size="sm" variant="ghost" onclick={() => toggleAdmin(f.id, f.isAdmin)}>
										{f.isAdmin ? 'Retirer admin' : 'Rendre admin'}
									</Button>
									<Button size="sm" variant="ghost" onclick={() => resetFlat(f.id)}>Réinitialiser</Button>
								{:else if state === 'pending'}
									<Button size="sm" variant="ghost" onclick={() => copyLink(f)}>
										<ClipboardCopy class="mr-1 h-3.5 w-3.5" />
										Copier le lien
									</Button>
									<Button size="sm" variant="ghost" onclick={() => revokeActivation(f.id)}>Annuler</Button>
									<Button size="sm" variant="ghost" onclick={() => generateActivation(f.id)}>Régénérer</Button>
								{:else if state === 'expired'}
									<Button size="sm" variant="ghost" onclick={() => generateActivation(f.id)}>Régénérer</Button>
									<Button size="sm" variant="ghost" onclick={() => revokeActivation(f.id)}>Annuler</Button>
								{:else}
									<Button size="sm" variant="ghost" onclick={() => generateActivation(f.id)}>Générer un lien</Button>
								{/if}
								<Button size="sm" variant="destructive" onclick={() => deleteFlat(f.id)}>Supprimer</Button>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<Separator />

			<div class="space-y-2">
				<Label>Ajouter un appartement</Label>
				<div class="flex gap-2">
					<Input placeholder="Numéro (ex. 3B)" bind:value={newFlatNumber} />
					<Button onclick={addFlat}>Ajouter</Button>
				</div>
				<p class="text-muted-foreground text-xs">
					L'appartement sera créé en état inactif. Vous pourrez générer un lien d'activation ensuite.
				</p>
			</div>
		</Card.Content>
	</Card.Root>
</div>
