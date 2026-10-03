<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";
	import PopoverPortal from "./popover-portal.svelte";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";
	import type { ComponentProps, Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		side = "bottom",
		align = "start",
		sideOffset = 4,
		children,
		...restProps
	}: WithoutChildrenOrChild<PopoverPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof PopoverPortal>>;
		children: Snippet;
	} = $props();
</script>

<PopoverPortal {...portalProps}>
	<PopoverPrimitive.Content
		{side}
		{align}
		{sideOffset}
		{...restProps}
		onOpenAutoFocus={(e) => {
			// Never steal focus on open: on touch devices it pops the keyboard,
			// shrinks the visual viewport, and strands the popup. Focus stays on
			// the trigger; users tab/tap in deliberately.
			e.preventDefault();
			restProps.onOpenAutoFocus?.(e);
		}}
	>
		{#snippet child({ props, wrapperProps })}
			<div {...wrapperProps}>
				<div
					bind:this={ref}
					data-slot="popover-content"
					class={cn(
						"bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 z-[70] w-72 origin-(--bits-floating-transform-origin) rounded-xl border p-3 shadow-md outline-none",
						className
					)}
					{...props}
				>
					{@render children?.()}
				</div>
			</div>
		{/snippet}
	</PopoverPrimitive.Content>
</PopoverPortal>
