<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-svh items-center justify-center bg-muted p-4">
	<div class="w-full max-w-sm">
		{@render children()}
	</div>
</div>
