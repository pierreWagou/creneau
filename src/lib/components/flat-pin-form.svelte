<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '$lib/constants';
	import CommitIcon from './commit-icon.svelte';

	interface Props {
		/** Show the current-PIN field (owner flow; admins set PINs without it) */
		requireCurrentPin?: boolean;
		submitting?: boolean;
		currentPin?: string;
		newPin?: string;
		confirmPin?: string;
		/** Return true on success (fields clear); false keeps the draft. Unused in collect mode. */
		onSubmit?: (pins: { currentPin: string; newPin: string }) => Promise<boolean>;
		/** Mirrored out for parent submit guards (cf. FlatDetailView) */
		valid?: boolean;
		/**
		 * Collect mode (e.g. activation): ✓ collapses the editor without
		 * submitting — drafts stay in the parent-owned bindables for a
		 * joint submit elsewhere. Non-collect behavior unchanged.
		 */
		collectOnly?: boolean;
		/** Open editor on mount, hide pencil/✓✕ (mandatory-entry flows like activation) */
		startExpanded?: boolean;
		/** Bindable editor visibility; defaults to `startExpanded`, parent may own initial state */
		editing?: boolean;
		/** Rendered auth modes; row hidden while a single mode exists */
		modes?: string[];
	}

	let {
		requireCurrentPin = false,
		submitting = false,
		currentPin = $bindable(''),
		newPin = $bindable(''),
		confirmPin = $bindable(''),
		onSubmit,
		collectOnly = false,
		valid = $bindable(true),
		startExpanded = false,
		editing = $bindable(startExpanded),
		modes = ['PIN']
	}: Props = $props();

	let currentInput: HTMLInputElement | null = $state(null);
	let newInput: HTMLInputElement | null = $state(null);

	const pinMismatch = $derived(newPin.length > 0 && confirmPin.length > 0 && newPin !== confirmPin);
	const pinValid = $derived(
		newPin.length >= PIN_MIN_LENGTH &&
			newPin.length <= PIN_MAX_LENGTH &&
			/^\d+$/.test(newPin) &&
			newPin === confirmPin &&
			(!requireCurrentPin || currentPin.length >= PIN_MIN_LENGTH)
	);

	// No autofocus on mount: the editor may already be open on page load
	// (startExpanded or parent-owned initial state) and stealing focus would pop
	// the mobile keyboard uninvited. Focus stays user-initiated (pencil tap).
	// The flag lives inside untrack: reading/writing it must not re-trigger this effect.
	let firstRun = true;
	$effect(() => {
		const open = editing && !startExpanded;
		const skip = untrack(() => firstRun);
		untrack(() => {
			firstRun = false;
		});
		if (open && !skip) (currentInput ?? newInput)?.focus();
	});

	$effect(() => {
		valid = pinValid;
	});

	function startEdit() {
		editing = true;
	}

	function cancelEdit() {
		if (startExpanded) return;
		editing = false;
		currentPin = '';
		newPin = '';
		confirmPin = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') cancelEdit();
	}

	async function submit() {
		if (!pinValid || submitting) return;
		if (collectOnly) {
			if (!startExpanded) editing = false;
			return;
		}
		if ((await onSubmit?.({ currentPin, newPin })) ?? false) {
			currentPin = '';
			newPin = '';
			confirmPin = '';
			editing = false;
		}
	}
</script>

<div
	onfocusout={(e) => {
		// Only abandoning an input counts as leaving the draft: blurs from buttons
		// (notably the opener pencil unmounting on open) must never commit/cancel.
		if (!(e.target instanceof HTMLInputElement)) return;
		// Tap-outside: collect valid drafts (collapse, keep), otherwise clear + collapse.
		// Never blur-submits to a server, never traps on invalid.
		if (!editing || e.currentTarget.contains(e.relatedTarget as Node | null)) return;
		if (pinValid && collectOnly) submit();
		else cancelEdit();
	}}
>
	<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Authentification</p>
	<div class="rounded-xl border border-border p-4 space-y-4">
		{#if modes.length > 1}
		<div>
			<div class="flex items-center justify-between gap-3 min-h-8">
				<span class="text-sm text-muted-foreground">Mode</span>
				<select
					aria-label="Mode d'authentification"
					disabled
					class="bg-transparent text-sm font-semibold cursor-not-allowed"
				>
					{#each modes as m}
						<option value={m.toLowerCase()}>{m}</option>
					{/each}
				</select>
			</div>
		</div>
		{/if}
		<div class={modes.length > 1 ? 'border-t border-border pt-4' : ''}>
			<div class="flex items-center justify-between gap-3 min-h-8">
				<span class="text-sm text-muted-foreground">Code PIN</span>
				{#if !startExpanded}
					{#if editing}
					<div class="flex items-center gap-1 shrink-0">
						<CommitIcon
							state={submitting
								? 'busy'
								: pinValid
									? 'ready'
									: currentPin.length > 0 || newPin.length > 0 || confirmPin.length > 0
										? 'invalid'
										: 'empty'}
							onCommit={submit}
						/>
					</div>
				{:else}
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						class="shrink-0 text-muted-foreground hover:text-foreground hover:!bg-muted"
						aria-label="Modifier le PIN"
						onclick={startEdit}
					>
						<Pencil class="h-3.5 w-3.5" />
						</Button>
					{/if}
				{/if}
				</div>
				{#if editing}
				<div class="space-y-2 mt-1.5" onkeydown={handleKeydown} role="presentation">
					{#if requireCurrentPin}
						<Input
							bind:ref={currentInput}
							type="password"
							inputmode="numeric"
							placeholder="PIN actuel"
							aria-label="PIN actuel"
							bind:value={currentPin}
							maxlength={PIN_MAX_LENGTH}
							disabled={submitting}
						/>
					{/if}
						<Input
							bind:ref={newInput}
							type="password"
							inputmode="numeric"
							placeholder="Nouveau PIN"
						aria-label="Nouveau PIN"
						bind:value={newPin}
						maxlength={PIN_MAX_LENGTH}
						disabled={submitting}
					/>
						<Input
							type="password"
							inputmode="numeric"
							placeholder="Confirmation nouveau PIN"
						aria-label="Confirmer le nouveau PIN"
						bind:value={confirmPin}
						maxlength={PIN_MAX_LENGTH}
						disabled={submitting}
					/>
					{#if pinMismatch}
						<p class="text-destructive text-xs">Les PINs ne correspondent pas</p>
					{/if}
				</div>
			{:else if collectOnly && !newPin}
				<p class="text-sm text-muted-foreground mt-0.5">Non défini</p>
			{:else}
				<p class="text-sm font-semibold mt-0.5" aria-label="PIN masqué">••••</p>
			{/if}
		</div>
	</div>
</div>
