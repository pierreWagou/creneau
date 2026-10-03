<script lang="ts">
	import Shield from '@lucide/svelte/icons/shield';

	/**
	 * Shared admin-status glyph: single source for the shield icon + fill + color + size.
	 * Solid primary = admin enabled; muted outline = disabled/off. Interactivity (buttons,
	 * tooltips, handlers) stays at call sites — this owns only the glyph.
	 */
	interface Props {
		/** true → solid primary glyph; false → muted outline */
		active?: boolean;
		/** sm = h-3.5 (list rows), md = h-4 (headers) */
		size?: 'sm' | 'md';
		class?: string;
	}

	let { active = true, size = 'md', class: className = '' }: Props = $props();
</script>

<Shield
	class="{size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 {active
		? 'text-primary'
		: 'text-muted-foreground'} {className}"
	fill={active ? 'currentColor' : 'none'}
	aria-hidden="true"
/>
