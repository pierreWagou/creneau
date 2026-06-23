<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Info from '@lucide/svelte/icons/info';
	import Mail from '@lucide/svelte/icons/mail';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';

	let { open = $bindable(false) } = $props();
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
				<!-- How it works -->
				<div class="space-y-1">
					<p class="font-medium">Comment ça marche ?</p>
					<p class="text-muted-foreground">
						Créneau permet aux résidents d'un immeuble de réserver des places de parking partagées.
						Chaque appartement dispose d'un compte activé par l'administrateur, et peut consulter le
						calendrier, créer et gérer ses réservations en temps réel.
					</p>
				</div>

				<div class="border-t"></div>

				<!-- Tech stack -->
				<div class="space-y-2">
					<p class="font-medium">Stack technique</p>
					<ul class="text-muted-foreground space-y-1.5">
						<!-- SvelteKit -->
						<li class="flex items-center gap-2">
							<svg viewBox="0 0 98.1 118" class="h-4 w-4 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
								<path d="M91.8 15.6C80.9-.1 59.2-4.7 43.6 5.2L16.1 22.8C8.6 27.5 3.4 35.2 1.9 43.9c-1.3 7.3-.2 14.8 3.3 21.3-2.4 3.6-4 7.6-4.7 11.8-1.6 8.9.5 18.1 5.7 25.4 11 15.7 32.6 20.3 48.2 10.4l27.5-17.6c7.5-4.8 12.7-12.4 14.2-21.1 1.3-7.3.2-14.8-3.3-21.3 2.4-3.6 4-7.6 4.7-11.8 1.7-9-.4-18.2-5.7-25.4z" fill="#FF3E00"/>
								<path d="M40.9 103.9c-8.9 2.3-18.2-1.2-23.4-8.7-3.2-4.4-4.4-9.9-3.5-15.3.2-.9.4-1.7.6-2.6l.5-1.6 1.4 1c3.3 2.4 6.9 4.2 10.8 5.4l1 .3-.1 1c-.1 1.4.3 2.9 1.1 4.1 1.6 2.3 4.4 3.4 7.1 2.7.6-.2 1.2-.4 1.7-.7L65.5 72c1.4-.9 2.3-2.2 2.6-3.8.3-1.6-.1-3.3-1-4.6-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.7l-10.5 6.7c-1.7 1.1-3.6 1.9-5.6 2.4-8.9 2.3-18.2-1.2-23.4-8.7-3.1-4.4-4.4-9.9-3.4-15.3.9-5.2 3.9-9.9 8.3-12.9L47.2 14c1.7-1.1 3.6-1.9 5.6-2.4 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.2.9-.4 1.7-.7 2.6l-.5 1.6-1.4-1c-3.3-2.4-6.9-4.2-10.8-5.4l-1-.3.1-1c.1-1.4-.3-2.9-1.1-4.1-1.6-2.3-4.4-3.4-7.1-2.7-.6.2-1.2.4-1.7.7L32.8 43.6c-1.4.9-2.3 2.2-2.6 3.8-.3 1.6.1 3.3 1 4.6 1.6 2.3 4.4 3.3 7.1 2.6.6-.2 1.2-.4 1.7-.7l10.5-6.7c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.9 5.2-3.9 9.9-8.3 12.9L51.2 101c-1.7 1.1-3.6 1.9-5.6 2.4-.9.3-1.8.4-2.7.5z" fill="#FFF"/>
							</svg>
							<span>SvelteKit <span class="text-muted-foreground/70">— Framework web (Svelte 5)</span></span>
						</li>
						<!-- SQLite -->
						<li class="flex items-center gap-2">
							<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none">
								<path d="M21.678 3.276a2.47 2.47 0 0 0-3.008-1.59C16.02 2.41 10.775 8.24 9.11 10.7c-1.006-.207-2.937-.41-4.704.41C1.4 12.555.293 16.285.02 17.793c-.095.51.37.92.86.767.661-.203 1.549-.38 2.27-.275-.413.71-.671 1.524-.703 2.44-.024.664.495 1.194 1.147 1.11 1.74-.223 4.857-1.071 6.543-3.358.347.27.735.583 1.034.83.373.31.88.39 1.327.2 3.08-1.31 5.68-4.64 5.68-4.64s-1.94.55-3.36.42c-.12-.01-.23-.03-.35-.05 1.14-1.74 2.64-4.36 3.69-6.92 1.15-2.83 1.76-6.04 3.16-5.04" fill="#003B57"/>
								<path d="M21.678 3.276c-.597-.487-1.438-.598-2.185-.368-1.47 1.566-2.48 3.424-3.34 5.32 1.026.84 1.74 2.006 1.965 3.34.524-.975 1.004-1.942 1.4-2.868 1.147-2.83 1.76-6.04 3.16-5.04v-.384z" fill="#0F80CC"/>
							</svg>
							<span>SQLite <span class="text-muted-foreground/70">— Base de données via Drizzle ORM</span></span>
						</li>
						<!-- Tailwind CSS -->
						<li class="flex items-center gap-2">
							<svg viewBox="0 0 54 33" class="h-4 w-4 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd" clip-rule="evenodd" d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z" fill="#06B6D4"/>
							</svg>
							<span>Tailwind v4 <span class="text-muted-foreground/70">— Styles + shadcn-svelte</span></span>
						</li>
						<!-- Docker -->
						<li class="flex items-center gap-2">
							<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
								<path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.186.186 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" fill="#2496ED"/>
							</svg>
							<span>Docker <span class="text-muted-foreground/70">— Déployé via Dokploy</span></span>
						</li>
					</ul>
				</div>

				<div class="border-t"></div>

				<!-- Source + contact -->
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
