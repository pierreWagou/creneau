import { randomBytes, randomUUID } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { Cookies } from '@sveltejs/kit';
import { and, eq, gt } from 'drizzle-orm';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '$lib/constants';
import type { SessionFlat } from '$lib/types';
import { db } from './db';
import { flat, session } from './db/schema';

const SESSION_DURATION_DAYS = 30;

export const SESSION_COOKIE_NAME = 'session';
export const SESSION_MAX_AGE = SESSION_DURATION_DAYS * 24 * 60 * 60; // seconds
export { PIN_MAX_LENGTH, PIN_MIN_LENGTH };

/** Set the session cookie with standard options */
export function setSessionCookie(cookies: Cookies, sessionId: string): void {
	cookies.set(SESSION_COOKIE_NAME, sessionId, {
		path: '/',
		httpOnly: true,
		secure: true,
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

export function generateActivationCode(): string {
	// 4-character alphanumeric code (uppercase, no ambiguous chars like O/0, I/1)
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = randomBytes(4);
	let code = '';
	for (let i = 0; i < 4; i++) {
		code += chars[bytes[i] % chars.length];
	}
	return code;
}

export async function createSession(flatId: number): Promise<string> {
	const id = randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

	await db.insert(session).values({ id, flatId, expiresAt });
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
		.innerJoin(flat, eq(session.flatId, flat.id))
		.where(and(eq(session.id, sessionId), gt(session.expiresAt, now)))
		.get();

	if (!result) return null;

	return {
		sessionId: result.session.id,
		flat: {
			id: result.flat.id,
			number: result.flat.number,
			displayName: result.flat.displayName,
			isAdmin: result.flat.isAdmin
		}
	};
}

export async function deleteSession(sessionId: string): Promise<void> {
	await db.delete(session).where(eq(session.id, sessionId));
}
