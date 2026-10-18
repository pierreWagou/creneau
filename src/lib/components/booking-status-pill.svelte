<script lang="ts">
	import { bookingStatusPill } from '$lib/utils/bookings';

	interface Props {
		startTime: string;
		endTime: string;
		status?: 'active' | 'cancelled';
	}

	let { startTime, endTime, status = 'active' }: Props = $props();

	const pill = $derived(bookingStatusPill(startTime, endTime, status));
</script>

<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {pill.className}">{pill.label}</span>
