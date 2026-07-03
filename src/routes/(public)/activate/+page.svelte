<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { ACTIVATION_CODE_LENGTH, isValidFlatNumber, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '$lib/constants';

	let { data } = $props();

	let flatNumber = $state(data.prefill.flat);
	let activationCode = $state(data.prefill.code);
	let displayName = $state(data.prefill.displayName);
	let pin = $state('');
	let confirmPin = $state('');
	let loading = $state(false);

	const normalizedFlat = $derived(flatNumber.trim().toUpperCase());
	const flatValid = $derived(normalizedFlat.length > 0 && isValidFlatNumber(normalizedFlat));
	const canSubmit = $derived(flatValid && activationCode.trim().length > 0 && !loading);

	async function handleActivate() {
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
			const res = await fetch('/api/auth/activate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ flatNumber: normalizedFlat, activationCode, displayName, pin })
			});

			const result = await res.json();

			if (res.ok) {
				toast.success('Appartement activé avec succès !');
				goto('/calendar');
			} else {
				toast.error(result.error || "Échec de l'activation");
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
		<Card.Title class="text-2xl font-bold tracking-tight">Activation</Card.Title>
		<Card.Description>Entrez le code d'activation fourni par l'administrateur de votre immeuble.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={(e) => { e.preventDefault(); handleActivate(); }} class="space-y-4">
		<div class="space-y-2">
			<Label for="flat">Numéro d'appartement</Label>
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
				<p class="text-destructive text-xs">Format requis : A01 ou B12</p>
			{/if}
		</div>
			<div class="space-y-2">
				<Label for="code">Code d'activation</Label>
				<Input
					id="code"
					type="text"
					placeholder="ex. K7X9"
					maxlength={ACTIVATION_CODE_LENGTH}
					class="uppercase"
					bind:value={activationCode}
					required
				/>
			</div>
			<div class="space-y-2">
				<Label for="name">Nom d'affichage (optionnel)</Label>
				<Input id="name" type="text" placeholder="ex. Jean, Famille Dupont" bind:value={displayName} />
			</div>
			<div class="space-y-2">
				<Label for="pin">Choisir un code PIN</Label>
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
			<Label for="pin-confirm">Confirmer le PIN</Label>
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
				{loading ? 'Activation...' : 'Activer'}
			</Button>
		</form>
	</Card.Content>
	<Card.Footer class="flex-col gap-2">
		<p class="text-muted-foreground text-sm">
			Déjà activé ? <a href="/login" class="inline-link font-medium"
				>Se connecter</a
			>
		</p>
	</Card.Footer>
</Card.Root>
</div>
