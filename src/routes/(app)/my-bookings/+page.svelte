<script lang="ts">
	import CarFront from '@lucide/svelte/icons/car-front';
	import { format, isPast, isSameDay, isSameMonth, parseISO } from 'date-fns';
	import { fr } from 'date-fns/locale';
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { createBookingSSE } from '$lib/utils/sse';
	import { formatDuration } from '$lib/utils/time';

	let { data } = $props();

	let sse: ReturnType<typeof createBookingSSE> | null = null;
	let cancellingBookingId = $state<number | null>(null);

	onMount(() => {
		sse = createBookingSSE({
			onCreated: () => invalidateAll(),
			onCancelled: () => invalidateAll(),
			onUpdated: () => invalidateAll()
		});
	});

	onDestroy(() => {
		sse?.destroy();
	});

	async function cancelBooking(id: number) {
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
		cancellingBookingId = null;
	}

	function confirmCancel(id: number) {
		cancellingBookingId = id;
	}

	async function executeCancelBooking() {
		if (cancellingBookingId !== null) {
			await cancelBooking(cancellingBookingId);
		}
	}

	function formatMainLine(start: string, end: string): string {
		const startDate = parseISO(start);
		const endDate = parseISO(end);

		if (isSameDay(startDate, endDate)) {
			// "lundi 5 mai, 14h00 → 18h00"
			return `${format(startDate, "EEEE d MMMM, HH'h'mm", { locale: fr })} → ${format(endDate, "HH'h'mm")}`;
		}

		if (isSameMonth(startDate, endDate)) {
			// "lun. 5, 14h00 → mer. 7 mai, 10h00"
			return `${format(startDate, "EEE d, HH'h'mm", { locale: fr })} → ${format(endDate, "EEE d MMMM, HH'h'mm", { locale: fr })}`;
		}

		// "lun. 30 avril, 14h00 → mer. 2 mai, 10h00"
		return `${format(startDate, "EEE d MMMM, HH'h'mm", { locale: fr })} → ${format(endDate, "EEE d MMMM, HH'h'mm", { locale: fr })}`;
	}

	function formatCreatedAt(iso: string): string {
		return `Réservé le ${format(parseISO(iso), 'd MMMM', { locale: fr })}`;
	}

	// Séparer en à venir et passées
	const upcoming = $derived(
		data.bookings.filter((b) => !isPast(parseISO(b.endTime))).sort((a, b) => a.startTime.localeCompare(b.startTime))
	);

	const past = $derived(
		data.bookings.filter((b) => isPast(parseISO(b.endTime))).sort((a, b) => b.startTime.localeCompare(a.startTime))
	);
</script>

<div class="space-y-6">
	<h2 class="page-title">Mes réservations</h2>

	{#if upcoming.length === 0 && past.length === 0}
		<Card.Root>
			<Card.Content class="py-8 text-center">
				<p class="text-muted-foreground">Vous n'avez aucune réservation.</p>
				<a href="/book">
					<Button class="mt-4">Réserver une place de parking</Button>
				</a>
			</Card.Content>
		</Card.Root>
	{/if}

	{#if upcoming.length > 0}
		<div class="space-y-3">
			<h3 class="text-lg font-semibold">À venir</h3>
			{#each upcoming as booking}
				<Card.Root>
					<Card.Content class="p-4">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 space-y-1">
								<p class="font-medium capitalize">{formatMainLine(booking.startTime, booking.endTime)}</p>
							<p class="text-muted-foreground text-sm">
																{formatCreatedAt(booking.createdAt)} · <span class="inline-flex items-center gap-1"><CarFront class="h-3 w-3" />{booking.spotNumber}</span>{#if booking.note} · {booking.note}{/if}
							</p>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<Badge variant="outline">{formatDuration(booking.startTime, booking.endTime)}</Badge>
							<Button variant="destructive" size="sm" onclick={() => confirmCancel(booking.id)}>Annuler</Button>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}

	{#if past.length > 0}
		<div class="space-y-3">
			<h3 class="text-muted-foreground text-lg font-semibold">Passées</h3>
			{#each past as booking}
				<Card.Root class="opacity-60">
					<Card.Content class="p-4">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 space-y-1">
								<p class="font-medium capitalize">{formatMainLine(booking.startTime, booking.endTime)}</p>
							<p class="text-muted-foreground text-sm">
																{formatCreatedAt(booking.createdAt)} · <span class="inline-flex items-center gap-1"><CarFront class="h-3 w-3" />{booking.spotNumber}</span>{#if booking.note} · {booking.note}{/if}
							</p>
						</div>
							<Badge variant="outline">{formatDuration(booking.startTime, booking.endTime)}</Badge>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>

<!-- AlertDialog: Cancel confirmation -->
<AlertDialog.Root
	open={cancellingBookingId !== null}
	onOpenChange={(o) => {
		if (!o) cancellingBookingId = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Annuler la réservation</AlertDialog.Title>
			<AlertDialog.Description>Êtes-vous sûr de vouloir annuler cette réservation ?</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Non</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" onclick={executeCancelBooking}>Annuler la réservation</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
