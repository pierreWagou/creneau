<script lang="ts">
	import { Plus, Trash2 } from '@lucide/svelte';
	import CarFront from '@lucide/svelte/icons/car-front';
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { DISPLAY_NAME_MAX_LENGTH, MAX_CONTACTS_PER_TYPE, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '$lib/constants';
	import { displayPhone, formatPhone } from '$lib/utils/phone';

	let { data } = $props();

	// Display name editing
	let displayName = $state(data.flat.displayName ?? '');
	let savingName = $state(false);

	// Contacts
	let emails = $state<string[]>([...(data.flat.emails ?? [])]);
	let phones = $state<string[]>([...(data.flat.phones ?? [])]);
	let newEmail = $state('');
	let newPhone = $state('');

	const emailValid = $derived(newEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail));
	const phoneValid = $derived(newPhone.length === 0 || /^[\d\s\-+()]+$/.test(newPhone));
	const canAddEmail = $derived(emailValid && newEmail.trim().length > 0 && emails.length < MAX_CONTACTS_PER_TYPE);
	const canAddPhone = $derived(phoneValid && newPhone.trim().length > 0 && phones.length < MAX_CONTACTS_PER_TYPE);
	const canRemoveEmail = $derived(emails.length > 1);
	const canRemovePhone = $derived(phones.length > 1);

	function addEmail() {
		if (!canAddEmail) return;
		const trimmed = newEmail.trim();
		if (!emails.includes(trimmed)) {
			emails = [...emails, trimmed];
			persistContacts();
		}
		newEmail = '';
	}

	function removeEmail(index: number) {
		if (!canRemoveEmail) return;
		emails = emails.filter((_, i) => i !== index);
		persistContacts();
	}

	function addPhone() {
		if (!canAddPhone) return;
		const formatted = formatPhone(newPhone.trim());
		if (!phones.includes(formatted)) {
			phones = [...phones, formatted];
			persistContacts();
		}
		newPhone = '';
	}

	function removePhone(index: number) {
		if (!canRemovePhone) return;
		phones = phones.filter((_, i) => i !== index);
		persistContacts();
	}

	async function persistContacts() {
		if (emails.length === 0 || phones.length === 0) return;
		try {
			const res = await fetch('/api/account', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ emails, phones })
			});
			if (res.ok) {
				toast.success('Contacts mis à jour');
			} else {
				const { error } = await res.json();
				toast.error(error || 'Erreur lors de la mise à jour');
			}
		} catch {
			toast.error('Erreur réseau');
		}
	}

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
			<div class="space-y-2 text-sm">
				<div class="flex items-center gap-2">
					<CarFront class="text-muted-foreground h-4 w-4 shrink-0" />
					<span class="font-medium">Places de parking</span>
				</div>
				{#if data.spots.length > 0}
					<span class="flex flex-wrap items-center gap-1">
						{#each data.spots as s}
							<Badge variant="outline">{s.number}</Badge>
						{/each}
					</span>
				{:else}
					<p class="text-muted-foreground">Aucune place de parking assignée</p>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Contacts -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Coordonnées</Card.Title>
			<p class="text-muted-foreground text-sm">Emails et téléphones de contact</p>
		</Card.Header>
		<Card.Content class="space-y-4">
			<!-- Emails -->
			<div class="space-y-2">
				<Label class="flex items-center gap-2"><Mail class="text-muted-foreground h-4 w-4" />Emails</Label>
			{#each emails as email, i}
				<div class="flex items-center gap-2">
					<a href="mailto:{email}" class="flex-1 text-sm underline-offset-2 hover:underline">{email}</a>
					{#if canRemoveEmail}
						<Button type="button" variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive hover:!bg-destructive/10" onclick={() => removeEmail(i)}>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
					{/if}
				</div>
			{/each}
				{#if emails.length < MAX_CONTACTS_PER_TYPE}
					<div class="flex gap-2">
						<Input
							type="email"
							placeholder="ex. dupont@email.com"
							bind:value={newEmail}
							class={!emailValid && newEmail.length > 0 ? 'border-destructive' : ''}
							onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
						/>
						<Button type="button" size="sm" variant="default" class="shrink-0" disabled={!canAddEmail} onclick={addEmail}>
							<Plus class="h-4 w-4" />
						</Button>
					</div>
					{#if newEmail.length > 0 && !emailValid}
						<p class="text-destructive text-xs">Email invalide</p>
					{/if}
				{/if}
			</div>

			<Separator />

			<!-- Phones -->
			<div class="space-y-2">
				<Label class="flex items-center gap-2"><Phone class="text-muted-foreground h-4 w-4" />Téléphones</Label>
			{#each phones as phone, i}
				<div class="flex items-center gap-2">
					<a href="tel:{phone}" class="flex-1 text-sm underline-offset-2 hover:underline">{displayPhone(phone)}</a>
					{#if canRemovePhone}
						<Button type="button" variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive hover:!bg-destructive/10" onclick={() => removePhone(i)}>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
					{/if}
				</div>
			{/each}
				{#if phones.length < MAX_CONTACTS_PER_TYPE}
					<div class="flex gap-2">
						<Input
							type="tel"
							placeholder="+33 6 12 34 56 78"
							bind:value={newPhone}
							class={!phoneValid && newPhone.length > 0 ? 'border-destructive' : ''}
							onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPhone(); } }}
						/>
						<Button type="button" size="sm" variant="default" class="shrink-0" disabled={!canAddPhone} onclick={addPhone}>
							<Plus class="h-4 w-4" />
						</Button>
					</div>
					{#if newPhone.length > 0 && !phoneValid}
						<p class="text-destructive text-xs">Téléphone invalide</p>
					{/if}
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Security -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Sécurité</Card.Title>
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

			<Separator />

			<Button variant="outline" class="text-destructive w-full" onclick={handleLogout}>Se déconnecter</Button>
		</Card.Content>
	</Card.Root>
</div>
