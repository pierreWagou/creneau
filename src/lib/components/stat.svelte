<script lang="ts">
	interface Props {
		value: string;
		label: string;
	}

	let { value, label }: Props = $props();
</script>

<div class="text-center">
	<p class="stat-value">{value}</p>
	<p class="stat-label">{label}</p>
</div>
