<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { toast } from 'svelte-sonner';

	let flatNumber = $state('');
	let activationCode = $state('');
	let displayName = $state('');
	let pin = $state('');
	let pinConfirm = $state('');
	let loading = $state(false);

	async function handleActivate() {
		if (!flatNumber || !activationCode || !pin) return;

		if (pin !== pinConfirm) {
			toast.error('Les codes PIN ne correspondent pas');
			return;
		}

		if (pin.length < 4 || pin.length > 6) {
			toast.error('Le PIN doit contenir 4 à 6 chiffres');
			return;
		}

		loading = true;

		try {
			const res = await fetch('/api/auth/activate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ flatNumber, activationCode, displayName, pin })
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

<Card.Root class="shadow-sm">
	<Card.Header class="pb-2 text-center">
		<Card.Title class="text-2xl font-bold tracking-tight">Activation</Card.Title>
		<Card.Description>Entrez le code d'activation fourni par l'administrateur de votre immeuble.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleActivate} class="space-y-4">
			<div class="space-y-2">
				<Label for="flat">Numéro d'appartement</Label>
				<Input id="flat" type="text" placeholder="ex. 3B" bind:value={flatNumber} required />
			</div>
			<div class="space-y-2">
				<Label for="code">Code d'activation</Label>
				<Input
					id="code"
					type="text"
					placeholder="ex. K7X9"
					maxlength={4}
					class="uppercase"
					bind:value={activationCode}
					required
				/>
			</div>
			<div class="space-y-2">
				<Label for="name">Votre prénom (optionnel)</Label>
				<Input id="name" type="text" placeholder="ex. Marc" bind:value={displayName} />
			</div>
			<div class="space-y-2">
				<Label for="pin">Choisir un code PIN</Label>
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
				{loading ? 'Activation...' : 'Activer'}
			</Button>
		</form>
	</Card.Content>
	<Card.Footer class="flex-col gap-2">
		<p class="text-muted-foreground text-sm">
			Déjà activé ? <a href="/login" class="text-primary hover:text-primary/80 font-medium underline transition-colors"
				>Se connecter</a
			>
		</p>
	</Card.Footer>
</Card.Root>
