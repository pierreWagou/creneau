// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionFlat } from '$lib/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			flat?: SessionFlat;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
