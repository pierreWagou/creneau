<script lang="ts">
	import { onMount } from 'svelte';

	let { value, size = 256 }: { value: string; size?: number } = $props();

	let svgContent = $state('');

	const logoSizePct = 0.2;

	onMount(async () => {
		// Dynamic import to ensure browser-compatible bundle
		const QRCode = await import('qrcode');

		const qrSvg = await QRCode.toString(value, {
			type: 'svg',
			errorCorrectionLevel: 'H',
			margin: 1,
			width: size,
			color: {
				dark: '#000000',
				light: '#ffffff'
			}
		});

		// Calculate logo dimensions
		const logoSize = Math.round(size * logoSizePct);
		const logoX = Math.round((size - logoSize) / 2);
		const logoY = Math.round((size - logoSize) / 2);
		const logoRadius = Math.round((logoSize * 6) / 32);

		// White background circle to clear QR modules behind logo
		const clearBg = `<rect x="${logoX - 4}" y="${logoY - 4}" width="${logoSize + 8}" height="${logoSize + 8}" rx="${logoRadius + 2}" fill="#ffffff" />`;

		// Logo: blue rounded square with white "C" (same as favicon, scaled)
		const logoRect = `<rect x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" rx="${logoRadius}" fill="#1e66f5" />`;

		// Simplified "C" as a text element centered in the logo
		const fontSize = Math.round(logoSize * 0.6);
		const textX = logoX + logoSize / 2;
		const textY = logoY + logoSize / 2;
		const logoText = `<text x="${textX}" y="${textY}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-weight="700" font-size="${fontSize}" fill="#ffffff">C</text>`;

		const logoSvg = `${clearBg}${logoRect}${logoText}`;

		svgContent = qrSvg.replace('</svg>', `${logoSvg}</svg>`);
	});
</script>

{#if svgContent}
	<div class="inline-block" style="width:{size}px;height:{size}px">
		{@html svgContent}
	</div>
{/if}
