<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import CarFront from '@lucide/svelte/icons/car-front';
	import Download from '@lucide/svelte/icons/download';
	import { mode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import { getFlatColor } from '$lib/colors';
	import type { BookingWithFlat } from '$lib/types';
	import { apiFetch } from '$lib/utils/api';
	import { bookingLiveness } from '$lib/utils/time';
	import { notifyResult } from '$lib/utils/toasts';
	import BookingSlotTimeline from './booking-slot-timeline.svelte';
	import BookingStatusPill from './booking-status-pill.svelte';
	import AvatarCircle from './detail/avatar-circle.svelte';
	import DetailCard from './detail/card.svelte';
	import DetailSection from './detail/section.svelte';
	import EditableField from './editable-field.svelte';
	import EntityHeaderCard from './entity-header-card.svelte';
	import FlatLifecycleCard from './flat-lifecycle-card.svelte';
	import IdentityRow from './identity-row.svelte';
	import { Button } from './ui/button';

	interface Props {
		booking: BookingWithFlat;
		onNoteChanged: () => void;
		/** When provided, the lot cell links there (admin drawer navigates to the lot). */
		lotHref?: string | null;
		/** When provided, the spot cell links there (admin drawer navigates to the spot). */
		spotHref?: string | null;
	}

	let { booking, onNoteChanged, lotHref = null, spotHref = null }: Props = $props();

	const isDark = $derived(mode.current === 'dark');

	let editingNote = $state(false);
	let noteDraft = $state('');
	let savingNote = $state(false);

	const liveness = $derived(bookingLiveness(booking.startTime, booking.endTime));

	function startEditNote() {
		noteDraft = booking.note ?? '';
		editingNote = true;
	}

	async function commitNote() {
		if (savingNote) return;
		savingNote = true;
		try {
			const result = await apiFetch(
				`/api/bookings/${booking.id}`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ note: noteDraft })
				},
				'Impossible de modifier'
			);
			if (result.ok) {
				toast.success('Note mise à jour');
				editingNote = false;
				onNoteChanged();
			} else {
				notifyResult(result, null, 'Impossible de modifier');
			}
		} finally {
			savingNote = false;
		}
	}
</script>

<EntityHeaderCard title="Réservation #{booking.id}">
	{#snippet avatar()}
		<AvatarCircle tint={getFlatColor(booking.flatNumber, isDark)} decorative>
			<CalendarDays class="h-7 w-7" />
		</AvatarCircle>
	{/snippet}
	{#snippet status()}
		<BookingStatusPill startTime={booking.startTime} endTime={booking.endTime} status={booking.status} />
	{/snippet}
</EntityHeaderCard>

<div class="mt-4">
	<div class="grid grid-cols-2 gap-2">
		<p class="dialog-section-label mb-2">Place</p>
		<p class="dialog-section-label mb-2">Lot</p>
	</div>
	<div class="grid grid-cols-2 gap-2">
		<svelte:element
			this={spotHref ? 'a' : 'div'}
			href={spotHref ?? undefined}
			class="rounded-lg border border-border p-3 text-center min-h-[88px] flex flex-col items-center justify-center transition-colors {spotHref
				? 'hoverable-card'
				: ''}"
		>
			<div class="flex items-center justify-center gap-2">
				<CarFront class="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
				<p class="text-2xl font-semibold">{booking.spotNumber}</p>
			</div>
		</svelte:element>
		<svelte:element
			this={lotHref ? 'a' : 'div'}
			href={lotHref ?? undefined}
			class="rounded-lg border border-border p-3 min-h-[88px] flex items-center justify-center gap-2 text-center transition-colors {lotHref
				? 'hoverable-card'
				: ''}"
		>
			<IdentityRow
				avatar={{ initial: booking.flatNumber, tint: getFlatColor(booking.flatNumber, isDark) }}
				title="Lot {booking.flatNumber}"
				subtitle={booking.flatDisplayName}
				centered
			/>
		</svelte:element>
	</div>
</div>

<DetailSection title="Informations">
	<DetailCard>
		<div class="space-y-1 text-sm">
			<div class="flex items-center gap-2">
				<span class="text-muted-foreground shrink-0">Note : </span>
				<EditableField
					editing={editingNote}
					editable={liveness !== 'past'}
					editLabel="Modifier la note"
					onStart={startEditNote}
					ariaLabel="Note de la réservation"
					placeholder="Ajouter une note…"
					bind:value={noteDraft}
					initial={booking.note ?? ''}
					committable={noteDraft.trim() !== (booking.note ?? '').trim()}
					disabled={savingNote}
					onCommit={commitNote}
					onCancel={() => (editingNote = false)}
				>
					{#snippet display()}
						{#if booking.note}
							<span>{booking.note}</span>
						{:else}
							<span class="text-muted-foreground">—</span>
						{/if}
					{/snippet}
				</EditableField>
			</div>
		</div>
	</DetailCard>
</DetailSection>

<DetailSection title="Créneau">
	<BookingSlotTimeline startTime={booking.startTime} endTime={booking.endTime}>
		{#snippet corner()}
			<Button
				href={`/api/bookings/${booking.id}/ics`}
				download={`reservation-${booking.id}.ics`}
				variant="outline"
				size="icon-sm"
				aria-label="Télécharger l'invitation calendrier"
			>
				<Download class="h-4 w-4" />
			</Button>
		{/snippet}
	</BookingSlotTimeline>
</DetailSection>

<DetailSection title="Cycle de vie">
	<FlatLifecycleCard
		createdAt={booking.createdAt}
		createdLabel="Réservation créée"
		activatedAt={booking.startTime}
		activatedLabel="Début du créneau"
		endedAt={booking.endTime}
		endedLabel="Fin du créneau"
	/>
</DetailSection>
