<script lang="ts">
	import SpotChip, { type SpotLifecycleStatus } from './spot-chip.svelte';
import { Label } from './ui/label';
import './spot-chip-picker.css';

export interface SpotChipOption {
	number: string;
	status?: SpotLifecycleStatus | null;
	tint?: string | null;
}

interface Props {
	options: SpotChipOption[];
	value: string;
	onSelect: (spotNumber: string) => void;
}

let { options, value, onSelect }: Props = $props();
</script>

<div class="space-y-2">
	<Label>Place de parking</Label>
	<div role="radiogroup" aria-label="Place de parking" class="flex flex-wrap gap-2">
		{#each options as option (option.number)}
			{@const selected = option.number === value}
			<button
				type="button"
				role="radio"
				aria-checked={selected}
				aria-label={`Place ${option.number}`}
				class="spot-pick"
				onclick={() => onSelect(option.number)}
			>
				<SpotChip
					label={option.number}
					size="md"
					tone={selected ? 'solid' : 'muted'}
					status={selected ? null : (option.status ?? null)}
					tint={selected ? null : (option.tint ?? null)}
				/>
			</button>
		{/each}
	</div>
</div>
