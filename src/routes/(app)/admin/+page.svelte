<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let newFlatNumber = $state('');
	let newSpotName = $state('');
	let newSpotDescription = $state('');

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

	async function regenerateCode(flatId: number) {
		if (!confirm("Cela va désactiver l'appartement et générer un nouveau code. Continuer ?")) return;

		const res = await fetch(`/api/admin/flats/${flatId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ regenerateCode: true })
		});

		if (res.ok) {
			toast.success("Nouveau code d'activation généré");
			invalidateAll();
		} else {
			toast.error('Impossible de régénérer le code');
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
			<Card.Description>Gérez les appartements et leurs codes d'accès.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-2">
				{#each data.flats as f}
					<div class="flex items-center justify-between rounded-md border p-3">
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<span class="font-medium">{f.number}</span>
								{#if f.displayName}
									<span class="text-muted-foreground text-sm">({f.displayName})</span>
								{/if}
								{#if f.isAdmin}
									<Badge>Admin</Badge>
								{/if}
								{#if f.isActive}
									<Badge variant="secondary">Actif</Badge>
								{:else}
									<Badge variant="outline">Inactif</Badge>
								{/if}
							</div>
							<p class="text-muted-foreground font-mono text-xs">
								Code : {f.activationCode}
							</p>
						</div>
						<div class="flex items-center gap-1">
							<Button size="sm" variant="ghost" onclick={() => toggleAdmin(f.id, f.isAdmin)}>
								{f.isAdmin ? 'Retirer admin' : 'Rendre admin'}
							</Button>
							<Button size="sm" variant="ghost" onclick={() => regenerateCode(f.id)}>Réinitialiser</Button>
							<Button size="sm" variant="destructive" onclick={() => deleteFlat(f.id)}>Supprimer</Button>
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
					Un code d'activation sera généré automatiquement. Partagez-le avec le voisin.
				</p>
			</div>
		</Card.Content>
	</Card.Root>
</div>
