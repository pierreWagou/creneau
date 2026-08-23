<script lang="ts">
	import { Plus, Trash2 } from '@lucide/svelte';
	import CarFront from '@lucide/svelte/icons/car-front';
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import { toast } from 'svelte-sonner';
	import Logo from '$lib/components/logo.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { formatSpotNumber, isValidFlatNumber, isValidSpotNumber } from '$lib/constants';
	import { displayPhone, formatPhone } from '$lib/utils/phone';

	let flatNumber = $state('');
	let addedSpots = $state<string[]>([]);
	let addedEmails = $state<string[]>([]);
	let addedPhones = $state<string[]>([]);
	let newSpot = $state('');
	let newEmail = $state('');
	let newPhone = $state('');
	let requesterName = $state('');
	let loading = $state(false);
	let submitted = $state(false);

	const normalizedFlat = $derived(flatNumber.trim().toUpperCase());
	const flatValid = $derived(normalizedFlat.length > 0 && isValidFlatNumber(normalizedFlat));

	const spotValid = $derived(newSpot.trim().length > 0 && isValidSpotNumber(newSpot.trim()));
	const emailValid = $derived(newEmail.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim()));
	const phoneValid = $derived(newPhone.trim().length > 0 && /^[\d\s\-+()]+$/.test(newPhone.trim()));

	const canSubmit = $derived(
		flatValid && addedSpots.length > 0 && addedEmails.length > 0 && addedPhones.length > 0 && !loading
	);

	function addSpot() {
		const formatted = formatSpotNumber(newSpot.trim());
		if (formatted.length === 0 || !isValidSpotNumber(formatted)) return;
		if (addedSpots.includes(formatted)) {
			toast.error(`La place de parking ${formatted} est déjà dans la liste`);
		} else {
			addedSpots = [...addedSpots, formatted];
		}
		newSpot = '';
	}

	function removeSpot(index: number) {
		addedSpots = addedSpots.filter((_, i) => i !== index);
	}

	function addEmail() {
		const trimmed = newEmail.trim();
		if (trimmed.length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
		addedEmails = [...addedEmails, trimmed];
		newEmail = '';
	}

	function removeEmail(index: number) {
		addedEmails = addedEmails.filter((_, i) => i !== index);
	}

	function addPhone() {
		const trimmed = newPhone.trim();
		if (trimmed.length === 0 || !/^[\d\s\-+()]+$/.test(trimmed)) return;
		const formatted = formatPhone(trimmed);
		addedPhones = [...addedPhones, formatted];
		newPhone = '';
	}

	function removePhone(index: number) {
		addedPhones = addedPhones.filter((_, i) => i !== index);
	}

	async function handleSubmit() {
		if (!canSubmit) return;
		loading = true;

		try {
			const res = await fetch('/api/requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					flatNumber: normalizedFlat,
					spotNumbers: addedSpots,
					requesterName: requesterName.trim() || undefined,
					emails: addedEmails,
					phones: addedPhones
				})
			});

			const result = await res.json();

			if (res.ok) {
				submitted = true;
			} else {
				toast.error(result.error || "Erreur lors de l'envoi");
			}
		} catch {
			toast.error('Erreur de connexion');
		} finally {
			loading = false;
		}
	}
</script>

<div class="mx-auto w-full max-w-sm">
<Card.Root class="shadow-sm">
	<Card.Header class="pb-2 text-center">
		<div class="mx-auto mb-2">
			<Logo class="h-10 w-10" />
		</div>
		<Card.Title class="text-2xl font-bold tracking-tight">Créneau</Card.Title>
		<Card.Description>Demande d'accès — Metropolitan</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if submitted}
			<div class="space-y-4 text-center">
				<p class="text-foreground font-medium">Demande envoyée !</p>
				<p class="text-muted-foreground text-sm">
					Votre demande a été transmise aux administrateurs. Vous serez contacté
					pour finaliser l'activation de votre compte.
				</p>
				<a href="/login">
					<Button variant="outline" class="w-full">Retour à la connexion</Button>
				</a>
			</div>
		{:else}
		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
			<div class="space-y-2">
				<Label for="flat">Numéro d'appartement <span class="text-destructive">*</span></Label>
				<Input
					id="flat"
					type="text"
					placeholder="ex. B12"
					bind:value={flatNumber}
					oninput={() => { flatNumber = flatNumber.toUpperCase(); }}
					class={flatNumber && !flatValid ? 'border-destructive' : ''}
					required
				/>
				{#if flatNumber && !flatValid}
					<p class="text-destructive text-xs">Format requis : ex. A01 ou B12</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label class="flex items-center gap-2"><CarFront class="text-muted-foreground h-4 w-4" />Places de parking <span class="text-destructive">*</span></Label>
				<span class="flex flex-wrap items-center gap-1">
					{#each addedSpots as spot, i}
					<Badge variant="outline" class="gap-1">
						{spot}
						{#if addedSpots.length > 1}
							<button type="button" class="ml-0.5 text-muted-foreground hover:text-destructive" onclick={() => removeSpot(i)}>
								<Trash2 class="h-3 w-3" />
							</button>
						{/if}
					</Badge>
					{/each}
				</span>
				<div class="flex gap-2">
					<Input
						type="text"
						placeholder="ex. 01"
						bind:value={newSpot}
						class={newSpot.length > 0 && !spotValid ? 'border-destructive' : ''}
						onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpot(); } }}
					/>
					<Button type="button" size="sm" variant="default" class="shrink-0" disabled={!spotValid} onclick={addSpot}>
						<Plus class="h-4 w-4" />
					</Button>
				</div>
				{#if newSpot.length > 0 && !spotValid}
					<p class="text-destructive text-xs">Format requis : 1 ou 2 chiffres (ex. 3, 01, 36)</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label class="flex items-center gap-2"><Mail class="text-muted-foreground h-4 w-4" />Emails <span class="text-destructive">*</span></Label>
				{#each addedEmails as email, i}
					<div class="flex items-center gap-2">
						<span class="flex-1 text-sm">{email}</span>
						<Button type="button" variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive hover:!bg-destructive/10" onclick={() => removeEmail(i)}>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
					</div>
				{/each}
				<div class="flex gap-2">
					<Input
						type="email"
						placeholder="ex. dupont@email.com"
						bind:value={newEmail}
						class={newEmail.length > 0 && !emailValid ? 'border-destructive' : ''}
						onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
					/>
					<Button type="button" size="sm" variant="default" class="shrink-0" disabled={!emailValid} onclick={addEmail}>
						<Plus class="h-4 w-4" />
					</Button>
				</div>
				{#if newEmail.length > 0 && !emailValid}
					<p class="text-destructive text-xs">Email invalide</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label class="flex items-center gap-2"><Phone class="text-muted-foreground h-4 w-4" />Téléphones <span class="text-destructive">*</span></Label>
				{#each addedPhones as phone, i}
					<div class="flex items-center gap-2">
						<span class="flex-1 text-sm">{displayPhone(phone)}</span>
						<Button type="button" variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive hover:!bg-destructive/10" onclick={() => removePhone(i)}>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
					</div>
				{/each}
				<div class="flex gap-2">
					<Input
						type="tel"
						placeholder="+33 6 12 34 56 78"
						bind:value={newPhone}
						class={newPhone.length > 0 && !phoneValid ? 'border-destructive' : ''}
						onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPhone(); } }}
					/>
					<Button type="button" size="sm" variant="default" class="shrink-0" disabled={!phoneValid} onclick={addPhone}>
						<Plus class="h-4 w-4" />
					</Button>
				</div>
				{#if newPhone.length > 0 && !phoneValid}
					<p class="text-destructive text-xs">Téléphone invalide</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="name">Nom d'affichage</Label>
				<Input
					id="name"
					type="text"
					placeholder="ex. Jean, Famille Dupont"
					bind:value={requesterName}
				/>
			</div>

			<Button type="submit" class="w-full" disabled={!canSubmit}>
				{loading ? 'Envoi...' : 'Envoyer la demande'}
			</Button>
		</form>
		{/if}
	</Card.Content>
	<Card.Footer class="flex-col gap-2">
		<p class="text-muted-foreground text-sm">
			Déjà un compte ? <a href="/login" class="inline-link font-medium">Se connecter</a>
		</p>
	</Card.Footer>
</Card.Root>
</div>
