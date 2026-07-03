<script lang="ts">
	import { Plus, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import Logo from '$lib/components/logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { isValidFlatNumber, isValidSpotNumber } from '$lib/constants';

	let flatNumber = $state('');
	let spotInputs = $state(['']);
	let requesterName = $state('');
	let loading = $state(false);
	let submitted = $state(false);

	function addSpot() {
		spotInputs = [...spotInputs, ''];
	}

	function removeSpot(index: number) {
		if (spotInputs.length <= 1) return;
		spotInputs = spotInputs.filter((_, i) => i !== index);
	}

	function updateSpot(index: number, value: string) {
		spotInputs = spotInputs.map((s, i) => (i === index ? value : s));
	}

	const normalizedFlat = $derived(flatNumber.trim().toUpperCase());
	const validSpots = $derived(spotInputs.map((s) => s.trim()).filter((s) => s.length > 0));
	const flatValid = $derived(normalizedFlat.length > 0 && isValidFlatNumber(normalizedFlat));
	const spotsValid = $derived(validSpots.length > 0 && validSpots.every(isValidSpotNumber));
	const canSubmit = $derived(flatValid && spotsValid && !loading);

	async function handleSubmit() {
		if (!canSubmit) return;
		loading = true;

		try {
			const res = await fetch('/api/requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					flatNumber: normalizedFlat,
					spotNumbers: validSpots,
					requesterName: requesterName.trim() || undefined
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
				<Label>Places de parking</Label>
				{#each spotInputs as _, i}
					<div class="space-y-1">
						<div class="flex gap-2">
							<Input
								type="text"
								placeholder="ex. 01"
								value={spotInputs[i]}
								oninput={(e) => updateSpot(i, e.currentTarget.value)}
								class={spotInputs[i] && !isValidSpotNumber(spotInputs[i]) ? 'border-destructive' : ''}
								required
							/>
							{#if spotInputs.length > 1}
								<Button
									type="button"
									variant="ghost"
									size="icon"
									class="shrink-0"
									onclick={() => removeSpot(i)}
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							{/if}
						</div>
						{#if spotInputs[i] && !isValidSpotNumber(spotInputs[i])}
							<p class="text-destructive text-xs">Format requis : 2 chiffres (ex. 01, 36)</p>
						{/if}
					</div>
				{/each}
				<Button type="button" variant="outline" size="sm" class="w-full" onclick={addSpot}>
					<Plus class="mr-1 h-4 w-4" />
					Ajouter une place
				</Button>
			</div>

				<div class="space-y-2">
					<Label for="name">Nom d'affichage <span class="text-muted-foreground">(optionnel)</span></Label>
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
