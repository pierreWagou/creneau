<script lang="ts">
	import Car from '@lucide/svelte/icons/car';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

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

<Card.Root class="shadow-sm">
	<Card.Header class="pb-2 text-center">
		<div class="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl">
			<Car class="text-primary h-6 w-6" />
		</div>
		<Card.Title class="text-2xl font-bold tracking-tight">Créneau</Card.Title>
		<Card.Description>Réservation parking — Metropolitan</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleLogin} class="space-y-4">
			<div class="space-y-2">
				<Label for="flat">Numéro d'appartement</Label>
				<Input id="flat" type="text" placeholder="ex. B12" bind:value={flatNumber} required />
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
		<p class="text-muted-foreground text-sm">
			Première fois ? <a
				href="/activate"
				class="text-primary hover:text-primary/80 font-medium underline transition-colors">Activer mon appartement</a
			>
		</p>
	</Card.Footer>
</Card.Root>
