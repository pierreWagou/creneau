<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import * as Card from './ui/card';

	interface Props {
		icon?: Component;
		title: string;
		message?: string | null;
		children?: Snippet;
	}

	let { icon: Icon, title, message = null, children }: Props = $props();
</script>

<Card.Root>
	<Card.Content class="py-10 text-center">
		{#if Icon}
			<div
				class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
				aria-hidden="true"
			>
				<Icon class="h-7 w-7" />
			</div>
		{/if}
		<p class="font-semibold">{title}</p>
		{#if message}
			<p class="mt-1 text-sm text-muted-foreground">{message}</p>
		{/if}
		{#if children}
			<div class="mt-4">{@render children()}</div>
		{/if}
	</Card.Content>
</Card.Root>
