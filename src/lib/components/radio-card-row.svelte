<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	interface Props {
		name: string;
		value: string;
		checked: boolean;
		disabled?: boolean;
		onSelect: () => void;
		icon: Component;
		title: string;
		subtitle?: string | null;
		/** Extra content right of the label row, inside the box (e.g. a picker). */
		children?: Snippet;
	}

	let {
		name,
		value,
		checked,
		disabled = false,
		onSelect,
		icon: Icon,
		title,
		subtitle = null,
		children
	}: Props = $props();
</script>

<div
	class="rounded-lg border p-2 transition-colors {checked
		? 'border-primary bg-primary/10 hover:border-primary hover:bg-primary/10'
		: 'border-border hoverable-card'}"
>
	<div class="flex items-center gap-3">
		<label class="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
			<input
				type="radio"
				{name}
				{value}
				class="sr-only"
				{checked}
				{disabled}
				onchange={onSelect}
			/>
			<Icon class="h-4 w-4 shrink-0 text-muted-foreground" />
			<span class="min-w-0 flex-1">
				<span class="block text-sm font-semibold">{title}</span>
				{#if subtitle}
					<span class="block truncate text-muted-foreground text-xs">{subtitle}</span>
				{/if}
			</span>
		</label>
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>
