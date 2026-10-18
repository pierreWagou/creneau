<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		dashed?: boolean;
		onclick: () => void;
		/** Left content cluster (leading mark + title + badges + subtitle) */
		content: Snippet;
		/** Right action cluster (icon buttons) */
		actions?: Snippet;
	}

	let { dashed = false, onclick, content, actions }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions: row click is a mouse/touch shortcut; inner buttons are the keyboard/screen-reader path -->
<div
	class="flex items-center justify-between rounded-md border {dashed
		? 'border-dashed'
		: ''} p-3 cursor-pointer hover:bg-muted/50 transition-colors"
	{onclick}
>
	<div class="flex min-w-0 flex-wrap items-center gap-2">
		{@render content()}
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-1">
			{@render actions()}
		</div>
	{/if}
</div>
