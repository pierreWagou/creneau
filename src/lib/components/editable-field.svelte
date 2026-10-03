<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button';
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
		/** Fixed label before the input in editing mode (e.g. "Appartement") */
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
		autofocus?: boolean;
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
		autofocus = false,
		onCommit,
		onCancel
	}: Props = $props();
</script>

{#if editing}
	<div class="flex items-center min-w-0 min-h-8 flex-1 {rowClass}">
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
			{autofocus}
			{onCommit}
			{onCancel}
		/>
	</div>
{:else}
	<div class="flex items-center min-w-0 min-h-8 flex-1 {rowClass}">
		<div class="flex-1 min-w-0">
			{@render display()}
		</div>
		{#if editable}
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class="shrink-0 text-muted-foreground hover:text-foreground hover:!bg-muted"
				aria-label={editLabel}
				onclick={onStart}
			>
				<Pencil class="h-3.5 w-3.5" />
			</Button>
		{/if}
		{#if actions}
			{@render actions()}
		{/if}
	</div>
{/if}
