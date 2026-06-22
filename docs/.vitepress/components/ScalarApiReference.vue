<template>
	<ClientOnly>
		<div ref="container" class="scalar-container">
			<p v-if="loadError" class="scalar-error">
				Failed to load API reference. Please check your network connection.
			</p>
		</div>
	</ClientOnly>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

const container = ref(null);
const loadError = ref(false);
let scalarInstance = null;
let observer = null;

function isDarkMode() {
	return document.documentElement.classList.contains('dark');
}

function mount() {
	if (!container.value || !window.Scalar) return;
	// Destroy previous instance before re-mounting to avoid DOM leaks
	if (scalarInstance?.destroy) {
		scalarInstance.destroy();
		scalarInstance = null;
	}
	scalarInstance = window.Scalar.createApiReference(container.value, {
		url: `${import.meta.env.BASE_URL}openapi.yaml`,
		darkMode: isDarkMode(),
		layout: 'modern',
	});
}

onMounted(() => {
	const script = document.createElement('script');
	script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.61.0/dist/browser/standalone.js';
	script.onload = () => {
		mount();
		// Re-mount when VitePress toggles dark mode (.dark class on <html>)
		observer = new MutationObserver(() => mount());
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class'],
		});
	};
	script.onerror = () => {
		loadError.value = true;
	};
	document.head.appendChild(script);
});

onUnmounted(() => {
	observer?.disconnect();
	if (scalarInstance?.destroy) scalarInstance.destroy();
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

.scalar-error {
	padding: 2rem;
	text-align: center;
	color: var(--vp-c-text-2);
}
</style>
