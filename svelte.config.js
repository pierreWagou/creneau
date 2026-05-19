import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
		warningFilter: (warning) => !warning.code.startsWith('state_referenced_locally')
	},
	kit: {
		adapter: adapter()
	}
};

export default config;
