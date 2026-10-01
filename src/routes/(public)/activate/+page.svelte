<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import EditableField from '$lib/components/editable-field.svelte';
	import FlatDetailView from '$lib/components/flat-detail-view.svelte';
	import FlatPinForm from '$lib/components/flat-pin-form.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import ValidationTip from '$lib/components/validation-tip.svelte';
	import { ACTIVATION_CODE_LENGTH, isValidFlatNumber } from '$lib/constants';

	let { data } = $props();

	let flatNumber = $state(data.prefill.flat);
	let activationCode = $state(data.prefill.code);
	let displayName = $state(data.prefill.displayName);
	let pin = $state('');
	let confirmPin = $state('');
	let loading = $state(false);
	let pinFormValid = $state(false);
	// PINs are never prefilled: editor open by default, collapses on commit
	let pinEditing = $state(true);

	const normalizedFlat = $derived(flatNumber.trim().toUpperCase());
	const flatValid = $derived(normalizedFlat.length > 0 && isValidFlatNumber(normalizedFlat));

	// Local pencil flows (draft-only, no server call pre-activation).
	// Input drafts live inside FlatDetailView and are seeded from state on start.
	// Editor open by default iff no prefilled number (bare /activate link)
	let numberEditing = $state(!data.prefill.flat);
	const numberEdit = $derived({
		editing: numberEditing,
		saving: false,
		onStart: () => {
			numberEditing = true;
		},
		onCommit: (v: string) => {
			flatNumber = v.trim().toUpperCase();
			// New number = new flat context: drop the stale name, lookup refills it if known
			displayName = '';
			numberEditing = false;
		},
		onCancel: () => {
			numberEditing = false;
		}
	});

	// Invitation code pencil flow (classic field: open by default when empty).
	// Editor open on first paint iff no prefilled code (bare /activate link).
	let codeDraft = $state('');
	let codeInitial = $state('');
	let codeEditing = $state(!data.prefill.code);
	// Focus on pencil-open only, never on mount (same rule as FlatPinForm).
	let codeAutofocus = $state(false);

	function startCodeEdit() {
		codeDraft = activationCode;
		codeInitial = activationCode;
		codeEditing = true;
		codeAutofocus = true;
	}

	function commitCodeEdit() {
		activationCode = codeDraft.trim().toUpperCase();
		codeEditing = false;
		codeAutofocus = false;
	}

	function cancelCodeEdit() {
		codeEditing = false;
		codeAutofocus = false;
	}

	let nameEditing = $state(false);
	const nameEdit = $derived({
		editing: nameEditing,
		saving: false,
		onStart: () => {
			nameEditing = true;
		},
		onCommit: (v: string) => {
			displayName = v;
			nameEditing = false;
		},
		onCancel: () => {
			nameEditing = false;
		}
	});

	// Auto-resolve the display name as the number is typed (debounced).
	// 200 → sync to source of truth; 404/error → keep current value (never wipe while typing).
	let lookupId = 0;
	$effect(() => {
		const target = normalizedFlat;
		if (!flatValid || nameEditing) return;
		const id = ++lookupId;
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/flats/${encodeURIComponent(target)}`);
				if (id !== lookupId) return;
				if (!res.ok) return;
				const data = await res.json();
				if (id !== lookupId || nameEditing) return;
				displayName = data.displayName ?? '';
			} catch {
				// Offline/transient failure: keep current value
			}
		}, 300);
		return () => clearTimeout(timer);
	});
	const canSubmit = $derived(flatValid && activationCode.trim().length > 0 && pinFormValid && !loading);
	const missingFields = $derived(
		[
			!flatValid && "Numéro d'appartement invalide",
			!activationCode.trim() && "Code d'activation manquant",
			!pinFormValid && 'Code PIN invalide'
		].filter((r): r is string => r !== false)
	);

	async function handleActivate() {
		if (!canSubmit) return;

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
		<div class="space-y-4">
			<FlatDetailView
				number={normalizedFlat}
				displayName={displayName.trim() || null}
				{nameEdit}
				{numberEdit}
				securityOnly
			>
				{#snippet security()}
					<div class="space-y-4">
						<div>
							<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Invitation</p>
							<div class="rounded-xl border border-border p-4">
								<EditableField
									editing={codeEditing}
									editLabel="Modifier le code"
									onStart={startCodeEdit}
									bind:value={codeDraft}
									initial={codeInitial}
									placeholder="ex. K7X9"
									ariaLabel="Code d'activation"
									maxlength={ACTIVATION_CODE_LENGTH}
									mono
									inputClass="text-sm font-semibold"
									committable={codeDraft.trim().length > 0}
									autofocus={codeAutofocus}
									onCommit={commitCodeEdit}
									onCancel={cancelCodeEdit}
								>
									{#snippet display()}
										{#if activationCode}
											<span class="block truncate font-mono text-sm font-semibold">{activationCode}</span>
										{:else}
											<span class="block text-sm text-muted-foreground">—</span>
										{/if}
									{/snippet}
								</EditableField>
							</div>
						</div>
						<FlatPinForm
							collectOnly
							bind:editing={pinEditing}
							bind:newPin={pin}
							bind:confirmPin={confirmPin}
							bind:valid={pinFormValid}
						/>
					</div>
				{/snippet}
			</FlatDetailView>
			{#if !canSubmit}
				<ValidationTip
					show={missingFields.length > 0}
					title="Éléments manquants :"
					items={missingFields}
				>
					<Button class="w-full" disabled>Activer</Button>
				</ValidationTip>
			{:else}
				<Button class="w-full" disabled={loading} onclick={handleActivate}>
					{loading ? 'Activation...' : 'Activer'}
				</Button>
			{/if}
		</div>
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
