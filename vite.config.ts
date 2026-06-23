import { createRequire } from 'node:module';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: true // listen on all interfaces so the dev server is reachable on the local network
	},
	test: {
		include: ['src/**/*.test.ts']
	}
});
