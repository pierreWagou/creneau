<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { type DetailStatus, statusBadgeClass } from './status';

	interface Props {
		status: DetailStatus;
		children: Snippet;
	}

	let { status, children }: Props = $props();
</script>

<Badge class="shrink-0 {statusBadgeClass(status)}">
	{@render children()}
</Badge>
