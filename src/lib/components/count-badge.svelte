<script lang="ts">
	interface Props {
		count: number;
		tone?: 'primary' | 'muted';
	}

	let { count, tone = 'primary' }: Props = $props();
</script>

<span
	class="rounded-full px-2 py-0.5 text-xs font-medium {tone === 'primary'
		? 'bg-primary on-solid'
		: 'bg-muted text-muted-foreground'}"
>
	{count}
</span>
