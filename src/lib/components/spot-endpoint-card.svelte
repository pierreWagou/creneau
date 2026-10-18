<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { Snippet } from 'svelte';
	import AvatarCircle from './detail/avatar-circle.svelte';
	import ValidationTip from './validation-tip.svelte';

	/**
	 * Shared compact endpoint card: one framed lot/pool/pending block with a
	 * title and a caller-rendered chip list.
	 *
	 * Used by the flight strip's default endpoint cards and by the mercato
	 * board columns, so every compact lot representation shares one frame,
	 * one warning treatment, and one typography scale. Chips stay with the
	 * caller (draggable vs flight vs pick semantics differ per consumer).
	 */
	interface Props {
		title: string;
		/** Screen-reader-only note rendered after the title (e.g. blocked reasons). */
		note?: string;
		muted?: boolean;
		/** Muted title text without the dashed card frame (e.g. blocked destinations). */
		titleMuted?: boolean;
		dashed?: boolean;
	/** Conflict-style warning frame: yellow border + tint with matching title and leading icon (e.g. stranded lot). */
	warning?: boolean;
	/** Warning tooltip on the leading icon (rendered only when `warning` is set). */
	warningMessage?: string;
	/**
	 * Leading avatar (e.g. flat initial + `getFlatColor` tint, muted initial
	 * for pool/pending). Replaced by the warning icon when `warning` is set.
	 */
	avatar?: { initial: string; tint: string | null };
		/** Renders `data-fly-home` for ghost-flight measurement. */
		homeMarker?: boolean;
		chips: Snippet;
		/** Inline content after the title (e.g. count badges). */
		extra?: Snippet;
		/** Extra classes merged onto the frame (e.g. `flex-1` inside a strip). */
		class?: string;
	}

	let {
		title,
		note,
		muted = false,
		titleMuted = false,
		dashed = false,
		warning = false,
		warningMessage,
		avatar,
		homeMarker = false,
		chips,
		extra,
		class: className = ''
	}: Props = $props();
</script>

<div
	class="flex min-w-0 flex-col gap-2 rounded-lg border p-2 transition-colors {warning
		? 'border-warning/40 bg-warning/10'
		: 'border-border'} {dashed ? 'border-dashed' : ''} {className}"
	data-fly-home={homeMarker ? true : undefined}
>
	<span class="flex items-center gap-1.5">
		{#if warning}
			{#if warningMessage}
				<ValidationTip show={true} message={warningMessage}>
					<TriangleAlert data-testid="warning-icon" class="h-6 w-6 shrink-0 text-warning" />
				</ValidationTip>
			{:else}
				<TriangleAlert data-testid="warning-icon" class="h-6 w-6 shrink-0 text-warning" aria-hidden="true" />
			{/if}
		{:else if avatar}
			<AvatarCircle size="xs" tint={avatar.tint} decorative>
				{avatar.initial}
			</AvatarCircle>
		{/if}
		<span class="block min-w-0 flex-1 truncate text-sm font-semibold {warning
			? 'text-warning'
			: titleMuted || muted
				? 'text-muted-foreground'
				: ''}">
			{title}
		</span>
		{#if extra}
			{@render extra()}
		{/if}
	</span>
	{#if note}
		<span class="sr-only">{note}</span>
	{/if}
	{@render chips()}
</div>
