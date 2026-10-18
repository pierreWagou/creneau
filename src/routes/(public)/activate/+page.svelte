<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import EditableField from '$lib/components/editable-field.svelte';
	import FlatDetailView from '$lib/components/flat-detail-view.svelte';
	import FlatPinForm from '$lib/components/flat-pin-form.svelte';
	import * as Card from '$lib/components/ui/card';
	import ValidatedSubmit from '$lib/components/validated-submit.svelte';
	import { ACTIVATION_CODE_LENGTH, isValidFlatNumber, SEARCH_DEBOUNCE_MS } from '$lib/constants';
	import { apiFetch } from '$lib/utils/api';
	import { notifyResult } from '$lib/utils/toasts';
	import { normalizeFlatNumber } from '$lib/validation';

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

	const normalizedFlat = $derived(normalizeFlatNumber(flatNumber));
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
			flatNumber = normalizeFlatNumber(v);
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
			const result = await apiFetch<{ displayName?: string | null }>(
				`/api/flats/${encodeURIComponent(target)}`
			);
			if (id !== lookupId) return;
			if (!result.ok || !result.data) return;
			if (nameEditing) return;
			displayName = result.data.displayName ?? '';
		}, SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	});
	const canSubmit = $derived(flatValid && activationCode.trim().length > 0 && pinFormValid && !loading);
	const missingFields = $derived(
		[
			!flatValid && "Numéro de lot invalide",
			!activationCode.trim() && "Code d'activation manquant",
			!pinFormValid && 'Code PIN invalide'
		].filter((r): r is string => r !== false)
	);

	async function handleActivate() {
		if (!canSubmit) return;

		loading = true;

		const result = await apiFetch(
			'/api/auth/activate',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ flatNumber: normalizedFlat, activationCode, displayName, pin })
			},
			"Échec de l'activation"
		);

		if (result.ok) {
			toast.success('Lot activé avec succès');
			goto('/calendar');
		} else {
			notifyResult(result, null, "Échec de l'activation");
		}
		loading = false;
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
							<p class="dialog-section-label mb-2">Invitation</p>
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
									focusOnOpen={codeAutofocus}
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
			<ValidatedSubmit
				valid={canSubmit}
				showTip={missingFields.length > 0}
				tipItems={missingFields}
				submitLabel="Activer"
				loadingLabel="Activation…"
				disabled={loading}
				{loading}
				onclick={handleActivate}
			/>
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
