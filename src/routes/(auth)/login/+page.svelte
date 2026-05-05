<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let flatNumber = $state('');
	let pin = $state('');
	let loading = $state(false);

	async function handleLogin() {
		if (!flatNumber || !pin) return;
		loading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ flatNumber, pin })
			});

			const result = await res.json();

			if (res.ok) {
				goto('/calendar');
			} else {
				toast.error(result.error || 'Connexion impossible');
			}
		} catch {
			toast.error('Erreur de connexion');
		} finally {
			loading = false;
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-2xl">Créneau</Card.Title>
		<Card.Description>Entrez votre numéro d'appartement et votre code PIN pour accéder au système de réservation.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleLogin} class="space-y-4">
			<div class="space-y-2">
				<Label for="flat">Numéro d'appartement</Label>
				<Input
					id="flat"
					type="text"
					placeholder="ex. 3B"
					bind:value={flatNumber}
					required
				/>
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
			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? 'Connexion...' : 'Se connecter'}
			</Button>
		</form>
	</Card.Content>
	<Card.Footer class="flex-col gap-2">
		<p class="text-sm text-muted-foreground">
			Première fois ? <a href="/activate" class="underline text-primary">Activer mon appartement</a>
		</p>
	</Card.Footer>
</Card.Root>
