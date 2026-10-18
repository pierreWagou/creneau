import { eq } from 'drizzle-orm';
import { MAX_CONTACTS_PER_TYPE } from '$lib/constants';
import { formatPhone } from '$lib/utils/phone';
import { isValidEmail, isValidPhone } from '$lib/validation';

import type { DbOrTx, db } from './db';
import { flatEmail, flatPhone } from './db/schema';

export function validateEmails(emails: unknown): string[] | string {
	if (!Array.isArray(emails)) return 'Les emails doivent être un tableau';
	const trimmed = [...new Set(emails.map((e) => String(e).trim()).filter((e) => e.length > 0))];
	if (trimmed.length === 0) return 'Au moins un email requis';
	if (trimmed.length > MAX_CONTACTS_PER_TYPE) {
		return `Maximum ${MAX_CONTACTS_PER_TYPE} emails autorisés`;
	}
	for (const email of trimmed) {
		if (!isValidEmail(email)) return `Email invalide : "${email}"`;
	}
	return trimmed;
}

export function validatePhones(phones: unknown): string[] | string {
	if (!Array.isArray(phones)) return 'Les téléphones doivent être un tableau';
	// Normalize (format) before dedupe + count, like emails: what is stored is what counts.
	const formatted = [
		...new Set(
			phones
				.map((p) => String(p).trim())
				.filter((p) => p.length > 0)
				.map(formatPhone)
		)
	];
	if (formatted.length === 0) return 'Au moins un téléphone requis';
	if (formatted.length > MAX_CONTACTS_PER_TYPE) {
		return `Maximum ${MAX_CONTACTS_PER_TYPE} téléphones autorisés`;
	}
	for (const phone of formatted) {
		if (!isValidPhone(phone)) return `Téléphone invalide : "${phone}"`;
	}
	return formatted;
}

export async function getFlatEmails(database: typeof db, flatNumber: string): Promise<string[]> {
	const rows = await database.select().from(flatEmail).where(eq(flatEmail.flatNumber, flatNumber));
	return rows.map((r) => r.email);
}

export async function getFlatPhones(database: typeof db, flatNumber: string): Promise<string[]> {
	const rows = await database.select().from(flatPhone).where(eq(flatPhone.flatNumber, flatNumber));
	return rows.map((r) => r.phone);
}

export async function setFlatEmails(database: DbOrTx, flatNumber: string, emails: string[]): Promise<void> {
	await database.delete(flatEmail).where(eq(flatEmail.flatNumber, flatNumber));
	if (emails.length > 0) {
		await database.insert(flatEmail).values(emails.map((email) => ({ flatNumber, email })));
	}
}

export async function setFlatPhones(database: DbOrTx, flatNumber: string, phones: string[]): Promise<void> {
	await database.delete(flatPhone).where(eq(flatPhone.flatNumber, flatNumber));
	if (phones.length > 0) {
		await database.insert(flatPhone).values(phones.map((phone) => ({ flatNumber, phone })));
	}
}

/**
 * Validate one contact list and persist it via `replace`. Returns the error
 * message when validation fails (caller answers it, e.g. `errorJson(err, 400)`),
 * else null. Returns a message instead of a Response so this module stays
 * free of handler imports (`handler.ts` already imports from here).
 */
export async function replaceValidatedContacts(
	raw: unknown,
	validate: (v: unknown) => string[] | string,
	replace: (values: string[]) => Promise<void>
): Promise<string | null> {
	const validated = validate(raw);
	if (typeof validated === 'string') return validated;
	await replace(validated);
	return null;
}
