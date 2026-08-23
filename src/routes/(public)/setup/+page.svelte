<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { isValidFlatNumber, MAX_CONTACTS_PER_TYPE, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '$lib/constants';
	import { displayPhone, formatPhone } from '$lib/utils/phone';

	let flatNumber = $state('');
	let displayName = $state('');
	let pin = $state('');
	let confirmPin = $state('');
	let loading = $state(false);

	let emails = $state<string[]>([]);
	let phones = $state<string[]>([]);
	let newEmail = $state('');
	let newPhone = $state('');

	const normalizedFlat = $derived(flatNumber.trim().toUpperCase());
	const flatValid = $derived(normalizedFlat.length > 0 && isValidFlatNumber(normalizedFlat));
	const emailValid = $derived(newEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail));
	const phoneValid = $derived(newPhone.length === 0 || /^[\d\s\-+()]+$/.test(newPhone));
	const canAddEmail = $derived(emailValid && newEmail.trim().length > 0 && emails.length < MAX_CONTACTS_PER_TYPE);
	const canAddPhone = $derived(phoneValid && newPhone.trim().length > 0 && phones.length < MAX_CONTACTS_PER_TYPE);
	const canSubmit = $derived(flatValid && emails.length > 0 && phones.length > 0 && !loading);

	function addEmail() {
		if (!canAddEmail) return;
		const trimmed = newEmail.trim();
		if (!emails.includes(trimmed)) {
			emails = [...emails, trimmed];
		}
		newEmail = '';
	}

	function removeEmail(index: number) {
		emails = emails.filter((_, i) => i !== index);
	}

	function addPhone() {
		if (!canAddPhone) return;
		const formatted = formatPhone(newPhone.trim());
		if (!phones.includes(formatted)) {
			phones = [...phones, formatted];
		}
		newPhone = '';
	}

	function removePhone(index: number) {
		phones = phones.filter((_, i) => i !== index);
	}

	async function handleSetup() {
		if (!canSubmit) return;

		if (pin !== confirmPin) {
			toast.error('Les codes PIN ne correspondent pas');
			return;
		}

		if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
			toast.error(`Le PIN doit contenir ${PIN_MIN_LENGTH} à ${PIN_MAX_LENGTH} chiffres`);
			return;
		}

		if (!/^\d+$/.test(pin)) {
			toast.error('Le PIN ne doit contenir que des chiffres');
			return;
		}

		loading = true;

		try {
			const res = await fetch('/api/auth/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ flatNumber: normalizedFlat, displayName, pin, emails, phones })
			});

			const result = await res.json();

			if (res.ok) {
				toast.success('Compte administrateur créé !');
				goto('/calendar');
			} else {
				toast.error(result.error || 'Échec de la configuration');
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
		<div class="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl">
			<ShieldCheck class="text-primary h-6 w-6" />
		</div>
		<Card.Title class="text-2xl font-bold tracking-tight">Configuration initiale</Card.Title>
		<Card.Description>Créez le premier compte administrateur pour votre immeuble.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={(e) => { e.preventDefault(); handleSetup(); }} class="space-y-4">
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
				<Label for="name">Votre prénom</Label>
				<Input id="name" type="text" placeholder="ex. Marc" bind:value={displayName} />
			</div>

			<Separator />

			<div class="space-y-2">
				<Label>Emails <span class="text-destructive">*</span></Label>
				{#each emails as email, i}
					<div class="flex items-center gap-2">
						<span class="flex-1 text-sm">{email}</span>
						<Button type="button" variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive hover:!bg-destructive/10" onclick={() => removeEmail(i)}>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
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

			<div class="space-y-2">
				<Label>Téléphones <span class="text-destructive">*</span></Label>
				{#each phones as phone, i}
					<div class="flex items-center gap-2">
						<span class="flex-1 text-sm">{displayPhone(phone)}</span>
						<Button type="button" variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive hover:!bg-destructive/10" onclick={() => removePhone(i)}>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
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

			<Separator />

			<div class="space-y-2">
				<Label for="pin">Code PIN <span class="text-destructive">*</span></Label>
				<Input
					id="pin"
					type="password"
					inputmode="numeric"
					pattern="[0-9]*"
				maxlength={PIN_MAX_LENGTH}
				placeholder="{PIN_MIN_LENGTH} à {PIN_MAX_LENGTH} chiffres"
				bind:value={pin}
				required
			/>
		</div>
		<div class="space-y-2">
			<Label for="pin-confirm">Confirmer le PIN <span class="text-destructive">*</span></Label>
			<Input
				id="pin-confirm"
				type="password"
				inputmode="numeric"
				pattern="[0-9]*"
				maxlength={PIN_MAX_LENGTH}
				placeholder="{PIN_MIN_LENGTH} à {PIN_MAX_LENGTH} chiffres"
				bind:value={confirmPin}
					required
				/>
			</div>
			<Button type="submit" class="w-full" disabled={!canSubmit}>
				{loading ? 'Configuration...' : 'Créer le compte administrateur'}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
</div>
