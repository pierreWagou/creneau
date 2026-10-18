<script module lang="ts">
	import type { SpotLifecycleStatus } from '$lib/spot-containers';

	export type SpotChipSize = 'sm' | 'md';
	type SpotChipTone =
		| 'muted'
		| 'highlight'
		| 'solid'
		| 'preview'
		| 'shadow'
		| 'struck'
		| 'ghost';

	/** Spot lifecycle state for color — owned by the domain module, re-exported here. */
	export type { SpotLifecycleStatus };

	export interface SpotChipState {
		tone: SpotChipTone;
		status?: SpotLifecycleStatus | null;
		tint?: string | null;
		fly?: 'src' | 'slot' | 'preview' | 'ghost' | null;
		ghosted?: boolean;
	}

	const SIZE_CLASS: Record<SpotChipSize, string> = {
		sm: 'px-1.5 py-1 text-xs',
		md: 'px-2.5 py-1.5 text-sm'
	};

	const TONE_CLASS: Record<SpotChipTone, string> = {
		muted: 'border-border text-muted-foreground',
		highlight: 'border-primary/50 bg-primary/5',
		solid: 'border-primary bg-primary text-primary-foreground',
		preview: 'border-dashed border-primary/60 text-primary',
		shadow: 'border-dashed border-primary/60 text-transparent select-none',
		struck: 'border-primary/50 bg-primary/5 opacity-60 line-through',
		ghost: 'border-primary/60 bg-background'
	};

	/**
	 * Lifecycle base color: shared → blue, unassigned → grey, assigned →
	 * border reset (the tint rides along via `spotStatusStyle`, avatar recipe).
	 */
	export function spotStatusClass(status: SpotLifecycleStatus): string {
		switch (status) {
			case 'shared':
				return 'border-primary/50 bg-primary/10 text-primary';
		case 'unassigned':
			return 'border-border text-foreground/80';
			case 'assigned':
				return 'border-transparent';
		}
	}

	/**
	 * Inline tint for `assigned` chips (same `color-mix` recipe as AvatarCircle).
	 * Returns undefined for anything else — color then comes from classes.
	 */
	export function spotStatusStyle(
		status: SpotLifecycleStatus | null | undefined,
		tint: string | null | undefined
	): string | undefined {
		if (status !== 'assigned' || !tint) return undefined;
		return `background-color: color-mix(in srgb, ${tint} 18%, transparent); color: ${tint}; border-color: color-mix(in srgb, ${tint} 45%, transparent);`;
	}

	const ICON_CLASS: Record<SpotChipSize, string> = {
		sm: 'h-3 w-3',
		md: 'h-3.5 w-3.5'
	};

	/**
	 * Full chip look for custom-root callers (mercato drag handles): same
	 * color/decoration resolution as the component below. Assigned tint rides
	 * separately via `spotStatusStyle` (inline style, avatar recipe).
	 */
	export function spotChipFullClass(
		size: SpotChipSize = 'sm',
		tone: SpotChipTone = 'muted',
		status?: SpotLifecycleStatus | null
	): string {
		const structural = tone === 'preview' || tone === 'shadow' || tone === 'ghost';
		const color = status && !structural ? spotStatusClass(status) : TONE_CLASS[tone];
		const decor =
			!status || structural
				? ''
				: tone === 'highlight'
					? ' ring-1 ring-current'
					: tone === 'struck'
						? ' opacity-60 line-through'
						: '';
		return `rounded border font-semibold ${SIZE_CLASS[size]} ${color}${decor}`;
	}

	/**
	 * Car-icon sizing paired with `spotChipFullClass` — same `size` scale, so
	 * callers that render their own chip root (mercato drag handles) stay
	 * consistent with `SpotChip`. The icon inherits `currentColor` and
	 * follows the chip tone.
	 */
	export function spotChipIconClass(size: SpotChipSize = 'sm'): string {
		return `shrink-0 ${ICON_CLASS[size]}`;
	}
</script>

<script lang="ts">
	import CarFront from '@lucide/svelte/icons/car-front';

	interface Props {
		label: string;
		size?: SpotChipSize;
		tone?: SpotChipTone;
		/** Lifecycle color override — takes precedence over `tone` colors (tones keep their decoration). */
		status?: SpotLifecycleStatus | null;
		/** Lot hex for `assigned` (caller-resolved via getFlatColor, avatar precedent). */
		tint?: string | null;
		/** Ghost-flight measurement marker (`data-fly-*`). */
		fly?: 'src' | 'slot' | 'preview' | 'ghost' | null;
		/** Bounce-back flights mark their ghost for measurement. */
		flyBounce?: boolean;
		/** Hide the chip without collapsing layout (destination preview slot). */
		invisible?: boolean;
		/** Hide the source chip while its ghost is flying. */
		ghosted?: boolean;
		class?: string;
		style?: string;
	}

	let {
		label,
		size = 'sm',
		tone = 'muted',
		status = null,
		tint = null,
		fly = null,
		flyBounce = false,
		invisible = false,
		ghosted = false,
		class: className = '',
		style = ''
	}: Props = $props();

	// Full look from the shared resolver (single source with custom-root
	// callers): structural drag tones keep their exact look, and
	// muted/highlight/struck take the lifecycle color when `status` is known.
	const structural = $derived(tone === 'preview' || tone === 'shadow' || tone === 'ghost');
	const fullClass = $derived(spotChipFullClass(size, tone, status));
	const tintStyle = $derived(!structural ? spotStatusStyle(status, tint) : undefined);
	const mergedStyle = $derived(tintStyle ? (style ? `${tintStyle} ${style}` : tintStyle) : style || undefined);

</script>

<span
	aria-hidden="true"
	data-fly-src={fly === 'src' ? true : undefined}
	data-fly-slot={fly === 'slot' ? true : undefined}
	data-fly-preview={fly === 'preview' ? true : undefined}
	data-fly-ghost={fly === 'ghost' ? true : undefined}
	data-fly-bounce={flyBounce ? true : undefined}
	class="{fullClass}{ghosted ? ' opacity-0' : ''}{invisible
		? ' invisible'
		: ''} inline-flex items-center gap-1{className ? ` ${className}` : ''}"
	style={mergedStyle}
>
	<CarFront class={spotChipIconClass(size)} aria-hidden="true" />
	{label}
</span>
