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
}

declare module '@event-calendar/core/index.css';
