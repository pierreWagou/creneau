<script lang="ts">
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import FlatContactList from '$lib/components/flat-contact-list.svelte';
	import FlatTextField from '$lib/components/flat-text-field.svelte';
	import FormField from '$lib/components/form-field.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Separator } from '$lib/components/ui/separator';
	import ValidatedSubmit from '$lib/components/validated-submit.svelte';
	import { isValidFlatNumber, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '$lib/constants';
	import { apiFetch } from '$lib/utils/api';
	import { displayPhone, formatPhone } from '$lib/utils/phone';
	import { notifyResult } from '$lib/utils/toasts';
	import { isValidEmail, isValidPhone, normalizeFlatNumber, validatePin } from '$lib/validation';

	let flatNumber = $state('');
	let displayName = $state('');
	let pin = $state('');
	let confirmPin = $state('');
	let loading = $state(false);

	let emails = $state<string[]>([]);
	let phones = $state<string[]>([]);

	const normalizedFlat = $derived(normalizeFlatNumber(flatNumber));
	const flatValid = $derived(normalizedFlat.length > 0 && isValidFlatNumber(normalizedFlat));
	const canSubmit = $derived(flatValid && emails.length > 0 && phones.length > 0 && !loading);
	const missingFields = $derived(
		[
			!flatValid && "Numéro de lot invalide",
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

		const pinError = validatePin(pin);
		if (pinError) {
			toast.error(pinError);
			return;
		}

		loading = true;

		const result = await apiFetch(
			'/api/auth/setup',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ flatNumber: normalizedFlat, displayName, pin, emails, phones })
			},
			'Échec de la configuration'
		);

		if (result.ok) {
			toast.success('Compte administrateur créé');
			goto('/calendar');
		} else {
			notifyResult(result, null, 'Échec de la configuration');
		}
		loading = false;
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
				label="Numéro de lot"
				placeholder="ex. B12"
				uppercase
				bind:value={flatNumber}
			/>
			<FlatTextField
				label="Votre prénom"
				placeholder="ex. Famille Dupont"
				required={false}
				bind:value={displayName}
			/>

			<Separator />

			<FlatContactList
				title="E-mails"
				icon={Mail}
				items={emails}
				placeholder="ex. dupont@email.com"
				inputType="email"
				invalidMessage="E-mail invalide"
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
				placeholder="ex. +33 6 12 34 56 78"
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

			<FormField label="Code PIN" for="pin" required>
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
			</FormField>
			<FormField label="Confirmer le PIN" for="pin-confirm" required>
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
			</FormField>
			<ValidatedSubmit
				valid={canSubmit}
				showTip={missingFields.length > 0}
				tipItems={missingFields}
				type="submit"
				submitLabel="Créer le compte administrateur"
				loadingLabel="Configuration…"
				disabled={loading}
				{loading}
			/>
		</form>
	</Card.Content>
</Card.Root>
</div>
