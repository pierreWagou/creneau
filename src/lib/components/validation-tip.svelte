<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';

	/**
	 * Explains a disabled button: when `show`, wraps children in a hover
	 * target showing `message` (disabled controls swallow pointer events,
	 * so the tooltip lives on the wrapper). Otherwise renders children bare.
	 */
	interface Props {
		show: boolean;
		message?: string;
		title?: string;
		items?: string[];
		side?: 'top' | 'bottom' | 'left' | 'right';
		children: Snippet;
	}

	let { show, message = '', title, items, side = 'top', children }: Props = $props();
</script>

{#if show}
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<span {...props} class="block">
						{@render children()}
					</span>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content {side}>
				{#if items?.length}
					{#if title}<p class="font-medium mb-1">{title}</p>{/if}
					<ul class="list-disc pl-4 space-y-0.5">
						{#each items as item}
							<li class="text-xs">{item}</li>
						{/each}
					</ul>
				{:else}
					<p class="text-xs">{message}</p>
				{/if}
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
{:else}
	{@render children()}
{/if}
