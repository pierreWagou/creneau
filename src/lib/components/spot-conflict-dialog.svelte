<script lang="ts">
import Ban from '@lucide/svelte/icons/ban';
import CarFront from '@lucide/svelte/icons/car-front';
import LoaderCircle from '@lucide/svelte/icons/loader-circle';
import MoveRight from '@lucide/svelte/icons/move-right';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import { toast } from 'svelte-sonner';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import type { DescribedSpotConflict } from '$lib/utils/spots';

	export interface ConflictChoice {
		spotNumber: string;
		action: 'reassign' | 'keep';
	}

	/** Lot directory feeding the mini lot-cards: holder lots, pool, and receiving lot */
	export interface ConflictAtlas {
		/** holder lot number → its current spot numbers (pool excluded) */
		holders: Record<string, string[]>;
		/** shared-pool spot numbers */
		pool: string[];
		/** receiving lot: display label + its current draft spots */
		target: { label: string; spots: string[] };
	}

	interface Props {
		open: boolean;
		title: string;
		subtitle: string;
		conflicts: DescribedSpotConflict[];
		atlas: ConflictAtlas;
		applying?: boolean;
		/** Pre-checked picks (staged choices restored on reopen); default = blank */
		initialPicks?: Record<string, 'keep' | 'reassign'>;
		/** Batch apply: reassign = force-include, keep = drop from the pending operation */
		onApply: (choices: ConflictChoice[]) => void;
		onClose: () => void;
	}

	let {
		open,
		title,
		subtitle,
		conflicts,
		atlas,
		applying = false,
		initialPicks = {},
		onApply,
		onClose
	}: Props = $props();

	let picks = $state<Record<string, 'keep' | 'reassign'>>({});
	let wasOpen = $state(false);
	$effect(() => {
		// Restore staged picks on open; identity churn of initialPicks must not reset mid-dialog
		if (open && !wasOpen) picks = { ...initialPicks };
		wasOpen = open;
	});
	$effect(() => {
		// Single-viable-option rows (strand-blocked: Réaffecter disabled) auto-select
		// Garder — the counter counts picks only, so the visible state stays truthful.
		for (const c of conflicts) {
			if (c.blocked && picks[c.spotNumber] !== 'keep') {
				picks[c.spotNumber] = 'keep';
			}
		}
	});

	const pickedCount = $derived(conflicts.filter((c) => picks[c.spotNumber]).length);
	const complete = $derived(conflicts.length > 0 && pickedCount === conflicts.length);

	function cardClass(selected: boolean, disabled: boolean, vertical = false): string {
		const base = 'flex cursor-pointer rounded-lg border p-2.5 text-left transition-colors';
		const layout = vertical ? 'min-w-0 flex-1 flex-col items-stretch gap-2' : 'items-center gap-2';
		if (disabled) return `${base} ${layout} cursor-not-allowed border-border opacity-70`;
		if (selected) return `${base} ${layout} border-primary bg-primary/5 hover:border-primary`;
		return `${base} ${layout} border-border hover:border-foreground/30 hover:bg-muted/50`;
	}

	/** Display label for a lot-ish endpoint: bare numbers get their Lot prefix */
	function lotLabel(label: string): string {
		const t = label.trim();
		return /^[A-Z]?\d+$/i.test(t) ? `Lot ${t}` : t;
	}

	/** Shown chips with overflow cap (pool/holder lists can be long) */
	function capped(spots: string[]): { shown: string[]; extra: number } {
		return { shown: spots.slice(0, 6), extra: Math.max(0, spots.length - 6) };
	}

	function apply() {
		if (!complete || applying) return;
		onApply(
			conflicts.map((c) => ({
				spotNumber: c.spotNumber,
				action: c.blocked ? 'keep' : (picks[c.spotNumber] ?? 'keep')
			}))
		);
	}

	/**
	 * Spot flight, three modes: on a user pick, a ghost chip travels between the
	 * source contested chip and the destination. Forward (Prendre): source chip →
	 * dest chips container (the preview chip doesn't exist yet at measure time).
	 * Back (Laisser): preview chip → source chip (measured before Svelte flushes
	 * the pick change, so the preview is still in the DOM). Bounce (blocked dest
	 * click): the ghost's right edge kisses the home card's inner border and
	 * springs back — the attempt is visibly rejected, picks stay untouched.
	 * Programmatic pick sets never trigger it — only user gestures do.
	 * Skipped under reduced-motion.
	 */
	function playSpotFlight(input: HTMLElement, back = false, bounce = false) {
		if (typeof window === 'undefined') return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const strip = input.closest('fieldset')?.querySelector('[data-fly-strip]');
		const src = strip?.querySelector('[data-fly-src]');
		const dst = strip?.querySelector('[data-fly-dst]');
		if (
			!(strip instanceof HTMLElement) ||
			!(src instanceof HTMLElement) ||
			!(dst instanceof HTMLElement)
		)
			return;
		const preview = back ? strip.querySelector('[data-fly-preview]') : null;
		const home = bounce ? strip.querySelector('[data-fly-home]') : null;
		const fromEl = preview instanceof HTMLElement ? preview : back ? dst : src;
		const toEl = back ? src : dst;
		const f = fromEl.getBoundingClientRect();
		const d = toEl.getBoundingClientRect();
		const st = strip.getBoundingClientRect();
		// Bounce: the ghost's right edge kisses 2px inside the home card's
		// border — the spot tries to leave and springs off its own wall.
		// (LTR assumed; the app is French LTR.)
		let dx: number;
		if (bounce && home instanceof HTMLElement) {
			const wall = home.getBoundingClientRect();
			dx = wall.right - 2 - f.width / 2 - (f.left + f.width / 2);
		} else {
			dx = d.left + d.width / 2 - (f.left + f.width / 2);
		}
		if (Math.abs(dx) < 4) return;
		const ghost = document.createElement('span');
		ghost.textContent = fromEl.textContent;
		ghost.setAttribute('aria-hidden', 'true');
		ghost.className =
			'pointer-events-none absolute z-10 rounded border border-primary/60 bg-background px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-md';
		ghost.style.left = `${f.left - st.left}px`;
		ghost.style.top = `${f.top - st.top}px`;
		ghost.style.width = `${f.width}px`;
		ghost.style.textAlign = 'center';
		strip.appendChild(ghost);
		ghost.animate(
			bounce
				? [
						{ transform: 'translateX(0px)', opacity: 1 },
						{ transform: `translateX(${dx}px)`, opacity: 1, offset: 0.45 },
						{ transform: 'translateX(0px)', opacity: 1 }
					]
				: [
						{ transform: 'translateX(0px)', opacity: 1 },
						{ transform: `translateX(${dx * 0.9}px)`, opacity: 1, offset: 0.7 },
						{ transform: `translateX(${dx}px)`, opacity: 0 }
					],
			{ duration: bounce ? 750 : 450, easing: 'ease-in-out' }
		).onfinish = () => ghost.remove();
	}
</script>

<AlertDialog.Root {open} onOpenChange={(o) => { if (!o) onClose(); }}>
	<AlertDialog.Content class="data-[size=default]:max-w-md data-[size=default]:sm:max-w-lg sm:p-6">
		<AlertDialog.Header class="place-items-start text-left w-full">
			<div class="flex items-center gap-3">
				<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-warning/20 bg-warning/10 text-warning">
					<TriangleAlert class="h-6 w-6" />
				</div>
				<div class="min-w-0">
					<AlertDialog.Title>{title}</AlertDialog.Title>
					<AlertDialog.Description class="text-left text-wrap">{subtitle}</AlertDialog.Description>
				</div>
			</div>
		</AlertDialog.Header>
		<div class="space-y-3">
		{#each conflicts as c (c.spotNumber)}
			{@const isPool = c.kind === 'shared-pool'}
			{@const keepPicked = picks[c.spotNumber] === 'keep'}
			{@const takePicked = picks[c.spotNumber] === 'reassign'}
			{@const srcSpots = isPool ? atlas.pool : (atlas.holders[c.currentFlat] ?? [])}
			{@const srcShown = capped(srcSpots)}
			{@const dstBase = atlas.target.spots.filter((n) => n !== c.spotNumber)}
			{@const dstShown = capped(dstBase)}
			<fieldset class="rounded-lg border p-3">
				<legend class="sr-only">Résolution pour la place {c.spotNumber}</legend>
				<div class="flex items-center gap-2 text-sm">
					<CarFront class="h-4 w-4 shrink-0 text-muted-foreground" />
					<span class="font-semibold">Place {c.spotNumber}</span>
				</div>
				<div
					class="relative mt-2 flex items-stretch gap-1.5"
					role="radiogroup"
					aria-label="Résolution pour la place {c.spotNumber}"
					data-fly-strip
				>
					<label class={cardClass(keepPicked, false, true)} data-fly-home>
							<input
								type="radio"
								name="conflict-{c.spotNumber}"
								value="keep"
								class="sr-only"
								checked={keepPicked}
								disabled={applying}
								onchange={(e) => {
									playSpotFlight(e.currentTarget, true);
									picks[c.spotNumber] = 'keep';
								}}
							/>
						<span class="flex items-center gap-1.5 text-sm">
							<span class="font-semibold">{isPool ? 'Pool commun' : `Lot ${c.currentFlat}`}</span>
						</span>
						<span class="flex flex-wrap gap-1" aria-hidden="true">
							{#each srcShown.shown as n (n)}
								<span
									data-fly-src={n === c.spotNumber ? true : undefined}
									class="rounded border px-1.5 py-0.5 text-xs font-semibold {n === c.spotNumber
										? `border-primary/50 bg-primary/5 ${takePicked ? 'opacity-60 line-through' : ''}`
										: 'border-border text-muted-foreground'}"
									>{n}</span
								>
							{/each}
							{#if srcShown.extra > 0}
								<span class="px-1 py-0.5 text-xs text-muted-foreground">+{srcShown.extra}</span>
							{/if}
						</span>
						<span class="text-xs text-muted-foreground">Conserver</span>
					</label>
					<span class="flex flex-col items-center justify-center" aria-hidden="true">
						{#if c.blocked}
							<Ban class="h-4 w-4 shrink-0 text-warning" />
						{:else}
							<MoveRight class="h-4 w-4 shrink-0 text-muted-foreground" />
						{/if}
					</span>
					{#if c.blocked}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions: bounce flight is pointer-only delight feedback on an aria-disabled card; state is fully exposed via the auto-selected keep option, counter, tooltip, and sr-only text -->
						<div
							class={cardClass(false, true, true)}
							aria-disabled="true"
							title="Impossible : le lot {c.currentFlat} n'aurait plus de place"
							onclick={(e) => {
								playSpotFlight(e.currentTarget, false, true);
								toast.warning(
									`Affectation impossible : le lot ${c.currentFlat} doit conserver au moins une place. Ajoutez-lui une autre place, ou supprimez le lot.`,
									{ id: `strand-blocked-${c.spotNumber}` }
								);
							}}
						>
							<span class="flex items-center gap-1.5 text-sm">
								<span class="font-semibold text-muted-foreground">{lotLabel(atlas.target.label)}</span>
							</span>
							<span class="sr-only">Impossible : le lot {c.currentFlat} n'aurait plus de place</span>
							<span class="flex flex-wrap gap-1" aria-hidden="true" data-fly-dst>
								{#each dstShown.shown as n (n)}
									<span class="rounded border border-border px-1.5 py-0.5 text-xs font-semibold text-muted-foreground"
										>{n}</span
									>
								{/each}
								{#if dstShown.extra > 0}
									<span class="px-1 py-0.5 text-xs text-muted-foreground">+{dstShown.extra}</span>
								{/if}
							</span>
							<span class="text-xs text-muted-foreground">Affecter</span>
						</div>
					{:else}
						<label class={cardClass(takePicked, false, true)}>
							<input
								type="radio"
								name="conflict-{c.spotNumber}"
								value="reassign"
								class="sr-only"
								checked={takePicked}
								disabled={applying}
								onchange={(e) => {
									picks[c.spotNumber] = 'reassign';
									playSpotFlight(e.currentTarget);
								}}
							/>
							<span class="flex items-center gap-1.5 text-sm">
								<span class="font-semibold">{lotLabel(atlas.target.label)}</span>
							</span>
							<span class="flex flex-wrap gap-1" aria-hidden="true" data-fly-dst>
								{#each dstShown.shown as n (n)}
									<span class="rounded border border-border px-1.5 py-0.5 text-xs font-semibold text-muted-foreground"
										>{n}</span
									>
								{/each}
								{#if takePicked}
									<span
										data-fly-preview
										class="rounded border border-dashed border-primary/60 px-1.5 py-0.5 text-xs font-semibold text-primary"
										>{c.spotNumber}</span
									>
								{/if}
								{#if dstShown.extra > 0}
									<span class="px-1 py-0.5 text-xs text-muted-foreground">+{dstShown.extra}</span>
								{/if}
							</span>
							<span class="text-xs text-muted-foreground">Affecter</span>
						</label>
					{/if}
				</div>
			</fieldset>
		{/each}
		</div>
		<AlertDialog.Footer class="bg-transparent border-t-0">
			<AlertDialog.Cancel disabled={applying}>Annuler</AlertDialog.Cancel>
			<Button variant="default" disabled={!complete || applying} onclick={apply}>
				{#if applying}
					<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
				{:else}
					Appliquer ({pickedCount}/{conflicts.length})
				{/if}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
