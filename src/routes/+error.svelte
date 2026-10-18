<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import House from '@lucide/svelte/icons/house';
	import { page } from '$app/state';
	import SiteToolbar from '$lib/components/site-toolbar.svelte';
	import { Button } from '$lib/components/ui/button';
	import type { SessionFlat } from '$lib/types';
	import './error.css';

	const sessionFlat = $derived((page.data as { flat?: SessionFlat | null }).flat ?? null);
	const isNotFound = $derived(page.status === 404);
	const title = $derived(isNotFound ? 'Page introuvable' : 'Une erreur est survenue');
	const explanation = $derived(
		isNotFound
			? "Vous êtes en double file sur une page qui n'existe pas. Rangez-vous vers l'accueil."
			: "Réessayez dans un instant — si cela persiste, contactez le conseil syndical."
	);
</script>

<svelte:head>
	<title>{title} — Créneau</title>
</svelte:head>

<div class="flex min-h-svh flex-col">
	<SiteToolbar flat={sessionFlat} />

	<main class="error-stack flex flex-1 flex-col items-center justify-center p-4 text-center">
		<div class="text-destructive" role="img" aria-label="Panneau stop indiquant 404">
			<svg
				width="144"
				height="144"
				viewBox="0 0 120 120"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<polygon
					points="40,4 80,4 116,40 116,80 80,116 40,116 4,80 4,40"
					fill="currentColor"
				/>
				<text
					x="60"
					y="60"
					dy="0.35em"
					text-anchor="middle"
					fill="currentColor"
					class="on-solid"
					font-size="30"
					font-weight="800"
					font-family="inherit"
				>
					404
				</text>
			</svg>
		</div>

		<div class="error-copy">
			<h1 class="page-title">{title}</h1>
			<p class="text-muted-foreground max-w-md text-sm">{explanation}</p>
		</div>

		<div class="error-actions">
			<Button href="/" size="lg" class="h-12 px-6 text-base">
				<House data-icon="inline-start" class="size-5" />
				Retour à l'accueil
				<ArrowRight data-icon="inline-end" class="size-5" />
			</Button>
		</div>
	</main>
</div>
