<script lang="ts">
	import SiteToolbar from '$lib/components/site-toolbar.svelte';

	let { children, data } = $props();
</script>

<div class="flex min-h-svh flex-col">
	<SiteToolbar flat={data.flat} />

	<!-- Contenu principal -->
	<main class="flex flex-1 items-center justify-center p-4">
		{@render children()}
	</main>
</div>
