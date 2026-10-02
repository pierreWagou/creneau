/**
 * Shared constants used by both server and client.
 * Import from '$lib/constants' in any context.
 */

/** Minimum PIN length (digits) */
export const PIN_MIN_LENGTH = 4;

/** Maximum PIN length (digits) */
export const PIN_MAX_LENGTH = 6;

/** Maximum display name length */
export const DISPLAY_NAME_MAX_LENGTH = 50;

/** Number of months to look ahead in the calendar */
export const CALENDAR_LOOKAHEAD_MONTHS = 3;

/** Activation code TTL in milliseconds (24 hours) */
export const ACTIVATION_CODE_TTL_MS = 24 * 60 * 60 * 1000;

/** Maximum booking duration in hours (1 week) */
export const MAX_BOOKING_HOURS = 168;

/** Length of generated activation codes (characters) */
export const ACTIVATION_CODE_LENGTH = 4;

/** Milliseconds per minute */
export const MS_PER_MINUTE = 60_000;

/** Milliseconds per hour */
export const MS_PER_HOUR = 3_600_000;

/** Session duration in days */
export const SESSION_DURATION_DAYS = 30;

/** Session duration in milliseconds (derived — single source for cookie + expiry math) */
export const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * MS_PER_HOUR;

/** Failed-auth attempts allowed before lockout (login + activation) */
export const RATE_LIMIT_MAX_ATTEMPTS = 5;

/** Lockout window after too many failed auth attempts */
export const RATE_LIMIT_LOCKOUT_MS = 15 * MS_PER_MINUTE;

/** SMTP port used when SMTP_PORT is unset (also selects implicit TLS) */
export const SMTP_DEFAULT_PORT = 465;

/** Pooled SMTP connection budget */
export const SMTP_POOL_SIZE = 2;

/** SMTP connection/greeting timeout */
export const SMTP_TIMEOUT_MS = 5_000;

/** Toast duration when the toast carries an action (e.g. undo) */
export const TOAST_DURATION_MS = 5_000;

/** Debounce window for scroll/resize recomputation (sticky positioning) */
export const UI_DEBOUNCE_MS = 150;

/** Debounce window for search input before hitting the server */
export const SEARCH_DEBOUNCE_MS = 300;

/** Settle delay before moving focus after a popover closes */
export const UI_FOCUS_DELAY_MS = 50;

/** Spots shown per lot-card in the conflict resolver before overflow count */
export const CONFLICT_CHIP_CAP = 6;

/** Maximum number of emails or phones per flat */
export const MAX_CONTACTS_PER_TYPE = 5;

/** Flats per page in the admin list (server-side pagination) */
export const FLATS_PAGE_SIZE = 10;

/** Flat number format: letter A/B + 2 digits (e.g. A01, B12) */
export const FLAT_NUMBER_REGEX = /^[AB]\d{2}$/;

/** Spot number format: 1 or 2 digits (e.g. 3, 01, 36) */
export const SPOT_NUMBER_REGEX = /^\d{1,2}$/;

/** Check if a string is a valid flat number (A/B + 2 digits) */
export function isValidFlatNumber(n: string): boolean {
	return FLAT_NUMBER_REGEX.test(n.toUpperCase());
}

/** Check if a string is a valid spot number (1-2 digits) */
export function isValidSpotNumber(n: string): boolean {
	return SPOT_NUMBER_REGEX.test(n.trim());
}

/** Format spot number for display: pad single digits with leading zero */
export function formatSpotNumber(n: string): string {
	return n.trim().padStart(2, '0');
}
