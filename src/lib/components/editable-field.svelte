<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import type { Snippet } from 'svelte';
	import IconButton from './icon-button.svelte';
	import InlineEditField from './inline-edit-field.svelte';

	/**
	 * Shared editable row: committed state (display + pencil) and editing state
	 * (input + ✓/warning) bundled in one component so mode swaps cannot shift layout.
	 * The static area and the input share one flex-1 slot; pencil / ✓ / warning share
	 * one fixed trailing action slot.
	 */
	interface Props {
		editing: boolean;
		/** False hides the pencil (read-only title); display still renders */
		editable?: boolean;
		/** Pencil aria-label (e.g. "Modifier le nom") */
		editLabel: string;
		onStart: () => void;
		/** Idle-row gap classes (per-site parity); defaults to gap-1 */
		rowClass?: string;
		/** Static content incl. empty states (text, prefixes, links, open-buttons) */
		display: Snippet;
		/** Leading adornment (e.g. field icon), rendered before the content in both modes */
		leading?: Snippet;
		/** Fixed label before the input in editing mode (e.g. "Lot") */
		prefix?: Snippet;
		/** Extra idle actions rendered after the pencil (e.g. trash) */
		actions?: Snippet;
		/** Extra editing actions after the ✓/warning slot (e.g. width spacers for idle-only buttons) */
		editingActions?: Snippet;
		// InlineEditField pass-through:
		value?: string;
		initial?: string;
		placeholder?: string;
		ariaLabel: string;
		type?: string;
		inputmode?: 'text' | 'search' | 'email' | 'none' | 'url' | 'tel' | 'numeric' | 'decimal';
		maxlength?: number | null;
		mono?: boolean;
		uppercase?: boolean;
		inputClass?: string;
		error?: string | null;
		errorDisplay?: 'inline' | 'tooltip';
	committable: boolean;
	disabled?: boolean;
	/** Multiline editing (Textarea instead of Input); Enter stays a newline */
	multiline?: boolean;
	rows?: number;
	/** Hide the commit icon (parent owns commit affordance elsewhere) */
	hideCommitIcon?: boolean;
	focusOnOpen?: boolean;
		onCommit: () => void;
		onCancel: () => void;
	}

	let {
		editing,
		editable = true,
		editLabel,
		onStart,
		rowClass = 'gap-1',
		display,
		leading,
		prefix,
		actions,
		editingActions,
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
		committable,
		disabled = false,
		multiline = false,
		rows = 3,
		hideCommitIcon = false,
		focusOnOpen = false,
		onCommit,
		onCancel
	}: Props = $props();
</script>

{#if editing}
	<div class="flex items-center min-w-0 min-h-8 flex-1 {rowClass}">
		{#if leading}
			<span class="flex shrink-0 items-center">{@render leading()}</span>
		{/if}
		{#if prefix}
			{@render prefix()}
		{/if}
		<InlineEditField
			bind:value
			{initial}
			{placeholder}
			{ariaLabel}
			{type}
			{inputmode}
			{maxlength}
			{mono}
			{uppercase}
			{inputClass}
			{error}
			{errorDisplay}
			{rowClass}
			{editingActions}
			{committable}
			{disabled}
			{multiline}
			{rows}
			{hideCommitIcon}
			{focusOnOpen}
			{onCommit}
			{onCancel}
		/>
	</div>
{:else}
	<div class="flex items-center min-w-0 min-h-8 flex-1 {rowClass}">
		{#if leading}
			<div class="flex min-w-0 flex-1 items-center gap-2">
				{@render leading()}
				<div class="flex-1 min-w-0">
					{@render display()}
				</div>
			</div>
		{:else}
			<div class="flex-1 min-w-0">
				{@render display()}
			</div>
		{/if}
		{#if editable}
			<IconButton icon={Pencil} label={editLabel} onclick={onStart} />
		{/if}
		{#if actions}
			{@render actions()}
		{/if}
	</div>
{/if}
