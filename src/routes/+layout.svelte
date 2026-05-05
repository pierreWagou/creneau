<script lang="ts">
	import '../app.css';
	import { Toaster } from '$lib/components/ui/sonner';

	let { children } = $props();
</script>

<svelte:head>
	<title>Créneau - Réservation Parking</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="description" content="Réservez la place de parking partagée de votre immeuble" />
</svelte:head>

{@render children()}
<Toaster />
