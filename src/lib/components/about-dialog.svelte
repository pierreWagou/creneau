<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Info from '@lucide/svelte/icons/info';
	import Mail from '@lucide/svelte/icons/mail';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';

	let { open = $bindable(false) } = $props();

	function goToAbout() {
		open = false;
		goto('/about');
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="sm" class="text-muted-foreground h-8 w-8 p-0">
				<Info class="h-4 w-4" />
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="max-w-sm">
			<Dialog.Header>
				<Dialog.Title>À propos</Dialog.Title>
				<Dialog.Description>Créneau — Réservation de parking partagé</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-4 text-sm">
				<div class="space-y-1">
					<p class="font-medium">Comment ça marche ?</p>
					<p class="text-muted-foreground">
						Créneau permet aux résidents d'un immeuble de réserver des places de parking partagées.
						Consultez le calendrier, créez et gérez vos réservations en temps réel.
					</p>
				</div>

				<div class="flex justify-center">
					<Button size="sm" onclick={goToAbout}>
						En savoir plus
					</Button>
				</div>

				<div class="border-t"></div>

				<div class="space-y-2">
					<a
						href="https://github.com/pierrewagou/creneau"
						target="_blank"
						rel="noopener noreferrer"
						class="text-foreground flex items-center gap-2 font-medium hover:underline"
					>
						<svg
							viewBox="0 0 24 24"
							class="h-4 w-4 shrink-0 fill-current"
							aria-hidden="true"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
							/>
						</svg>
						Code source
						<ExternalLink class="text-muted-foreground h-3 w-3" />
					</a>
					<a
						href="mailto:pierre.romon@gmail.com"
						class="text-foreground flex items-center gap-2 font-medium hover:underline"
					>
						<Mail class="h-4 w-4 shrink-0" />
						Contacter Pierre Romon
					</a>
				</div>

				<div class="border-t"></div>

				<p class="text-muted-foreground text-center text-xs">Version {__APP_VERSION__}</p>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
