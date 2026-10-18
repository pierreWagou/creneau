<script lang="ts">
	import { Button } from './ui/button';

	interface Props {
		page: number;
		totalPages: number;
		onPage: (page: number) => void;
	}

	let { page, totalPages, onPage }: Props = $props();
</script>

<div class="flex items-center gap-2">
	<span class="text-muted-foreground text-xs">Page {page}/{totalPages}</span>
	<Button size="sm" variant="outline" disabled={page <= 1} onclick={() => onPage(page - 1)}>
		Précédent
	</Button>
	<Button size="sm" variant="outline" disabled={page >= totalPages} onclick={() => onPage(page + 1)}>
		Suivant
	</Button>
</div>
