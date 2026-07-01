<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { DISPLAY_NAME_MAX_LENGTH, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '$lib/constants';

	let { data } = $props();

	// Display name editing
	let displayName = $state(data.flat.displayName ?? '');
	let savingName = $state(false);

	// PIN change
	let currentPin = $state('');
	let newPin = $state('');
	let confirmPin = $state('');
	let changingPin = $state(false);

	let pinMismatch = $derived(newPin.length > 0 && confirmPin.length > 0 && newPin !== confirmPin);
	let pinValid = $derived(
		newPin.length >= PIN_MIN_LENGTH &&
			newPin.length <= PIN_MAX_LENGTH &&
			/^\d+$/.test(newPin) &&
			newPin === confirmPin &&
			currentPin.length >= PIN_MIN_LENGTH
	);

	async function saveDisplayName() {
		savingName = true;
		try {
			const res = await fetch('/api/account', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ displayName: displayName.trim() || null })
			});
			if (res.ok) {
				toast.success('Nom mis à jour');
			} else {
				const { error } = await res.json();
				toast.error(error || 'Erreur lors de la mise à jour');
			}
		} catch {
			toast.error('Erreur réseau');
		} finally {
			savingName = false;
		}
	}

	async function changePin() {
		if (!pinValid) return;
		changingPin = true;
		try {
			const res = await fetch('/api/account', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPin, newPin })
			});
			if (res.ok) {
				toast.success('PIN modifié avec succès');
				currentPin = '';
				newPin = '';
				confirmPin = '';
			} else {
				const { error } = await res.json();
				toast.error(error || 'Erreur lors du changement de PIN');
			}
		} catch {
			toast.error('Erreur réseau');
		} finally {
			changingPin = false;
		}
	}

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/login');
	}
</script>

<div class="mx-auto max-w-md space-y-4">
	<h2 class="page-title">Mon compte</h2>

	<!-- Identity -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				Appartement {data.flat.number}
				{#if data.flat.isAdmin}
					<Badge variant="secondary">Admin</Badge>
				{/if}
			</Card.Title>
			{#if data.flat.activatedAt}
				<p class="text-muted-foreground text-sm">
					Activé le {new Date(data.flat.activatedAt).toLocaleDateString('fr-FR')}
				</p>
			{/if}
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label for="display-name">Nom d'affichage</Label>
				<div class="flex gap-2">
					<Input
						id="display-name"
						type="text"
						placeholder="ex. Jean, Famille Dupont"
						bind:value={displayName}
						maxlength={DISPLAY_NAME_MAX_LENGTH}
					/>
					<Button size="sm" disabled={savingName} onclick={saveDisplayName} class="shrink-0">
						{savingName ? '...' : 'Enregistrer'}
					</Button>
				</div>
				<p class="text-muted-foreground text-xs">Ce nom sera visible par les autres résidents sur le calendrier.</p>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Assigned spots -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Places assignées</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if data.spots.length === 0}
				<p class="text-muted-foreground text-sm">Aucune place assignée.</p>
			{:else}
				<div class="space-y-2">
					{#each data.spots as s}
						<div class="rounded-md border p-3">
							<p class="font-medium">Place {s.number}</p>
							{#if s.description}
								<p class="text-muted-foreground text-sm">{s.description}</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Change PIN -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Changer le PIN</Card.Title>
			<p class="text-muted-foreground text-sm">Votre PIN sécurise l'accès à votre compte</p>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label for="current-pin">PIN actuel</Label>
				<Input
					id="current-pin"
					type="password"
					inputmode="numeric"
					placeholder="Votre PIN actuel"
					bind:value={currentPin}
					maxlength={PIN_MAX_LENGTH}
				/>
			</div>

			<Separator />

			<div class="space-y-2">
				<Label for="new-pin">Nouveau PIN</Label>
				<Input
					id="new-pin"
					type="password"
					inputmode="numeric"
					placeholder="{PIN_MIN_LENGTH} à {PIN_MAX_LENGTH} chiffres"
					bind:value={newPin}
					maxlength={PIN_MAX_LENGTH}
				/>
			</div>

			<div class="space-y-2">
				<Label for="confirm-pin">Confirmer le nouveau PIN</Label>
				<Input
					id="confirm-pin"
					type="password"
					inputmode="numeric"
					placeholder="Retapez le nouveau PIN"
					bind:value={confirmPin}
					maxlength={PIN_MAX_LENGTH}
				/>
				{#if pinMismatch}
					<p class="text-destructive text-xs">Les PINs ne correspondent pas</p>
				{/if}
			</div>

			<Button class="w-full" disabled={!pinValid || changingPin} onclick={changePin}>
				{changingPin ? 'Modification...' : 'Modifier le PIN'}
			</Button>
		</Card.Content>
	</Card.Root>

	<!-- Logout -->
	<Card.Root>
		<Card.Content class="py-4">
			<Button variant="outline" class="text-destructive w-full" onclick={handleLogout}>Se déconnecter</Button>
		</Card.Content>
	</Card.Root>
</div>
