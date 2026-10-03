import { and, eq, isNotNull } from 'drizzle-orm';
import { ACTIVATION_CODE_TTL_MS } from '$lib/constants';
import { generateActivationCode } from './auth';
import { db } from './db';
import { flat } from './db/schema';
import type { FlatMachineEvent } from './flat-machine';
import { machineCan } from './flat-machine';

/**
 * Stored flat lifecycle: inactive → pending → active.
 * `expired` is intentionally NOT a flat status — it is an invitation sub-state
 * derived from the code expiry timestamp at read time (see isInvitationExpired).
 * Invariant: pending ⟺ activation code present. No invitation ⟹ inactive.
 */
export type FlatStatus = 'inactive' | 'pending' | 'active';

export type FlatEvent = 'invite' | 'revoke' | 'consume';

const TO_MACHINE_EVENT: Record<FlatEvent, FlatMachineEvent> = {
	invite: 'INVITE',
	revoke: 'REVOKE',
	consume: 'CONSUME'
};

/**
 * Legality check delegating to the XState machine (single source of truth).
 * `hasCode` defaults to false to preserve the two-arg call shape.
 */
export function canTransition(from: string, event: FlatEvent, opts?: { hasCode?: boolean }): boolean {
	if (!['inactive', 'pending', 'active'].includes(from)) return false;
	return machineCan(from as FlatStatus, TO_MACHINE_EVENT[event], { hasCode: opts?.hasCode ?? false });
}

/** Null expiry means no TTL (legacy rows) — treated as still valid, mirroring readers. */
export function isInvitationExpired(expiresAt: string | null): boolean {
	if (!expiresAt) return false;
	return new Date(expiresAt).getTime() < Date.now();
}

/**
 * reap — system-initiated revoke-equivalent for dead invitations (no user event fires at TTL
 * elapse, so expiry is enforced lazily wherever a dead invitation can be observed). Flips every
 * `pending` flat holding an expired code back to `inactive` and clears the code columns
 * (no invitation ⟹ inactive). Returns the reaped flat numbers.
 */
export async function reapExpiredInvitations(): Promise<string[]> {
	const candidates = await db
		.select({ number: flat.number, status: flat.status, activationCodeExpiresAt: flat.activationCodeExpiresAt })
		.from(flat)
		.where(and(eq(flat.status, 'pending'), isNotNull(flat.activationCode)))
		.all();
	const reaped: string[] = [];
	for (const row of candidates) {
		if (!isInvitationExpired(row.activationCodeExpiresAt)) continue;
		if (!canTransition(row.status, 'revoke', { hasCode: true })) continue;
		await db
			.update(flat)
			.set({ status: 'inactive', activationCode: null, activationCodeExpiresAt: null })
			.where(eq(flat.number, row.number));
		reaped.push(row.number);
	}
	return reaped;
}

export class FlatTransitionError extends Error {
	statusCode: number;
	constructor(message: string, statusCode = 409) {
		super(message);
		this.statusCode = statusCode;
	}
}

type FlatRow = typeof flat.$inferSelect;

async function getFlatOrThrow(number: string): Promise<FlatRow> {
	const row = await db.select().from(flat).where(eq(flat.number, number)).get();
	if (!row) {
		throw new FlatTransitionError('Lot introuvable', 404);
	}
	return row;
}

async function freshRow(number: string): Promise<FlatRow> {
	const row = await db.select().from(flat).where(eq(flat.number, number)).get();
	if (!row) {
		throw new FlatTransitionError('Lot introuvable', 404);
	}
	return row;
}

/**
 * invite — generate (inactive → pending) or regenerate-refresh (pending → pending).
 * Sets a fresh code + expiry in both cases.
 */
export async function inviteFlat(number: string): Promise<FlatRow> {
	const existing = await getFlatOrThrow(number);
	if (!canTransition(existing.status, 'invite')) {
		throw new FlatTransitionError('Ce lot est déjà activé', 409);
	}
	const activationCode = generateActivationCode();
	const activationCodeExpiresAt = new Date(Date.now() + ACTIVATION_CODE_TTL_MS).toISOString();
	await db
		.update(flat)
		.set({ status: 'pending', activationCode, activationCodeExpiresAt })
		.where(eq(flat.number, number));
	return freshRow(number);
}

/**
 * revoke — pending → inactive. Clears the code columns (no invitation ⟹ inactive).
 */
export async function revokeFlatInvite(number: string): Promise<FlatRow> {
	const existing = await getFlatOrThrow(number);
	if (!existing.activationCode) {
		throw new FlatTransitionError("Aucun code d'activation à révoquer", 400);
	}
	if (!canTransition(existing.status, 'revoke', { hasCode: true })) {
		throw new FlatTransitionError("Ce lien d'invitation n'est plus valide", 409);
	}
	await db
		.update(flat)
		.set({ status: 'inactive', activationCode: null, activationCodeExpiresAt: null })
		.where(eq(flat.number, number));
	return freshRow(number);
}

/**
 * consume — pending → active (activation). Clears the code, records identity.
 * Code-match and expiry checks stay in the endpoint (anti-enumeration + TTL messaging).
 */
export async function consumeFlatInvite(
	number: string,
	fields: { displayName: string | null; pinHash: string }
): Promise<FlatRow> {
	const existing = await getFlatOrThrow(number);
	if (!canTransition(existing.status, 'consume', { hasCode: !!existing.activationCode })) {
		throw new FlatTransitionError("Ce lien d'invitation n'est plus valide", 409);
	}
	await db
		.update(flat)
		.set({
			status: 'active',
			displayName: fields.displayName,
			pinHash: fields.pinHash,
			activatedAt: new Date().toISOString(),
			activationCode: null,
			activationCodeExpiresAt: null
		})
		.where(eq(flat.number, number));
	return freshRow(number);
}
