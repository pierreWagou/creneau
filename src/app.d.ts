// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionFlat } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			flat?: SessionFlat;
		}
	}
}
