<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let { ref = $bindable(null), class: className, ...restProps }: RangeCalendarPrimitive.CellProps = $props();
</script>

<RangeCalendarPrimitive.Cell
	bind:ref
	class={cn(
		'[&:has([data-range-middle])]:bg-primary/10 [&:has([data-selected])]:bg-primary/10 dark:[&:has([data-range-start])]:hover:bg-primary/20 dark:[&:has([data-range-end])]:hover:bg-primary/20 dark:[&:has([data-range-middle])]:hover:bg-primary/15 relative size-(--cell-size) p-0 text-center text-sm focus-within:z-20 data-[range-middle]:rounded-e-(--cell-radius) [&:first-child[data-selected]_[data-bits-day]]:rounded-s-(--cell-radius) [&:has([data-range-end])]:rounded-e-(--cell-radius) [&:has([data-range-middle])]:rounded-none first:[&:has([data-range-middle])]:rounded-s-(--cell-radius) last:[&:has([data-range-middle])]:rounded-e-(--cell-radius) [&:has([data-range-start])]:rounded-s-(--cell-radius) [&:last-child[data-selected]_[data-bits-day]]:rounded-e-(--cell-radius)',
		className
	)}
	{...restProps}
/>
