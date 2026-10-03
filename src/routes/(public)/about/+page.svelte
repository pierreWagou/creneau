<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Info from '@lucide/svelte/icons/info';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import Play from '@lucide/svelte/icons/play';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Zap from '@lucide/svelte/icons/zap';
	import Logo from '$lib/components/logo.svelte';
	import * as Card from '$lib/components/ui/card';
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<!-- Hero -->
	<div class="flex flex-col items-center gap-3 py-6 text-center">
		<Logo class="h-12 w-12" />
		<h1 class="text-2xl font-bold tracking-tight">Créneau</h1>
		<p class="text-muted-foreground text-sm">Réservation de parking partagé pour notre résidence</p>
	</div>

	<!-- Ce que fait Créneau -->
	<Card.Root class="border-t-2 border-success">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Sparkles class="h-5 w-5 text-success" />
				Ce que fait Créneau
			</Card.Title>
			<Card.Description>Les fonctionnalités essentielles</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="text-muted-foreground space-y-2 text-sm">
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-success">✓</span>
					<span>Voir en temps réel quelles places de parking sont libres</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-success">✓</span>
					<span>Réserver sans conflit possible</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-success">✓</span>
					<span>Annuler ou modifier facilement</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-success">✓</span>
					<span>Tout se met à jour instantanément pour tous</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Commencer -->
	<Card.Root class="border-t-2 border-primary">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Zap class="text-primary h-5 w-5" />
				Commencer
			</Card.Title>
			<Card.Description>Comment accéder à l'application</Card.Description>
		</Card.Header>
		<Card.Content>
			<ol class="text-muted-foreground space-y-3 text-sm">
				<li class="flex items-start gap-3">
					<span class="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">1</span>
					<span><strong class="text-foreground">Demandez l'accès</strong> via le formulaire avec votre numéro d'appartement, vos places de parking souhaitées et vos coordonnées</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">2</span>
					<span>L'administrateur approuve votre demande et vous envoie un <strong class="text-foreground">code d'activation</strong> (valable 24h)</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">3</span>
					<span>Activez votre compte et choisissez un <strong class="text-foreground">code PIN secret</strong> (4 à 6 chiffres)</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">4</span>
					<span><strong class="text-foreground">C'est prêt !</strong> Vous pouvez réserver vos places de parking</span>
				</li>
			</ol>
		</Card.Content>
	</Card.Root>

	<!-- Réserver une place -->
	<Card.Root class="border-t-2 border-warning">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<CalendarDays class="h-5 w-5 text-warning" />
			Réserver une place de parking
		</Card.Title>
			<Card.Description>Quelques clics et c'est fait</Card.Description>
		</Card.Header>
		<Card.Content>
			<ol class="text-muted-foreground space-y-3 text-sm">
				<li class="flex items-start gap-3">
					<span class="bg-warning text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">1</span>
					<span>Ouvrez le <strong class="text-foreground">Calendrier</strong></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-warning text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">2</span>
					<span>Choisissez une <strong class="text-foreground">date</strong> (les cases vertes sont libres)</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-warning text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">3</span>
					<span>Sélectionnez votre <strong class="text-foreground">créneau horaire</strong></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-warning text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">4</span>
					<span><strong class="text-foreground">Confirmez</strong> — c'est réservé !</span>
				</li>
			</ol>
		</Card.Content>
	</Card.Root>

	<!-- Gérer vos réservations -->
	<Card.Root class="border-t-2 border-accent">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<ClipboardList class="text-accent h-5 w-5" />
				Gérer vos réservations
			</Card.Title>
			<Card.Description>Modifiez, annulez, consultez</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="text-muted-foreground space-y-2 text-sm">
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span>Consultez <strong class="text-foreground">Mes réservations</strong> pour voir vos créneaux à venir</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span><strong class="text-foreground">Modifiez</strong> un créneau en le déplaçant dans le calendrier (glisser-déposer)</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span><strong class="text-foreground">Annulez</strong> à tout moment depuis Mes réservations</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span>Tout se met à jour <strong class="text-foreground">en direct</strong> pour tous les résidents</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Règles simples -->
	<Card.Root class="border-t-2 border-booking-busy">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<ShieldCheck class="h-5 w-5 text-booking-busy" />
				Règles simples
			</Card.Title>
			<Card.Description>Pas de surprise, tout est clair</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="text-muted-foreground space-y-2 text-sm">
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-booking-busy">•</span>
					<span><strong class="text-foreground">Max 7 jours</strong> consécutifs par réservation</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-booking-busy">•</span>
					<span><strong class="text-foreground">Annulation libre</strong> à tout moment (pour les réservations à venir)</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-booking-busy">•</span>
					<span><strong class="text-foreground">Pas de conflit possible</strong> — si une place de parking est prise, l'appli l'empêche</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Activité -->
	<Card.Root class="border-t-2 border-accent">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<ChartBar class="h-5 w-5 text-accent" />
				Activité
			</Card.Title>
			<Card.Description>Statistiques et transparence</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="text-muted-foreground space-y-2 text-sm">
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-accent">•</span>
					<span>Consultez vos <strong class="text-foreground">statistiques personnelles</strong> : heures de réservation, nombre de créneaux</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-accent">•</span>
					<span>Suivez l'<strong class="text-foreground">utilisation globale</strong> de l'immeuble</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-accent">•</span>
					<span>Découvrez le <strong class="text-foreground">classement des résidents</strong> — transparent pour tous</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Vos coordonnées -->
	<Card.Root class="border-t-2 border-info">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Mail class="h-5 w-5 text-info" />
				Vos coordonnées
			</Card.Title>
			<Card.Description>Gardez vos contacts à jour</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="text-muted-foreground space-y-2 text-sm">
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-info">•</span>
					<span>Ajoutez ou modifiez vos <strong class="text-foreground">emails</strong> et <strong class="text-foreground">téléphones</strong> depuis la page Mon compte</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-info">•</span>
					<span>Au moins <strong class="text-foreground">1 email et 1 téléphone</strong> sont requis pour pouvoir réserver</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-info">•</span>
					<span>Vos coordonnées ne sont visibles que par vous et les administrateurs</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Confidentialité -->
	<Card.Root class="border-t-2 border-info">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Lock class="h-5 w-5 text-info" />
				Confidentialité
			</Card.Title>
			<Card.Description>Vos données sont protégées</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-2">
			<p class="text-muted-foreground text-sm">
				Les données stockées sont les numéros d'appartement, les places de parking, les horaires de réservation
				et vos coordonnées (emails et téléphones) pour faciliter la communication entre résidents.
			</p>
			<p class="text-muted-foreground text-sm">
				Aucune donnée n'est transmise à un service externe. Le serveur est situé dans l'immeuble.
			</p>
			<p class="text-muted-foreground text-sm">
				Les administrateurs de l'application sont les membres du conseil syndical.
			</p>
		</Card.Content>
	</Card.Root>

	<!-- Tester l'application -->
	<Card.Root class="border-t-2 border-accent">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Play class="h-5 w-5 text-accent" />
				Tester l'application
			</Card.Title>
			<Card.Description>Version de démonstration</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-3">
			<p class="text-muted-foreground text-sm">
				Une version de test est disponible avec des données fictives.
			</p>
			<div class="rounded-md border p-3">
				<p class="text-sm">
					<a
						href="https://creneau-preview.wagou.fr"
						target="_blank"
						rel="noopener noreferrer"
						class="text-foreground inline-flex items-center gap-1 font-medium hover:underline"
					>
						creneau-preview.wagou.fr
						<ExternalLink class="text-muted-foreground h-3 w-3" />
					</a>
				</p>
				<p class="text-muted-foreground mt-1 text-xs">
					Connectez-vous avec l'appartement <strong>A01</strong> et le code PIN <strong>1234</strong>
				</p>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- FAQ -->
	<Card.Root class="border-t-2 border-primary">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<CircleHelp class="h-5 w-5 text-primary" />
				Questions fréquentes
			</Card.Title>
			<Card.Description>Les réponses aux questions courantes</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4 text-sm">
			<div class="space-y-1">
				<p class="font-medium text-foreground">J'ai oublié mon PIN</p>
				<p class="text-muted-foreground">Contactez l'administrateur — il pourra réinitialiser votre PIN.</p>
			</div>
			<div class="space-y-1">
				<p class="font-medium text-foreground">Puis-je réserver pour quelqu'un d'autre ?</p>
				<p class="text-muted-foreground">Non, chaque réservation est liée à votre compte. Seul le titulaire peut réserver.</p>
			</div>
			<div class="space-y-1">
				<p class="font-medium text-foreground">Que se passe-t-il si je déménage ?</p>
				<p class="text-muted-foreground">Votre compte sera désactivé par l'administrateur lors du départ.</p>
			</div>
			<div class="space-y-1">
				<p class="font-medium text-foreground">Comment modifier une réservation ?</p>
				<p class="text-muted-foreground">Depuis le calendrier en glissant-déposant, ou depuis Mes réservations.</p>
			</div>
			<div class="space-y-1">
				<p class="font-medium text-foreground">Comment mettre à jour mes coordonnées ?</p>
				<p class="text-muted-foreground">Depuis Mon compte dans la section Coordonnées. Ajoutez ou supprimez des emails et téléphones.</p>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Contact -->
	<Card.Root class="border-t-2 border-border">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Mail class="text-muted-foreground h-5 w-5" />
				Contact
			</Card.Title>
			<Card.Description>Une question ? Un problème ?</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-2">
			<a
				href="mailto:pierre.romon@gmail.com"
				class="text-foreground flex items-center gap-2 text-sm font-medium hover:underline"
			>
				<Mail class="h-4 w-4 shrink-0" />
				pierre.romon@gmail.com
			</a>
			<a
				href="https://wa.me/33641673279"
				target="_blank"
				rel="noopener noreferrer"
				class="text-foreground flex items-center gap-2 text-sm font-medium hover:underline"
			>
				<svg
					viewBox="0 0 24 24"
					class="h-4 w-4 shrink-0 fill-current"
					aria-hidden="true"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
					/>
				</svg>
				WhatsApp (+33 6 41 67 32 79)
			</a>
			<a
				href="https://github.com/pierrewagou/creneau"
				target="_blank"
				rel="noopener noreferrer"
				class="text-foreground flex items-center gap-2 text-sm font-medium hover:underline"
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
		</Card.Content>
	</Card.Root>

	<!-- À propos -->
	<Card.Root class="border-t-2 border-muted">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Info class="text-muted-foreground h-5 w-5" />
				À propos
			</Card.Title>
			<Card.Description>Stack technique</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<ul class="text-muted-foreground space-y-1.5 text-sm">
				<li class="flex items-center gap-2">
					<svg viewBox="0 0 98.1 118" class="h-4 w-4 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
						<path d="M91.8 15.6C80.9-.1 59.2-4.7 43.6 5.2L16.1 22.8C8.6 27.5 3.4 35.2 1.9 43.9c-1.3 7.3-.2 14.8 3.3 21.3-2.4 3.6-4 7.6-4.7 11.8-1.6 8.9.5 18.1 5.7 25.4 11 15.7 32.6 20.3 48.2 10.4l27.5-17.6c7.5-4.8 12.7-12.4 14.2-21.1 1.3-7.3.2-14.8-3.3-21.3 2.4-3.6 4-7.6 4.7-11.8 1.7-9-.4-18.2-5.7-25.4z" fill="#FF3E00"/>
						<path d="M40.9 103.9c-8.9 2.3-18.2-1.2-23.4-8.7-3.2-4.4-4.4-9.9-3.5-15.3.2-.9.4-1.7.6-2.6l.5-1.6 1.4 1c3.3 2.4 6.9 4.2 10.8 5.4l1 .3-.1 1c-.1 1.4.3 2.9 1.1 4.1 1.6 2.3 4.4 3.4 7.1 2.7.6-.2 1.2-.4 1.7-.7L65.5 72c1.4-.9 2.3-2.2 2.6-3.8.3-1.6-.1-3.3-1-4.6-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.7l-10.5 6.7c-1.7 1.1-3.6 1.9-5.6 2.4-8.9 2.3-18.2-1.2-23.4-8.7-3.1-4.4-4.4-9.9-3.4-15.3.9-5.2 3.9-9.9 8.3-12.9L47.2 14c1.7-1.1 3.6-1.9 5.6-2.4 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.2.9-.4 1.7-.7 2.6l-.5 1.6-1.4-1c-3.3-2.4-6.9-4.2-10.8-5.4l-1-.3.1-1c.1-1.4-.3-2.9-1.1-4.1-1.6-2.3-4.4-3.4-7.1-2.7-.6.2-1.2.4-1.7.7L32.8 43.6c-1.4.9-2.3 2.2-2.6 3.8-.3 1.6.1 3.3 1 4.6 1.6 2.3 4.4 3.3 7.1 2.6.6-.2 1.2-.4 1.7-.7l10.5-6.7c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.9 5.2-3.9 9.9-8.3 12.9L51.2 101c-1.7 1.1-3.6 1.9-5.6 2.4-.9.3-1.8.4-2.7.5z" fill="#FFF"/>
					</svg>
					<span>SvelteKit <span class="text-muted-foreground/70">— Framework web (Svelte 5)</span></span>
				</li>
				<li class="flex items-center gap-2">
					<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none">
						<path d="M21.678 3.276a2.47 2.47 0 0 0-3.008-1.59C16.02 2.41 10.775 8.24 9.11 10.7c-1.006-.207-2.937-.41-4.704.41C1.4 12.555.293 16.285.02 17.793c-.095.51.37.92.86.767.661-.203 1.549-.38 2.27-.275-.413.71-.671 1.524-.703 2.44-.024.664.495 1.194 1.147 1.11 1.74-.223 4.857-1.071 6.543-3.358.347.27.735.583 1.034.83.373.31.88.39 1.327.2 3.08-1.31 5.68-4.64 5.68-4.64s-1.94.55-3.36.42c-.12-.01-.23-.03-.35-.05 1.14-1.74 2.64-4.36 3.69-6.92 1.15-2.83 1.76-6.04 3.16-5.04" fill="#003B57"/>
						<path d="M21.678 3.276c-.597-.487-1.438-.598-2.185-.368-1.47 1.566-2.48 3.424-3.34 5.32 1.026.84 1.74 2.006 1.965 3.34.524-.975 1.004-1.942 1.4-2.868 1.147-2.83 1.76-6.04 3.16-5.04v-.384z" fill="#0F80CC"/>
					</svg>
					<span>SQLite <span class="text-muted-foreground/70">— Base de données via Drizzle ORM</span></span>
				</li>
				<li class="flex items-center gap-2">
					<svg viewBox="0 0 54 33" class="h-4 w-4 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
						<path fill-rule="evenodd" clip-rule="evenodd" d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z" fill="#06B6D4"/>
					</svg>
					<span>Tailwind v4 <span class="text-muted-foreground/70">— Styles + shadcn-svelte</span></span>
				</li>
				<li class="flex items-center gap-2">
					<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
						<path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.186.186 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.185.185v1.888c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" fill="#2496ED"/>
					</svg>
					<span>Docker <span class="text-muted-foreground/70">— Déployé via Dokploy</span></span>
				</li>
			</ul>
			<p class="text-muted-foreground text-center text-xs">Version {__APP_VERSION__}</p>
		</Card.Content>
	</Card.Root>
</div>
