/**
 * Shared format validators (client-safe, no server dependencies).
 * Import from '$lib/validation' in any context.
 * Server-side contact validation in '$lib/server/contacts' builds on these.
 */

/** Basic e-mail shape check */
export function isValidEmail(v: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Phone characters check — digits, spaces, dashes, plus, parentheses */
export function isValidPhone(v: string): boolean {
	return /^[\d\s\-+()]+$/.test(v);
}
