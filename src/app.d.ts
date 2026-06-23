// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionFlat } from '$lib/types';

declare global {
	const __APP_VERSION__: string;

	namespace App {
		interface Locals {
			flat?: SessionFlat;
		}
	}
}
