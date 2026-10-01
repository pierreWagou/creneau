<script lang="ts">
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import FlatContactList from '$lib/components/flat-contact-list.svelte';
	import FlatTextField from '$lib/components/flat-text-field.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import ValidationTip from '$lib/components/validation-tip.svelte';
	import { isValidFlatNumber, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '$lib/constants';
	import { displayPhone, formatPhone } from '$lib/utils/phone';
	import { isValidEmail, isValidPhone } from '$lib/validation';

	let flatNumber = $state('');
	let displayName = $state('');
	let pin = $state('');
	let confirmPin = $state('');
	let loading = $state(false);

	let emails = $state<string[]>([]);
	let phones = $state<string[]>([]);

	const normalizedFlat = $derived(flatNumber.trim().toUpperCase());
	const flatValid = $derived(normalizedFlat.length > 0 && isValidFlatNumber(normalizedFlat));
	const canSubmit = $derived(flatValid && emails.length > 0 && phones.length > 0 && !loading);
	const missingFields = $derived(
		[
			!flatValid && "Numéro d'appartement invalide",
			emails.length === 0 && 'Au moins un e-mail valide',
			phones.length === 0 && 'Au moins un téléphone valide'
		].filter((r): r is string => r !== false)
	);

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
			<FlatTextField
				label="Numéro d'appartement"
				placeholder="ex. B12"
				uppercase
				bind:value={flatNumber}
			/>
			<FlatTextField
				label="Votre prénom"
				placeholder="ex. Marc"
				required={false}
				bind:value={displayName}
			/>

			<Separator />

			<FlatContactList
				title="Emails"
				icon={Mail}
				items={emails}
				placeholder="ex. dupont@email.com"
				inputType="email"
				invalidMessage="Email invalide"
				addLabel="Ajouter un e-mail"
				minItems={0}
				validate={isValidEmail}
				onChange={(e) => (emails = e)}
			/>

			<Separator />

			<FlatContactList
				title="Téléphones"
				icon={Phone}
				items={phones}
				placeholder="+33 6 12 34 56 78"
				inputType="tel"
				invalidMessage="Téléphone invalide"
				addLabel="Ajouter un téléphone"
				minItems={0}
				validate={isValidPhone}
				format={formatPhone}
				display={displayPhone}
				onChange={(p) => (phones = p)}
			/>

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
			{#if !canSubmit}
				<ValidationTip
					show={missingFields.length > 0}
					title="Éléments manquants :"
					items={missingFields}
				>
					<Button type="submit" class="w-full" disabled>
						{loading ? 'Configuration...' : 'Créer le compte administrateur'}
					</Button>
				</ValidationTip>
			{:else}
				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? 'Configuration...' : 'Créer le compte administrateur'}
				</Button>
			{/if}
		</form>
	</Card.Content>
</Card.Root>
</div>
