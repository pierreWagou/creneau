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

/** Maximum number of flats that can be created in a single bulk request */
export const MAX_FLAT_BULK_SIZE = 100;
