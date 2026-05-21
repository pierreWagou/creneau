<script lang="ts">
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '$lib/constants';

	let flatNumber = $state('');
	let displayName = $state('');
	let pin = $state('');
	let pinConfirm = $state('');
	let loading = $state(false);

	async function handleSetup() {
		if (!flatNumber || !pin) return;

		if (pin !== pinConfirm) {
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
				body: JSON.stringify({ flatNumber, displayName, pin })
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
				<Label for="flat">Numéro d'appartement</Label>
				<Input id="flat" type="text" placeholder="ex. B12" bind:value={flatNumber} required />
			</div>
			<div class="space-y-2">
				<Label for="name">Votre prénom (optionnel)</Label>
				<Input id="name" type="text" placeholder="ex. Marc" bind:value={displayName} />
			</div>
			<div class="space-y-2">
				<Label for="pin">Code PIN</Label>
				<Input
					id="pin"
					type="password"
					inputmode="numeric"
					pattern="[0-9]*"
					maxlength={6}
					placeholder="4 à 6 chiffres"
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
					maxlength={6}
					placeholder="4 à 6 chiffres"
					bind:value={pinConfirm}
					required
				/>
			</div>
			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? 'Configuration...' : 'Créer le compte administrateur'}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
