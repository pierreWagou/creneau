<script lang="ts">
import Info from '@lucide/svelte/icons/info';
import Mail from '@lucide/svelte/icons/mail';
import MapPin from '@lucide/svelte/icons/map-pin';
import Shield from '@lucide/svelte/icons/shield';
import Ticket from '@lucide/svelte/icons/ticket';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import UserX from '@lucide/svelte/icons/user-x';
	import Logo from '$lib/components/logo.svelte';
	import * as Card from '$lib/components/ui/card';
	import { SUPPORT_URL } from '$lib/constants';
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<!-- Hero -->
	<div class="flex flex-col items-center gap-3 py-6 text-center">
		<Logo class="h-12 w-12" />
		<h1 class="text-2xl font-bold tracking-tight">Guide administrateur</h1>
		<p class="text-muted-foreground text-sm">Comment gérer les résidents, les places de parking et les accès</p>
	</div>

	<!-- Ajouter un lot -->
	<Card.Root class="border-t-2 border-primary">
		<Card.Header>
			<Card.Title class="card-title-row">
				<UserPlus class="text-primary h-5 w-5" />
				Ajouter un lot
			</Card.Title>
			<Card.Description>Inviter un nouvel habitant à rejoindre Créneau</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm">
			<ol class="text-muted-foreground space-y-3">
				<li class="flex items-start gap-3">
					<span class="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">1</span>
					<span>Dans <strong class="text-foreground">Admin</strong>, cliquez sur <strong class="text-foreground">« Ajouter »</strong></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">2</span>
					<span>Entrez le <strong class="text-foreground">numéro de lot</strong> et les <strong class="text-foreground">numéros de places de parking</strong> associées</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">3</span>
					<span>Cliquez sur le lot puis <strong class="text-foreground">« Générer un lien »</strong></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">4</span>
					<span>Partagez l'invitation (valable 24h) : <strong class="text-foreground">QR code</strong> à flasher, <strong class="text-foreground">lien</strong> à copier, <strong class="text-foreground">email</strong> envoyé à une adresse ou à toutes, ou <strong class="text-foreground">message WhatsApp</strong> direct</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">5</span>
					<span>Besoin d'un nouveau code ou d'annuler l'invitation ? Retournez sur le lot et cliquez sur <strong class="text-foreground">« Régénérer »</strong> ou <strong class="text-foreground">« Révoquer »</strong></span>
				</li>
			</ol>
			<div class="rounded-md bg-muted p-3 text-sm">
				<p class="text-muted-foreground">Les résidents peuvent aussi demander la création de leur lot via le formulaire d'accès. Ces demandes apparaissent dans la liste des lots avec un badge bleu « Demande » et peuvent être approuvées ou rejetées directement depuis la ligne.</p>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Révoquer l'accès -->
	<Card.Root class="border-t-2 border-booking-busy">
		<Card.Header>
			<Card.Title class="card-title-row">
				<UserX class="h-5 w-5 text-booking-busy" />
				Révoquer l'accès
			</Card.Title>
			<Card.Description>Désactiver un compte résident</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm">
			<ol class="text-muted-foreground space-y-3">
				<li class="flex items-start gap-3">
					<span class="bg-booking-busy text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">1</span>
					<span>Dans <strong class="text-foreground">Admin</strong>, cliquez sur le lot concerné</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-booking-busy text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">2</span>
					<span>Cliquez sur <strong class="text-foreground">« Réinitialiser »</strong> et confirmez</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="bg-booking-busy text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">3</span>
					<span>Le PIN est effacé, les sessions fermées, le compte revient en état <strong class="text-foreground">Inactif</strong></span>
				</li>
			</ol>
			<div class="rounded-md bg-muted p-3 text-sm">
				<p class="text-muted-foreground">Les réservations existantes ne sont pas supprimées. Le résident ne pourra plus se connecter.</p>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Gérer les coordonnées -->
	<Card.Root class="border-t-2 border-success">
		<Card.Header>
			<Card.Title class="card-title-row">
				<Mail class="h-5 w-5 text-success" />
				Gérer les coordonnées
			</Card.Title>
			<Card.Description>Emails et téléphones de chaque résident</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm">
			<ul class="text-muted-foreground space-y-2">
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-success">•</span>
					<span>Ouvrez les détails d'un lot puis cliquez sur <strong class="text-foreground">« Modifier »</strong></span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-success">•</span>
					<span>Ajoutez ou supprimez des <strong class="text-foreground">emails</strong> et <strong class="text-foreground">téléphones</strong> — chaque modification est sauvegardée immédiatement</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-success">•</span>
					<span>Un lot doit avoir <strong class="text-foreground">au moins 1 email et 1 téléphone</strong></span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Gérer la place partagée -->
	<Card.Root class="border-t-2 border-warning">
		<Card.Header>
			<Card.Title class="card-title-row">
				<MapPin class="h-5 w-5 text-warning" />
			Gérer les places de parking
		</Card.Title>
			<Card.Description>Places de parking assignées, échanges et réaffectation</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm">
			<ul class="text-muted-foreground space-y-2">
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-warning">•</span>
					<span>Ajoutez ou supprimez des places de parking depuis <strong class="text-foreground">Modifier</strong> — chaque modification est sauvegardée immédiatement</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-warning">•</span>
					<span>Si la place de parking demandée est déjà attribuée à un autre lot, un <strong class="text-foreground">dialogue de confirmation</strong> propose de la réaffecter</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-warning">•</span>
					<span>La réaffectation est impossible si elle laisserait l'autre lot <strong class="text-foreground">sans place de parking</strong></span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-warning">•</span>
					<span>Pour réorganiser plusieurs places d'un coup, ouvrez l'onglet <strong class="text-foreground">Places</strong> : glissez-déposez les places entre les places partagées, les lots et les non affectées, puis cliquez sur <strong class="text-foreground">« Appliquer »</strong> — rien n'est enregistré avant ce clic</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-warning">•</span>
					<span>Les places retirées d'un lot (suppression, détachement, échange) atterrissent en <strong class="text-foreground">« Non affectée »</strong> : repartagez-les ou réassignez-les explicitement, elles ne rejoignent pas le pool toutes seules</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Gérer les réservations -->
	<Card.Root class="border-t-2 border-info">
		<Card.Header>
			<Card.Title class="card-title-row">
				<Ticket class="h-5 w-5 text-info" />
				Gérer les réservations
			</Card.Title>
			<Card.Description>Toutes les réservations des résidents</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm">
			<ul class="text-muted-foreground space-y-2">
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-info">•</span>
					<span>L'onglet <strong class="text-foreground">Réservations</strong> liste les réservations de tous les lots, avec recherche et filtres par statut (<strong class="text-foreground">En cours</strong>, <strong class="text-foreground">À venir</strong>, <strong class="text-foreground">Passées</strong>)</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-info">•</span>
					<span>Cliquez sur une réservation pour voir son créneau, modifier sa note ou télécharger l'invitation calendrier (.ics)</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-info">•</span>
					<span><strong class="text-foreground">Modifier</strong> rouvre le parcours de réservation complet, y compris le changement de place (conflits vérifiés sur la place cible)</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-info">•</span>
					<span><strong class="text-foreground">Annuler</strong> passe la réservation en « Annulée » (conservée et affichée avec une pastille rouge) et <strong class="text-foreground">prévient le résident par email</strong></span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Administrateurs -->
	<Card.Root class="border-t-2 border-accent">
		<Card.Header>
			<Card.Title class="card-title-row">
				<Shield class="h-5 w-5 text-accent" />
				Administrateurs
			</Card.Title>
			<Card.Description>Gérer les droits d'administration</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm">
			<ul class="text-muted-foreground space-y-2">
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-accent">•</span>
					<span>Promouvoir un résident en admin : cliquez sur le lot puis activez le toggle <strong class="text-foreground">« Rendre admin »</strong></span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-accent">•</span>
					<span>Rétrograder un admin : même procédure, désactivez le toggle</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-accent">•</span>
					<span>Un admin ne peut <strong class="text-foreground">pas se supprimer</strong> ni se réinitialiser lui-même</span>
				</li>
			</ul>
		</Card.Content>
	</Card.Root>

	<!-- Besoin d'aide ? -->
	<Card.Root class="border-t-2 border-border">
		<Card.Header>
			<Card.Title class="card-title-row">
				<Info class="text-muted-foreground h-5 w-5" />
				Besoin d'aide ?
			</Card.Title>
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
