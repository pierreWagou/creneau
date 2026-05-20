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

	// Admin ranking period
	let rankingPeriod = $state<'month' | 'all'>('month');

	let pinMismatch = $derived(newPin.length > 0 && confirmPin.length > 0 && newPin !== confirmPin);
	let pinValid = $derived(
		newPin.length >= PIN_MIN_LENGTH &&
			newPin.length <= PIN_MAX_LENGTH &&
			/^\d+$/.test(newPin) &&
			newPin === confirmPin &&
			currentPin.length >= PIN_MIN_LENGTH
	);

	let currentRanking = $derived(
		data.ranking ? (rankingPeriod === 'month' ? data.ranking.thisMonth : data.ranking.allTime) : []
	);
	let maxHours = $derived(currentRanking.length > 0 ? currentRanking[0].hours : 1);

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
	<h2 class="text-2xl font-bold tracking-tight">Mon compte</h2>

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
						placeholder="ex. Famille Dupont"
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

	<!-- Stats -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Mes statistiques</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-cols-4 gap-4">
				<div class="text-center">
					<p class="text-2xl font-bold">{data.stats.totalHours}h</p>
					<p class="text-muted-foreground text-xs">Total heures</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-bold">{data.stats.monthHours}h</p>
					<p class="text-muted-foreground text-xs">Ce mois</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-bold">{data.stats.upcomingBookings}</p>
					<p class="text-muted-foreground text-xs">À venir</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-bold">{data.stats.totalBookings}</p>
					<p class="text-muted-foreground text-xs">Réservations</p>
				</div>
			</div>
			<p class="text-muted-foreground mt-2 text-center text-xs">Les heures incluent les réservations passées et à venir.</p>
		</Card.Content>
	</Card.Root>

	<!-- Admin ranking -->
	{#if data.ranking}
		<Card.Root>
			<Card.Header>
				<div class="flex items-center justify-between">
					<Card.Title>Classement des résidents</Card.Title>
					<select
						class="bg-muted text-foreground rounded-md border px-2 py-1 text-xs"
						bind:value={rankingPeriod}
					>
						<option value="month">Ce mois</option>
						<option value="all">Tout</option>
					</select>
				</div>
				<p class="text-muted-foreground text-sm">Par heures réservées</p>
			</Card.Header>
			<Card.Content>
				{#if currentRanking.length === 0}
					<p class="text-muted-foreground text-center text-sm">Aucune réservation pour cette période.</p>
				{:else}
					<div class="space-y-3">
						{#each currentRanking as entry, i}
							<div class="flex items-center gap-3">
								<span class="text-muted-foreground w-5 text-right text-sm font-medium">{i + 1}.</span>
								<div class="min-w-0 flex-1">
									<div class="mb-1 flex items-center justify-between">
										<span class="truncate text-sm font-medium">
											{entry.flatNumber}{entry.displayName ? ` — ${entry.displayName}` : ''}
										</span>
										<span class="text-muted-foreground shrink-0 text-xs">{entry.hours}h</span>
									</div>
									<div class="bg-muted h-2 w-full rounded">
										<div
											class="bg-primary h-2 rounded transition-all duration-300"
											style="width: {(entry.hours / maxHours) * 100}%"
										></div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

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
