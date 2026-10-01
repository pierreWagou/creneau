<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { Component } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { MAX_CONTACTS_PER_TYPE } from '$lib/constants';
	import EditableField from './editable-field.svelte';
	import InlineEditField from './inline-edit-field.svelte';

	interface Props {
		title?: string;
		icon: Component;
		items?: string[];
		placeholder: string;
		inputType?: string;
		invalidMessage: string;
		addLabel: string;
		/** Minimum items kept when removing (edit modes: 1, create draft: 0) */
		minItems?: number;
		validate: (v: string) => boolean;
		/** Normalize raw input before storing (e.g. trim, formatPhone). Defaults to trim. */
		format?: (v: string) => string;
		/** Render stored value (e.g. displayPhone). Defaults to raw value. */
		display?: (v: string) => string;
		linkPrefix?: 'mailto' | 'tel' | null;
		onChange?: (items: string[]) => void;
		/** Hide edit affordances (pencil/trash/plus) for read-only display */
		editable?: boolean;
		/** Skip the dialog-section wrapper + title (for embedding in card chrome) */
		bare?: boolean;
		/** Muted text shown when empty and read-only (no add UI to invite input) */
		emptyText?: string | null;
		editLabel?: string;
		removeLabel?: string;
	}

	let {
		title = '',
		icon: Icon,
		items = $bindable([]),
		placeholder,
		inputType = 'text',
		invalidMessage,
		addLabel,
		minItems = 0,
		validate,
		format = (v: string) => v.trim(),
		display = (v: string) => v,
		linkPrefix = null,
		onChange,
		editable = true,
		bare = false,
		emptyText = null,
		editLabel = 'Modifier',
		removeLabel = 'Supprimer'
	}: Props = $props();

	let editingIndex = $state<number | null>(null);
	let adding = $state(false);
	let draft = $state('');

	const draftValid = $derived(draft.length > 0 && validate(draft));

	function startEdit(index: number) {
		adding = false;
		editingIndex = index;
		draft = items[index] ?? '';
	}

	function startAdd() {
		editingIndex = null;
		adding = true;
		draft = '';
	}

	function cancel() {
		editingIndex = null;
		adding = false;
		draft = '';
	}

	function commit() {
		if (!draftValid) return;
		const formatted = format(draft);
		let next: string[];
		if (editingIndex !== null) {
			if (formatted === items[editingIndex]) {
				cancel();
				return;
			}
			if (items.some((v, i) => i !== editingIndex && v === formatted)) return;
			next = items.map((v, i) => (i === editingIndex ? formatted : v));
		} else {
			if (items.includes(formatted)) return;
			next = [...items, formatted];
		}
		cancel();
		// Uncontrolled (create) mode: write through the bindable so parent drafts stay
		// in sync. Controlled (view) mode: parent owns the write via onChange.
		if (onChange) onChange(next);
		else items = next;
	}

	function remove(index: number) {
		if (items.length <= minItems) return;
		const next = items.filter((_, i) => i !== index);
		if (onChange) onChange(next);
		else items = next;
	}
</script>

{#snippet listBody()}
	{#each items as item, i}
		{#snippet itemDisplay()}
			{#if linkPrefix}
				<a
					href="{linkPrefix}:{item}"
					class="block truncate text-sm font-semibold underline-offset-2 hover:underline"
					>{display(item)}</a
				>
			{:else}
				<span class="block truncate text-sm font-semibold">{display(item)}</span>
			{/if}
		{/snippet}
		<div class="flex items-center gap-2 min-h-8">
			<Icon class="h-4 w-4 shrink-0 text-muted-foreground" />
			<EditableField
				editing={editable && editingIndex === i}
				editable={editable}
				editLabel={editLabel}
				onStart={() => startEdit(i)}
				rowClass="gap-2.5"
				bind:value={draft}
				initial={item}
				type={inputType}
				ariaLabel={editLabel}
				error={draft.length > 0 && !draftValid ? invalidMessage : null}
				errorDisplay="tooltip"
				committable={draftValid}
				autofocus={editingIndex === i}
				onCommit={commit}
				onCancel={cancel}
				display={itemDisplay}
			>
				{#snippet editingActions()}
					{#if editable && items.length > minItems}
						<span class="w-7 shrink-0" aria-hidden="true"></span>
					{/if}
				{/snippet}
				{#snippet actions()}
					{#if editable && items.length > minItems}
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							class="shrink-0 text-muted-foreground hover:text-destructive hover:!bg-destructive/10"
							aria-label={removeLabel}
							onclick={() => remove(i)}
						>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
					{/if}
				{/snippet}
			</EditableField>
		</div>
	{/each}
	{#if editable && items.length < MAX_CONTACTS_PER_TYPE}
		{#if adding}
			<div class="flex items-center gap-2 min-h-8">
				<Icon class="h-4 w-4 shrink-0 text-muted-foreground" />
				<InlineEditField
					bind:value={draft}
					type={inputType}
					{placeholder}
					ariaLabel={addLabel}
					error={draft.length > 0 && !draftValid ? invalidMessage : null}
					errorDisplay="tooltip"
					committable={draftValid}
					autofocus={adding}
					onCommit={commit}
					onCancel={cancel}
				/>
		</div>
		{:else}
			<button
				type="button"
				onclick={startAdd}
				disabled={editingIndex !== null}
				class="text-muted-foreground hover:text-foreground flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm transition-colors hover:border-foreground/30 disabled:opacity-40"
			>
				<Plus class="h-4 w-4" /> {addLabel}
			</button>
		{/if}
	{:else if !editable && items.length === 0 && emptyText}
		<p class="text-sm text-muted-foreground">{emptyText}</p>
	{/if}
{/snippet}

{#if bare}
	{@render listBody()}
{:else}
	<div class="dialog-section">
		<p class="dialog-section-label flex items-center gap-1.5"><Icon class="h-3.5 w-3.5" />{title}</p>
		{@render listBody()}
	</div>
{/if}
