declare module '@event-calendar/core' {
	import type { SvelteComponent } from 'svelte';
	export class Calendar extends SvelteComponent<{ plugins: any[]; options: any }> {
		setOption(name: string, value: any): void;
		$destroy(): void;
	}
	export const TimeGrid: any;
	export const DayGrid: any;
	export const List: any;
	export const Interaction: any;
	export const ResourceTimeGrid: any;
	export const ResourceTimeline: any;
}

declare module '@event-calendar/time-grid' {
	const plugin: any;
	export default plugin;
}

declare module '@event-calendar/day-grid' {
	const plugin: any;
	export default plugin;
}

declare module '@event-calendar/list' {
	const plugin: any;
	export default plugin;
}

declare module '@event-calendar/interaction' {
	const plugin: any;
	export default plugin;
}
