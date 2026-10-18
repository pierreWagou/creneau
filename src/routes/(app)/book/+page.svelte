<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import BookingFlow, { type BookingSelection } from '$lib/components/booking-flow.svelte';
	import type { SpotChipOption } from '$lib/components/spot-chip-picker.svelte';
	import { apiFetch } from '$lib/utils/api';
import { notifyMailFailed, notifyResult } from '$lib/utils/toasts';

	let { data } = $props();

	// The server only loads shared spots — status is known statically, and
	// shared spots never carry a lot tint.
	const spotOptions: SpotChipOption[] = data.spots.map((s) => ({ number: s.number, status: s.status, tint: null }));

	async function createReservation(selection: BookingSelection) {
		const result = await apiFetch<{ mailFailed?: boolean }>(
			'/api/bookings',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					spotNumber: selection.spotNumber,
					startTime: selection.startTime,
					endTime: selection.endTime,
					note: selection.note ?? null
				})
			},
			'Échec de la réservation'
		);

		if (result.ok) {
			toast.success('Réservation confirmée');
			notifyMailFailed(result.data?.mailFailed);
			goto('/calendar');
		} else {
			notifyResult(result, null, 'Échec de la réservation');
		}
	}
</script>

<div class="mx-auto max-w-md space-y-4">
	<h2 class="page-title">Réserver une place de parking</h2>
	<BookingFlow
		spots={spotOptions}
		initialSpot={data.initialSpot}
		calendarStatuses={data.calendarStatuses}
		prefilledDate={data.prefilledDate || null}
		prefilledEndDate={data.prefilledEndDate || null}
		prefilledStartHour={data.prefilledStartHour}
		prefilledEndHour={data.prefilledEndHour}
		submitLabel="Confirmer la réservation"
		submittingLabel="Réservation..."
		onSubmit={createReservation}
	/>
</div>
