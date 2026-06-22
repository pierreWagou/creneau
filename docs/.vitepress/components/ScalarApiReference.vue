<template>
	<ClientOnly>
		<div ref="container" class="scalar-container" />
	</ClientOnly>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

const container = ref(null);
let observer = null;

function isDarkMode() {
	return document.documentElement.classList.contains('dark');
}

function mount() {
	if (!container.value || !window.Scalar) return;
	window.Scalar.createApiReference(container.value, {
		url: '/openapi.yaml',
		darkMode: isDarkMode(),
		layout: 'modern',
	});
}

onMounted(() => {
	const script = document.createElement('script');
	script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
	script.onload = () => {
		mount();
		// Re-mount when VitePress toggles dark mode (.dark class on <html>)
		observer = new MutationObserver(() => mount());
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class'],
		});
	};
	document.head.appendChild(script);
});

onUnmounted(() => {
	observer?.disconnect();
});
</script>

<style>
/* Catppuccin Latte — light mode */
.light-mode {
	--scalar-color-1: #4c4f69;
	--scalar-color-2: #6c6f85;
	--scalar-color-3: #8c8fa1;
	--scalar-color-accent: #1e66f5;
	--scalar-background-1: #eff1f5;
	--scalar-background-2: #e6e9ef;
	--scalar-background-3: #ccd0da;
	--scalar-background-accent: rgb(30 102 245 / 0.08);
	--scalar-border-color: #bcc0cc;
}

/* Catppuccin Mocha — dark mode */
.dark-mode {
	--scalar-color-1: #cdd6f4;
	--scalar-color-2: #a6adc8;
	--scalar-color-3: #7f849c;
	--scalar-color-accent: #89b4fa;
	--scalar-background-1: #1e1e2e;
	--scalar-background-2: #181825;
	--scalar-background-3: #313244;
	--scalar-background-accent: rgb(137 180 250 / 0.08);
	--scalar-border-color: #45475a;
}

.scalar-container {
	margin: 0 -24px;
	min-height: 100vh;
}
</style>
