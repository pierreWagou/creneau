import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser
			}
		},
		rules: {
			// Svelte reactive statements trigger this falsely
			'@typescript-eslint/no-unused-expressions': 'off'
		}
	},
	{
		rules: {
			// Allow unused vars prefixed with _
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			// Allow explicit any (warn only)
			'@typescript-eslint/no-explicit-any': 'warn',
			// Don't enforce resolve() for navigation (not using base path or i18n)
			'svelte/no-navigation-without-resolve': 'off',
			// Don't require keys on each blocks (not all lists need them)
			'svelte/require-each-key': 'off',
			// Don't force SvelteURLSearchParams (overkill for non-reactive URL building)
			'svelte/prefer-svelte-reactivity': 'off'
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'node_modules/', 'drizzle/', 'data/']
	}
);
