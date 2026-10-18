<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
import ClipboardList from '@lucide/svelte/icons/clipboard-list';
import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Ticket from '@lucide/svelte/icons/ticket';
	import Zap from '@lucide/svelte/icons/zap';
	import Logo from '$lib/components/logo.svelte';
	import * as Card from '$lib/components/ui/card';
	import { SUPPORT_URL } from '$lib/constants';
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<!-- Hero -->
	<div class="flex flex-col items-center gap-3 py-6 text-center">
		<Logo class="h-12 w-12" />
		<h1 class="text-2xl font-bold tracking-tight">Guide résident</h1>
		<p class="text-muted-foreground text-sm">Réserver et gérer vos places de parking, étape par étape</p>
	</div>

	<!-- Commencer -->
	<Card.Root class="border-t-2 border-primary">
		<Card.Header>
			<Card.Title class="card-title-row">
				<Zap class="text-primary h-5 w-5" />
				Commencer
			</Card.Title>
			<Card.Description>Comment accéder à l'application</Card.Description>
		</Card.Header>
		<Card.Content>
			<ol class="text-muted-foreground space-y-3 text-sm">
				<li class="flex items-start gap-3">
					<span class="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">1</span>
					<span><strong class="text-foreground">Demandez l'accès</strong> via le formulaire avec votre numéro de lot, vos places de parking souhaitées et vos coordonnées</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">2</span>
					<span>Le conseil syndical approuve votre demande et vous envoie un <strong class="text-foreground">code d'activation</strong> (valable 24h)</span>
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
			<Card.Title class="card-title-row">
				<CalendarDays class="h-5 w-5 text-warning" />
				Réserver une place de parking
			</Card.Title>
			<Card.Description>Quelques clics et c'est fait</Card.Description>
		</Card.Header>
		<Card.Content>
			<ol class="text-muted-foreground space-y-3 text-sm">
				<li class="flex items-start gap-3">
					<span class="bg-warning text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">1</span>
					<span>Ouvrez le <strong class="text-foreground">Calendrier</strong> ou la page <strong class="text-foreground">Réserver</strong></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-warning text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">2</span>
					<span>Choisissez votre <strong class="text-foreground">place</strong> en touchant sa pastille (elle devient bleue) — s'il n'y en a qu'une, elle est déjà sélectionnée</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-warning text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">3</span>
					<span>Choisissez une <strong class="text-foreground">date</strong> (les cases vertes sont libres) puis votre <strong class="text-foreground">créneau horaire</strong></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-warning text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">4</span>
					<span>Ajoutez une <strong class="text-foreground">note</strong> si besoin (optionnel) puis <strong class="text-foreground">Confirmez</strong> — c'est réservé !</span>
				</li>
			</ol>
		</Card.Content>
	</Card.Root>

	<!-- Calendrier -->
	<Card.Root class="border-t-2 border-info">
		<Card.Header>
			<Card.Title class="card-title-row">
				<CalendarDays class="h-5 w-5 text-info" />
				Calendrier
			</Card.Title>
			<Card.Description>La vue d'ensemble du parking</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="text-muted-foreground space-y-2 text-sm">
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-info">•</span>
					<span>Basculez entre les vues <strong class="text-foreground">mois, semaine et jour</strong></span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-info">•</span>
					<span><strong class="text-foreground">Déplacez vos futures réservations</strong> en les glissant-déposant (vos réservations uniquement)</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-info">•</span>
					<span>Cliquez sur une réservation pour voir son <strong class="text-foreground">détail</strong></span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Gérer vos réservations -->
	<Card.Root class="border-t-2 border-accent">
		<Card.Header>
			<Card.Title class="card-title-row">
				<ClipboardList class="text-accent h-5 w-5" />
				Gérer vos réservations
			</Card.Title>
			<Card.Description>Modifiez, changez de place, annulez</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="text-muted-foreground space-y-2 text-sm">
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span>Consultez <strong class="text-foreground">Mes réservations</strong> pour voir vos créneaux à venir</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span><strong class="text-foreground">Modifiez</strong> une réservation : dates, horaires <strong class="text-foreground">et même la place</strong> (mêmes pastilles que pour réserver), puis validez avec <strong class="text-foreground">Modifier</strong></span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span><strong class="text-foreground">Annulez</strong> à tout moment depuis Mes réservations — vous recevez un email de confirmation et la place se libère aussitôt</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span>Une réservation annulée reste affichée avec une pastille rouge <strong class="text-foreground">« Annulée »</strong></span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span>Tout se met à jour <strong class="text-foreground">en direct</strong> pour tous les résidents</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Emails -->
	<Card.Root class="border-t-2 border-success">
		<Card.Header>
			<Card.Title class="card-title-row">
				<Ticket class="h-5 w-5 text-success" />
				Emails automatiques
			</Card.Title>
			<Card.Description>Vous êtes prévenu à chaque étape</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="text-muted-foreground space-y-2 text-sm">
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-success">•</span>
					<span><strong class="text-foreground">Confirmation</strong> de réservation, avec une <strong class="text-foreground">invitation calendrier</strong> en pièce jointe</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-success">•</span>
					<span><strong class="text-foreground">Modification</strong> ou <strong class="text-foreground">annulation</strong>, y compris par un administrateur — votre calendrier est mis à jour via la pièce jointe</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-success">•</span>
					<span>Le bouton <strong class="text-foreground">« Voir ma réservation »</strong> rouvre son détail dans l'application</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Mon compte -->
	<Card.Root class="border-t-2 border-info">
		<Card.Header>
			<Card.Title class="card-title-row">
				<Mail class="h-5 w-5 text-info" />
				Mon compte
			</Card.Title>
			<Card.Description>Gardez vos informations à jour</Card.Description>
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
					<span>Changez aussi votre <strong class="text-foreground">nom affiché</strong> et votre <strong class="text-foreground">code PIN</strong> depuis cette page</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-info">•</span>
					<span>Vos coordonnées ne sont visibles que par vous et les administrateurs</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Activité -->
	<Card.Root class="border-t-2 border-accent">
		<Card.Header>
			<Card.Title class="card-title-row">
				<ChartBar class="h-5 w-5 text-accent" />
				Activité
			</Card.Title>
			<Card.Description>Statistiques et transparence</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="text-muted-foreground space-y-2 text-sm">
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span>Consultez vos <strong class="text-foreground">statistiques personnelles</strong> : heures de réservation, nombre de créneaux</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span>Suivez l'<strong class="text-foreground">utilisation globale</strong> de l'immeuble</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-accent mt-0.5">•</span>
					<span>Découvrez le <strong class="text-foreground">classement des résidents</strong> — transparent pour tous</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Règles simples -->
	<Card.Root class="border-t-2 border-booking-busy">
		<Card.Header>
			<Card.Title class="card-title-row">
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
					<span>Les réservations <strong class="text-foreground">passées sont immuables</strong> : on ne peut ni les modifier ni les annuler</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-booking-busy">•</span>
					<span><strong class="text-foreground">Pas de conflit possible</strong> — si une place de parking est prise, l'appli l'empêche</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Confidentialité -->
	<Card.Root class="border-t-2 border-info">
		<Card.Header>
			<Card.Title class="card-title-row">
				<Lock class="h-5 w-5 text-info" />
				Confidentialité
			</Card.Title>
			<Card.Description>Vos données sont protégées</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-2">
			<p class="text-muted-foreground text-sm">
				Les données stockées sont les numéros de lot, les places de parking, les horaires de réservation
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

	<!-- Contact -->
	<Card.Root class="border-t-2 border-border">
		<Card.Header>
			<Card.Title class="card-title-row">
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
				href={SUPPORT_URL}
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
		</Card.Content>
	</Card.Root>
</div>
