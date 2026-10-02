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
	const raw = phones.map((p) => String(p).trim()).filter((p) => p.length > 0);
	if (raw.length === 0) return 'Au moins un téléphone requis';
	if (raw.length > MAX_CONTACTS_PER_TYPE) {
		return `Maximum ${MAX_CONTACTS_PER_TYPE} téléphones autorisés`;
	}
	const formatted = [...new Set(raw.map(formatPhone))];
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
