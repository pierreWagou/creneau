<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
	/** lg = h-14 (headers), md = h-10 (nested cards), sm = h-8 (list rows), xs = h-6 (compact title rows) */
	size?: 'lg' | 'md' | 'sm' | 'xs';
		/** Tint hex (usually getFlatColor); null falls back to muted */
		tint?: string | null;
		/** Hides the circle from assistive tech when it duplicates adjacent text */
		decorative?: boolean;
		children: Snippet;
	}

	let { size = 'lg', tint = null, decorative = false, children }: Props = $props();

	const sizeClass =
		size === 'lg'
			? 'h-14 w-14 text-lg font-bold'
			: size === 'md'
				? 'h-10 w-10 text-sm font-bold'
				: size === 'sm'
					? 'h-8 w-8 text-sm font-semibold'
					: 'h-6 w-6 text-xs font-bold';
</script>

<span
	class="flex shrink-0 items-center justify-center rounded-full {sizeClass} {tint
		? ''
		: 'bg-muted text-muted-foreground'}"
	style={tint
		? `background-color: color-mix(in srgb, ${tint} 18%, transparent); color: ${tint}`
		: undefined}
	aria-hidden={decorative || undefined}
>
	{@render children()}
</span>
