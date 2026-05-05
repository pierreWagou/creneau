<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { toast } from 'svelte-sonner';
	import { format, parseISO, isPast } from 'date-fns';
	import { fr } from 'date-fns/locale';

	let { data } = $props();

	async function cancelBooking(id: number) {
		if (!confirm('Êtes-vous sûr de vouloir annuler cette réservation ?')) return;

		try {
			const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
			if (res.ok) {
				toast.success('Réservation annulée');
				invalidateAll();
			} else {
				const result = await res.json();
				toast.error(result.error || "Impossible d'annuler");
			}
		} catch {
			toast.error('Erreur de connexion');
		}
	}

	function formatDateTime(iso: string): string {
		return format(parseISO(iso), 'EEE d MMM - HH:mm', { locale: fr });
	}

	// Séparer en à venir et passées
	const upcoming = $derived(
		data.bookings
			.filter((b) => !isPast(parseISO(b.endTime)))
			.sort((a, b) => a.startTime.localeCompare(b.startTime))
	);

	const past = $derived(
		data.bookings
			.filter((b) => isPast(parseISO(b.endTime)))
			.sort((a, b) => b.startTime.localeCompare(a.startTime))
	);
</script>

<div class="space-y-6">
	<h2 class="text-2xl font-bold">Mes réservations</h2>

	{#if upcoming.length === 0 && past.length === 0}
		<Card.Root>
			<Card.Content class="py-8 text-center">
				<p class="text-muted-foreground">Vous n'avez aucune réservation.</p>
				<a href="/book">
					<Button class="mt-4">Réserver une place</Button>
				</a>
			</Card.Content>
		</Card.Root>
	{/if}

	{#if upcoming.length > 0}
		<div class="space-y-3">
			<h3 class="text-lg font-semibold">À venir</h3>
			{#each upcoming as booking}
				<Card.Root>
					<Card.Content class="flex items-center justify-between p-4">
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<p class="font-medium">{formatDateTime(booking.startTime)}</p>
								{#if booking.label}
									<Badge variant="secondary">{booking.label}</Badge>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground">
								jusqu'au {formatDateTime(booking.endTime)}
							</p>
							{#if booking.note}
								<p class="text-sm text-muted-foreground italic">{booking.note}</p>
							{/if}
						</div>
						<Button
							variant="destructive"
							size="sm"
							onclick={() => cancelBooking(booking.id)}
						>
							Annuler
						</Button>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}

	{#if past.length > 0}
		<div class="space-y-3">
			<h3 class="text-lg font-semibold text-muted-foreground">Passées</h3>
			{#each past as booking}
				<Card.Root class="opacity-60">
					<Card.Content class="p-4">
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<p class="font-medium">{formatDateTime(booking.startTime)}</p>
								{#if booking.label}
									<Badge variant="outline">{booking.label}</Badge>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground">
								jusqu'au {formatDateTime(booking.endTime)}
							</p>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
