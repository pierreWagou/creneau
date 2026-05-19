<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let { ref = $bindable(null), class: className, ...restProps }: RangeCalendarPrimitive.DayProps = $props();
</script>

<RangeCalendarPrimitive.Day
	bind:ref
	class={cn(
		'flex size-(--cell-size) flex-col items-center justify-center gap-1 rounded-(--cell-radius) p-0 leading-none font-normal whitespace-nowrap select-none',
		'not-data-selected:hover:bg-primary/15 not-data-selected:hover:text-foreground',
		'[&[data-today]:not([data-selected])]:bg-primary/10 [&[data-today]:not([data-selected])]:text-foreground [&[data-today][data-disabled]]:text-muted-foreground data-[range-middle]:rounded-none',
		// range Start
		'data-[range-start]:bg-primary data-[range-start]:text-primary-foreground data-[range-start]:hover:text-primary-foreground',
		// range End
		'data-[range-end]:bg-primary data-[range-end]:text-primary-foreground data-[range-end]:hover:text-primary-foreground',
		// Range middle
		'data-[range-middle]:text-foreground',
		// Outside months
		'[&[data-outside-month]:not([data-selected])]:text-muted-foreground [&[data-outside-month]:not([data-selected])]:hover:text-foreground',
		// Disabled
		'data-[disabled]:text-muted-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
		// Unavailable
		'data-[unavailable]:line-through',
		// focus
		'focus:border-ring focus:ring-ring/50 focus:relative',
		// inner spans
		'[&>span]:text-xs [&>span]:opacity-70',
		className
	)}
	{...restProps}
/>
