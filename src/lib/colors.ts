// Catppuccin Latte — Light theme
export const latte = {
	base: '#eff1f5',
	mantle: '#e6e9ef',
	surface0: '#ccd0da',
	surface1: '#bcc0cc',
	text: '#4c4f69',
	heading: '#1e1e2e',
	subtext0: '#6c6f85',
	blue: '#1e66f5',
	white: '#ffffff',
	footerBg: '#f8f9fb',
	overlay0: '#9ca0b0'
} as const;

// Catppuccin Mocha — Dark theme
export const mocha = {
	base: '#1e1e2e',
	mantle: '#181825',
	surface0: '#313244',
	surface1: '#45475a',
	text: '#cdd6f4',
	subtext0: '#a6adc8',
	blue: '#89b4fa',
	overlay0: '#6c7086'
} as const;

// Flat identity colors for booking slots (no blue/orange — reserved for primary/accent)
export const FLAT_COLORS_LIGHT = [
	'#8839ef', // mauve
	'#179299', // teal
	'#e64553', // maroon
	'#ea76cb', // pink
	'#40a02b', // green
	'#df8e1d', // yellow
	'#7287fd', // lavender
	'#d20f39' // red
] as const;

export const FLAT_COLORS_DARK = [
	'#cba6f7', // mauve
	'#94e2d5', // teal
	'#eba0ac', // maroon
	'#f5c2e7', // pink
	'#a6e3a1', // green
	'#f9e2af', // yellow
	'#b4befe', // lavender
	'#f38ba8' // red
] as const;

/**
 * The flat color: deterministic per flat number (same input → same color, both themes).
 * Single choke point for flat identity color — when flats gain a selectable color,
 * resolution becomes `flat.color ?? hash(flatNumber)` here without touching call sites.
 */
export function getFlatColor(flatNumber: string, isDark: boolean): string {
	const colors = isDark ? FLAT_COLORS_DARK : FLAT_COLORS_LIGHT;
	let hash = 0;
	for (let i = 0; i < flatNumber.length; i++) {
		hash = flatNumber.charCodeAt(i) + ((hash << 5) - hash);
	}
	return colors[Math.abs(hash) % colors.length];
}
