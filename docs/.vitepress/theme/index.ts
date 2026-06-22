// https://vitepress.dev/guide/custom-theme

import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import ScalarApiReference from '../components/ScalarApiReference.vue';
import './style.css';

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component('ScalarApiReference', ScalarApiReference);
	}
} satisfies Theme;
