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

/** Milliseconds per hour */
export const MS_PER_HOUR = 3_600_000;

/** Session duration in days */
export const SESSION_DURATION_DAYS = 30;

/** Maximum number of emails or phones per flat */
export const MAX_CONTACTS_PER_TYPE = 5;

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
