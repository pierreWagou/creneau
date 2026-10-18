<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import AvatarCircle from './detail/avatar-circle.svelte';

	export interface IdentityAvatar {
		initial?: string;
		icon?: Component;
		tint: string | null;
	}

	interface Props {
		avatar: IdentityAvatar;
		avatarSize?: 'xs' | 'sm' | 'md';
		title: string;
		subtitle?: string | null;
		subtitleSize?: 'xs' | 'sm';
		/** Centered layout (detail cells); default is left-aligned row. */
		centered?: boolean;
		trailing?: Snippet;
	}

	let {
		avatar,
		avatarSize = 'md',
		title,
		subtitle = null,
		subtitleSize = 'sm',
		centered = false,
		trailing
	}: Props = $props();
</script>

<div class="flex items-center gap-3 {centered ? 'justify-center text-center' : ''}">
	<AvatarCircle size={avatarSize} tint={avatar.tint} decorative>
		{#if avatar.icon}
			{@const Icon = avatar.icon}
			<Icon class="h-4 w-4" />
		{:else}
			{avatar.initial}
		{/if}
	</AvatarCircle>
	<span class="min-w-0 {centered ? '' : 'flex-1'}">
		<span class="block truncate text-sm font-semibold">{title}</span>
		{#if subtitle}
			<span
				class="block truncate text-muted-foreground {subtitleSize === 'xs' ? 'text-xs' : 'text-sm'}"
				>{subtitle}</span
			>
		{/if}
	</span>
	{#if trailing}
		{@render trailing()}
	{/if}
</div>
