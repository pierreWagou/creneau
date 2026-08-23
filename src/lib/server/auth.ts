import { randomBytes, randomUUID } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { Cookies } from '@sveltejs/kit';
import { and, eq, gt } from 'drizzle-orm';
import { ACTIVATION_CODE_LENGTH, PIN_MAX_LENGTH, PIN_MIN_LENGTH, SESSION_DURATION_DAYS } from '$lib/constants';
import type { SessionFlat } from '$lib/types';
import { db } from './db';
import { flat, flatEmail, flatPhone, session } from './db/schema';

export const SESSION_COOKIE_NAME = 'session';
const SESSION_MAX_AGE = SESSION_DURATION_DAYS * 24 * 60 * 60; // seconds

/** Set the session cookie with standard options */
export function setSessionCookie(cookies: Cookies, sessionId: string): void {
	cookies.set(SESSION_COOKIE_NAME, sessionId, {
		path: '/',
		httpOnly: true,
		secure: import.meta.env.PROD,
		sameSite: 'lax',
		maxAge: SESSION_MAX_AGE
	});
}

export async function hashPin(pin: string): Promise<string> {
	return await hash(pin);
}

export async function verifyPin(pin: string, hashedPin: string): Promise<boolean> {
	return await verify(hashedPin, pin);
}

/**
 * Validate a PIN string. Returns an error message if invalid, or null if valid.
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

export function generateActivationCode(): string {
	// Alphanumeric code (uppercase, no ambiguous chars like O/0, I/1)
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = randomBytes(ACTIVATION_CODE_LENGTH);
	let code = '';
	for (let i = 0; i < ACTIVATION_CODE_LENGTH; i++) {
		code += chars[bytes[i] % chars.length];
	}
	return code;
}

export async function createSession(flatNumber: string): Promise<string> {
	const id = randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

	await db.insert(session).values({ id, flatNumber, expiresAt });
	return id;
}

export async function validateSession(sessionId: string): Promise<{ sessionId: string; flat: SessionFlat } | null> {
	const now = new Date().toISOString();

	const result = await db
		.select({
			session: session,
			flat: flat
		})
		.from(session)
		.innerJoin(flat, eq(session.flatNumber, flat.number))
		.where(and(eq(session.id, sessionId), gt(session.expiresAt, now)))
		.get();

	if (!result) return null;

	const [emails, phones] = await Promise.all([
		db.select().from(flatEmail).where(eq(flatEmail.flatNumber, result.flat.number)),
		db.select().from(flatPhone).where(eq(flatPhone.flatNumber, result.flat.number))
	]);

	return {
		sessionId: result.session.id,
		flat: {
			number: result.flat.number,
			displayName: result.flat.displayName,
			isAdmin: result.flat.isAdmin,
			emails: emails.map((r) => r.email),
			phones: phones.map((r) => r.phone)
		}
	};
}

export async function deleteSession(sessionId: string): Promise<void> {
	await db.delete(session).where(eq(session.id, sessionId));
}
