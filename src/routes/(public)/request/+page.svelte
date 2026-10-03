<script lang="ts">
	import { toast } from 'svelte-sonner';
	import FlatDetailView from '$lib/components/flat-detail-view.svelte';
	import Logo from '$lib/components/logo.svelte';
	import type { SpotDirectory } from '$lib/components/spot-picker.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
		import { describeSharedPoolConflicts, describeSpotConflicts, findSpotConflicts } from '$lib/utils/spots';

	let { data } = $props();

	let flatNumber = $state('');
	let reqSpots = $state<string[]>([]);
	let reqEmails = $state<string[]>([]);
	let reqPhones = $state<string[]>([]);
	let requesterName = $state('');
	let loading = $state(false);
	let submitted = $state(false);
	let formValid = $state(true);

	// Create-form pencil flows (draft-only; number editor open by default on empty form)
	let reqNumberEditing = $state(true);
	let reqNameEditing = $state(false);
	const reqNumberEdit = $derived({
		editing: reqNumberEditing,
		saving: false,
		onStart: () => {
			reqNumberEditing = true;
		},
		onCommit: (v: string) => {
			flatNumber = v.trim().toUpperCase();
			reqNumberEditing = false;
		},
		onCancel: () => {
			reqNumberEditing = false;
		}
	});
	const reqNameEdit = $derived({
		editing: reqNameEditing,
		saving: false,
		onStart: () => {
			reqNameEditing = true;
		},
		onCommit: (v: string) => {
			requesterName = v;
			reqNameEditing = false;
		},
		onCancel: () => {
			reqNameEditing = false;
		}
	});

	const normalizedFlat = $derived(flatNumber.trim().toUpperCase());

	const spotDirectory: SpotDirectory = $derived({
		all: data.spots,
		maskHolder: true
	});
	const spotConflicts = $derived([
		...describeSpotConflicts(findSpotConflicts(reqSpots, data.spots, normalizedFlat), data.spots),
		...describeSharedPoolConflicts(reqSpots, data.spots)
	]);

	async function handleSubmit() {
		if (!formValid || loading) return;
		loading = true;

		try {
			const res = await fetch('/api/requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					flatNumber: normalizedFlat,
					spotNumbers: reqSpots,
					requesterName: requesterName.trim() || undefined,
					emails: reqEmails,
					phones: reqPhones
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
		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<FlatDetailView
				showLifecycle={false}
				bind:number={flatNumber}
				bind:displayName={requesterName}
				numberEdit={reqNumberEdit}
				nameEdit={reqNameEdit}
				spotsEditable
				contactsEditable
				bind:spots={reqSpots}
				bind:emails={reqEmails}
				bind:phones={reqPhones}
				minItems={0}
				{spotDirectory}
				{spotConflicts}
				maskHolder
				bind:valid={formValid}
				submitLabel={loading ? 'Envoi...' : 'Envoyer la demande'}
				submitting={loading}
				onSubmit={handleSubmit}
			/>
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
