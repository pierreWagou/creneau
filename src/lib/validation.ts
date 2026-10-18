/**
 * Shared format validators (client-safe, no server dependencies).
 * Import from '$lib/validation' in any context.
 * Server-side contact validation in '$lib/server/contacts' builds on these.
 */
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from './constants';

/** Basic e-mail shape check */
export function isValidEmail(v: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Phone characters check — digits, spaces, dashes, plus, parentheses */
export function isValidPhone(v: string): boolean {
	return /^[\d\s\-+()]+$/.test(v);
}

/**
 * PIN shape check — returns the French error message, or null when valid.
 * Pure and client-safe: the single implementation for both sides.
 */
export function validatePin(pin: string): string | null {
	if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
		return `Le PIN doit contenir ${PIN_MIN_LENGTH} à ${PIN_MAX_LENGTH} chiffres`;
	}
	if (!/^\d+$/.test(pin)) {
		return 'Le PIN ne doit contenir que des chiffres';
	}
	return null;
}

/** Canonical flat/lot key: trimmed + uppercased (natural keys are case-insensitive) */
export function normalizeFlatNumber(v: string): string {
	return v.trim().toUpperCase();
}

/**
 * Normalize a stored phone number to wa.me digits (country code included,
 * no `+`). French `0X…` national format becomes `33X…`; already-international
 * digit strings pass through. Returns null when no country can be determined.
 */
export function toWhatsAppNumber(phone: string): string | null {
	const digits = phone.replace(/\D/g, '');
	if (digits.length === 0) return null;
	if (digits.startsWith('0')) {
		return digits.length === 10 ? `33${digits.slice(1)}` : null;
	}
	return digits.length >= 10 && digits.length <= 15 ? digits : null;
}
