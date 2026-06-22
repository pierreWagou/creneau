import { defineConfig } from 'vitepress';

export default defineConfig({
	title: 'Créneau',
	description: 'Shared parking spot booking app for apartment buildings',
	base: process.env.VITEPRESS_BASE ?? '/',
	vite: {
		server: { port: 5175 }
	},
	themeConfig: {
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'API Reference', link: '/api' }
		],
		socialLinks: [{ icon: 'github', link: 'https://github.com/pierreWagou/creneau' }],
		footer: {
			message: 'Released under the MIT License.',
			copyright: 'Copyright © 2026 Pierre Romon'
		}
	},
	head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${process.env.VITEPRESS_BASE ?? '/'}favicon.svg` }]]
});
