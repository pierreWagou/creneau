<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as AlertDialog from './ui/alert-dialog';
	import * as Dialog from './ui/dialog';

	interface Props {
		kind: 'dialog' | 'alert';
		/** Content width: sm relies on the primitive default, md/lg/xl pin it. */
		size?: 'sm' | 'md' | 'lg' | 'xl';
		/** Controlled open state (data-driven `x !== null` and plain booleans alike). */
		open: boolean;
		/** Close handler (overlay/Esc/X all funnel here). */
		onClose: () => void;
		children: Snippet;
	}

	let { kind, size = 'sm', open, onClose, children }: Props = $props();

	const dialogSizeClass: Record<NonNullable<Props['size']>, string> = {
		sm: '',
		md: 'sm:max-w-md',
		lg: 'sm:max-w-lg',
		xl: 'sm:max-w-2xl'
	};
	// The AlertDialog primitive pins data-[size=default]:max-w-xs / sm:max-w-sm
	// (specificity 0,2,0), always active since it renders data-size="default".
	// A plain sm:max-w-* would lose against it, so alert overrides must reuse the
	// same data-attribute variant stack — tailwind-merge then dedupes to our value
	// (same precedent as spot-conflict-dialog's raw Content override). Base uses
	// calc(100%-2rem) to keep phone margins like the Dialog primitive.
	const alertSizeClass: Record<NonNullable<Props['size']>, string> = {
		sm: '',
		md: 'data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-md',
		lg: 'data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-lg',
		xl: 'data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-2xl'
	};
	const sizeClass = kind === 'alert' ? alertSizeClass[size] : dialogSizeClass[size];
	const contentClass = `sm:p-6${sizeClass ? ` ${sizeClass}` : ''}`;
</script>

{#if kind === 'dialog'}
	<Dialog.Root {open} onOpenChange={(o) => { if (!o) onClose(); }}>
		<Dialog.Content class={contentClass}>
			{@render children()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<AlertDialog.Root {open} onOpenChange={(o) => { if (!o) onClose(); }}>
		<AlertDialog.Content class={contentClass}>
			{@render children()}
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
