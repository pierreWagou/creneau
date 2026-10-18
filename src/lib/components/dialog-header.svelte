<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import type { Component, Snippet } from 'svelte';
	import DialogHeaderIcon, { type DialogHeaderTone } from './dialog-header-icon.svelte';
	import * as AlertDialog from './ui/alert-dialog';
	import { Button } from './ui/button';
	import * as Dialog from './ui/dialog';

	/**
	 * Standard dialog header: [toned icon] title + subtitle … X.
	 * Works inside either primitive (`kind` picks the Title/Description pair).
	 * The explicit X renders only when `onClose` is passed — overlay/Esc keep
	 * working regardless; dialogs without `onClose` stay overlay/Esc-only.
	 */
	interface Props {
		kind: 'dialog' | 'alert';
		icon: Component;
		tone?: DialogHeaderTone;
		title: string;
		subtitle?: string | null;
		onClose?: (() => void) | null;
		/** Extra inline content beside the title (e.g. an expiry chip). */
		titleExtra?: Snippet | null;
		/** Escape hatches for nonstandard alignment (conflict dialog left-aligns). */
		headerClass?: string;
		descriptionClass?: string;
	}

	let {
		kind,
		icon,
		tone = 'primary',
		title,
		subtitle = null,
		onClose = null,
		titleExtra = null,
		headerClass = '',
		descriptionClass = ''
	}: Props = $props();
</script>

{#if kind === 'dialog'}
	<Dialog.Header class={headerClass || undefined}>
		<div class="flex items-center gap-3">
			<DialogHeaderIcon {icon} {tone} />
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<Dialog.Title>{title}</Dialog.Title>
					{#if titleExtra}
						{@render titleExtra()}
					{/if}
				</div>
				{#if subtitle}
					<Dialog.Description class={descriptionClass || undefined}>{subtitle}</Dialog.Description>
				{/if}
			</div>
		</div>
	</Dialog.Header>
{:else}
	<AlertDialog.Header class={headerClass || undefined}>
		<div class="flex items-center gap-3">
			<DialogHeaderIcon {icon} {tone} />
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<AlertDialog.Title>{title}</AlertDialog.Title>
					{#if titleExtra}
						{@render titleExtra()}
					{/if}
				</div>
				{#if subtitle}
					<AlertDialog.Description class={descriptionClass || undefined}>{subtitle}</AlertDialog.Description>
				{/if}
			</div>
		</div>
	</AlertDialog.Header>
{/if}
{#if onClose}
	<Button variant="ghost" size="icon-sm" class="absolute top-2 right-2" onclick={onClose} aria-label="Fermer">
		<XIcon />
	</Button>
{/if}
