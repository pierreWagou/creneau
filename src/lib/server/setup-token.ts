import { randomBytes } from 'node:crypto';

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

let setupToken: { value: string; expiresAt: number } | null = null;

/**
 * Generate a new setup token with a 15-minute TTL.
 * Replaces any existing token.
 */
export function generateSetupToken(): string {
	const value = randomBytes(24).toString('base64url');
	setupToken = { value, expiresAt: Date.now() + TOKEN_TTL_MS };
	return value;
}

/**
 * Validate a setup token. Returns true if the token matches and hasn't expired.
 * Does NOT consume the token — it's consumed when the setup is completed.
 */
export function validateSetupToken(token: string): boolean {
	if (!setupToken) return false;
	if (Date.now() > setupToken.expiresAt) {
		setupToken = null;
		return false;
	}
	return setupToken.value === token;
}

/**
 * Invalidate the current setup token (called after successful setup).
 */
export function consumeSetupToken(): void {
	setupToken = null;
}
