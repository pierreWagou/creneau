<script lang="ts">
	import type { Snippet } from 'svelte';
	import DetailCard from './detail/card.svelte';

	interface Props {
		avatar: Snippet;
		title: string;
		status?: Snippet;
	}

	let { avatar, title, status }: Props = $props();
</script>

<DetailCard>
	<div class="flex items-center gap-4">
		{@render avatar()}
		<div class="flex-1 min-w-0">
			<p class="text-base font-semibold">{title}</p>
		</div>
		{#if status}
			{@render status()}
		{/if}
	</div>
</DetailCard>
