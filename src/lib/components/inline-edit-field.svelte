<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import CommitIcon from './commit-icon.svelte';

	/**
	 * Shared inline edit field: input + commit affordance in one row.
	 * Single place to change the field UX app-wide (icons, keys, tap-outside).
	 *
	 * Icon contract: saving → disabled ✓ · committable → ✓ · non-empty +
	 * not committable → orange warning · empty pristine → nothing.
	 * Parents keep draft state + validators + commit/cancel; this owns mechanics.
	 */
	interface Props {
		value?: string;
		/** Value at open; tap-outside commits dirty drafts, collapses pristine ones */
		initial?: string;
		placeholder?: string;
		ariaLabel: string;
		type?: string;
		inputmode?: 'text' | 'search' | 'email' | 'none' | 'url' | 'tel' | 'numeric' | 'decimal';
		maxlength?: number | null;
		mono?: boolean;
		uppercase?: boolean;
		inputClass?: string;
		/** Invalid message: red border + message (inline paragraph or tooltip) */
		error?: string | null;
		/** Inline paragraph (FlatTextField pattern) vs tooltip (zero layout shift) */
		errorDisplay?: 'inline' | 'tooltip';
		/** Editing-row gap classes (per-site parity with the static row) */
		rowClass?: string;
		/** Extra actions after the ✓/warning slot (e.g. width spacers for idle-only buttons) */
		editingActions?: Snippet;
		/** Parent-owned gate (validity); saving handled separately via `disabled` */
		committable: boolean;
		disabled?: boolean;
		/** Multiline editing (Textarea instead of Input); Enter stays a newline */
		multiline?: boolean;
		rows?: number;
		/** Hide the commit icon (parent owns commit affordance elsewhere) */
		hideCommitIcon?: boolean;
		/** Focus when true (parents pass their existing open condition → parity) */
		focusOnOpen?: boolean;
		onCommit: () => void;
		onCancel: () => void;
	}

	let {
		value = $bindable(''),
		initial = '',
		placeholder = '',
		ariaLabel,
		type = 'text',
		inputmode = undefined,
		maxlength = null,
		mono = false,
		uppercase = false,
		inputClass = '',
		error = null,
		errorDisplay = 'inline',
		rowClass = 'gap-1',
		editingActions,
		committable,
		disabled = false,
		multiline = false,
		rows = 3,
		hideCommitIcon = false,
		focusOnOpen = false,
		onCommit,
		onCancel
	}: Props = $props();

	let inputEl: HTMLInputElement | HTMLTextAreaElement | null = $state(null);

	// Mount-open focus (e.g. dialog opening with a default-open editor) must not scroll:
	// mid-transition geometries make iOS jump towards the field. Later opens (pencil taps
	// on settled UI) keep scroll-into-view so the keyboard never covers the field in drawers.
	// `preventScroll` is ignored where unsupported — harmless fallback to plain focus.
	let mountAutofocus = focusOnOpen;

	$effect(() => {
		if (!focusOnOpen || !inputEl) return;
		if (mountAutofocus) {
			mountAutofocus = false;
			inputEl.focus({ preventScroll: true });
		} else {
			inputEl.focus();
		}
	});

	const dirty = $derived(value !== initial);
	// Guards the unmount blur: commit/cancel flip it first, so the trailing
	// blur from DOM removal no-ops instead of double-firing.
	let alive = $state(true);
	// Dialog focus settling (autofocus storm on open) is not abandonment:
	// blurs within a beat of mount are ignored, later ones still cancel.
	const mountedAt = Date.now();
	const FOCUS_SETTLE_MS = 500;

	function attemptCommit() {
		if (!committable || disabled) return;
		alive = false;
		onCommit();
	}

	function cancel() {
		alive = false;
		onCancel();
	}

	const showWarning = $derived(!disabled && !committable && value.trim().length > 0);
</script>

<div class="min-w-0 flex-1">
	<div
		class="flex items-center min-w-0 min-h-8 {rowClass}"
			onfocusout={(e) => {
				if (!alive || e.currentTarget.contains(e.relatedTarget as Node | null)) return;
				// Dialog focus settling (autofocus storm on open) is not
				// abandonment — but only when pristine: a dirty draft always
				// commits, however fast the blur follows.
				if (!dirty && Date.now() - mountedAt < FOCUS_SETTLE_MS) return;
				if (dirty && committable && !disabled) attemptCommit();
				else cancel();
			}}
	>
		{#if multiline}
			<Textarea
				bind:ref={inputEl}
				bind:value
				{placeholder}
				aria-label={ariaLabel}
				maxlength={maxlength ?? undefined}
				rows={rows}
				{disabled}
				oninput={() => {
					if (uppercase) value = value.toUpperCase();
				}}
				class="flex-1 min-w-0 {mono ? 'font-mono' : ''} {inputClass} {error ? 'border-destructive' : ''}"
				onkeydown={(e) => {
					// Enter is a newline here — commit stays on the ✓ button only
					if (e.key === 'Escape') {
						cancel();
					}
				}}
			/>
		{:else}
			<Input
				bind:ref={inputEl}
				bind:value
				{placeholder}
				aria-label={ariaLabel}
				{type}
				{inputmode}
				maxlength={maxlength ?? undefined}
				{disabled}
				oninput={() => {
					if (uppercase) value = value.toUpperCase();
				}}
				class="h-8 flex-1 min-w-0 {mono ? 'font-mono' : ''} {inputClass} {error ? 'border-destructive' : ''}"
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						attemptCommit();
					} else if (e.key === 'Escape') {
						cancel();
					}
				}}
			/>
		{/if}
		{#if !hideCommitIcon}
			<CommitIcon
				state={disabled ? 'busy' : committable ? 'ready' : showWarning ? 'invalid' : 'empty'}
				onCommit={attemptCommit}
				warningTip={errorDisplay === 'tooltip' ? error : null}
			/>
		{/if}
		{#if editingActions}
			{@render editingActions()}
		{/if}
	</div>
	{#if errorDisplay === 'inline' && error}
		<p class="text-destructive text-xs mt-1">{error}</p>
	{/if}
</div>
