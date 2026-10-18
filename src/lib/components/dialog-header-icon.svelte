<script lang="ts">
	import type { Component } from 'svelte';

	export type DialogHeaderTone = 'primary' | 'destructive' | 'warning';

	interface Props {
		icon: Component;
		tone?: DialogHeaderTone;
	}

	let { icon: Icon, tone = 'primary' }: Props = $props();

	const toneClass: Record<DialogHeaderTone, string> = {
		primary: 'border-primary/20 bg-primary/10 text-primary',
		destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
		warning: 'border-warning/20 bg-warning/10 text-warning'
	};
</script>

<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border {toneClass[tone]}">
	<Icon class="h-6 w-6" />
</div>
