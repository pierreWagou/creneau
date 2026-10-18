import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';
import { ACTIVATE_PATH, DEFAULT_SENDER, SMTP_DEFAULT_PORT, SMTP_POOL_SIZE, SMTP_TIMEOUT_MS } from '$lib/constants';
import { formatBookingEndFr, formatCompactDateTimeFr } from '$lib/utils/time';
import { isValidEmail } from '$lib/validation';
import { getFlatEmails } from '../contacts';
import type { db } from '../db';
import { bookingUid, buildICS, type CalendarEvent } from '../ics';
import { buildActivationEmail } from './activation';
import { LOGO_PNG_B64 } from './assets/logo-b64';
import { buildBookingCancelledEmail, buildBookingConfirmationEmail, buildBookingMovedEmail } from './bookings';
import { buildLotDeletedEmail } from './lots';
import { buildRejectionEmail } from './requests';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
	if (transporter) return transporter;
	// Read at call time: dynamic env resolves in the running container,
	// so one image serves preview and production with different SMTP settings.
	const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_PORT } = env;
	if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
		console.warn(
			'[mail] SMTP not configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASSWORD). Emails will not be sent.'
		);
		return null;
	}
	const rawPort = Number(SMTP_PORT);
	const port = Number.isInteger(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : SMTP_DEFAULT_PORT;
	if (SMTP_PORT && port !== rawPort) {
		console.warn(`[mail] Invalid SMTP_PORT "${SMTP_PORT}", falling back to ${SMTP_DEFAULT_PORT}.`);
	}
	transporter = nodemailer.createTransport({
		host: SMTP_HOST,
		port,
		secure: port === SMTP_DEFAULT_PORT,
		pool: true,
		maxConnections: SMTP_POOL_SIZE,
		connectionTimeout: SMTP_TIMEOUT_MS,
		greetingTimeout: SMTP_TIMEOUT_MS,
		auth: {
			user: SMTP_USER,
			pass: SMTP_PASSWORD
		}
	});
	return transporter;
}

interface MailAttachment {
	filename: string;
	content: string;
	contentType: string;
	encoding?: string;
	contentDisposition?: 'inline' | 'attachment';
	cid?: string;
}

/** Header badge attached inline to every mail (referenced as `cid:creneau-logo`). */
function logoAttachment(): MailAttachment {
	return {
		filename: 'logo.png',
		content: LOGO_PNG_B64,
		contentType: 'image/png',
		encoding: 'base64',
		contentDisposition: 'inline',
		// Nodemailer maps 'cid' → the Content-ID header; any other field name
		// ships the part headerless and cid: references resolve to nothing.
		cid: 'creneau-logo'
	};
}

/**
 * Catch-all redirect resolution (pure — env read stays in `deliver()` so this
 * is trivially unit-testable). When `SMTP_REDIRECT_ALL_TO` is set (preview
 * only — production must never set it), every recipient is swapped for the
 * redirect address and the originals are preserved in `X-Original-To` plus a
 * `[Preview]` subject tag. Unset → identity (production path untouched).
 */
export interface RedirectResolution {
	to: string[];
	headers: Record<string, string>;
	subjectTag: string | null;
}

export function resolveRedirect(to: string[], redirectTo?: string): RedirectResolution {
	if (!redirectTo || to.length === 0) return { to, headers: {}, subjectTag: null };
	if (!isValidEmail(redirectTo)) {
		console.warn(`[mail] Invalid SMTP_REDIRECT_ALL_TO "${redirectTo}", redirecting anyway.`);
	}
	console.warn(`[mail] Redirecting ${to.length} recipient(s) to ${redirectTo} (catch-all guard active).`);
	return {
		to: [redirectTo],
		headers: { 'X-Original-To': to.join(', ') },
		subjectTag: '[Preview]'
	};
}

/**
 * Single-transaction delivery core: resolves `false` (never throws) when
 * SMTP is unconfigured, there is nobody to write to, or the send fails.
 * A failed send resets the cached transporter so the next call retries.
 */
async function deliver(
	to: string[],
	subject: string,
	text: string,
	html: string,
	attachments: MailAttachment[] = []
): Promise<boolean> {
	const transport = getTransporter();
	if (!transport || to.length === 0) {
		if (to.length === 0) console.warn('[mail] No recipients, skipping email.');
		return false;
	}
	const resolved = resolveRedirect(to, env.SMTP_REDIRECT_ALL_TO);
	try {
		await transport.sendMail({
			from: env.SMTP_FROM || DEFAULT_SENDER,
			to: resolved.to.join(', '),
			subject: resolved.subjectTag ? `${resolved.subjectTag} ${subject}` : subject,
			text,
			html,
			headers: resolved.headers,
			attachments: [...attachments, logoAttachment()]
		});
		return true;
	} catch (e) {
		console.error('[mail] Failed to send email:', e);
		transporter = null;
		return false;
	}
}

function calendarAttachment(event: CalendarEvent): MailAttachment[] {
	return [
		{
			filename: 'reservation.ics',
			content: buildICS(event),
			contentType: `text/calendar; method=${event.method}`
		}
	];
}

/**
 * Send the activation email to every address registered on the flat
 * (or to `onlyEmail` alone when a single recipient is targeted).
 *
 * Deliberately coarse: resolves `false` for all three non-delivery cases —
 * (1) SMTP not configured, (2) no registered emails, (3) SMTP send failed —
 * and never throws. Callers surface it as a failure-only `mailFailed` flag,
 * so a delivery failure must never fail the surrounding admin action
 * (the code is already generated and usable).
 */
export async function sendActivationEmail(
	database: typeof db,
	flatNumber: string,
	activationCode: string,
	baseUrl: string,
	onlyEmail?: string
): Promise<boolean> {
	const transport = getTransporter();
	if (!transport) return false;

	const registered = await getFlatEmails(database, flatNumber);
	const emails = onlyEmail
		? registered.filter((address) => address.toLowerCase() === onlyEmail.toLowerCase())
		: registered;
	if (emails.length === 0) {
		console.warn(`[mail] No emails registered for flat ${flatNumber}, skipping activation email.`);
		return false;
	}

	const activationLink = `${baseUrl}${ACTIVATE_PATH}?flat=${encodeURIComponent(flatNumber)}&code=${encodeURIComponent(activationCode)}`;
	const { subject, text, html } = buildActivationEmail(flatNumber, activationCode, activationLink);
	return deliver(emails, subject, text, html);
}

/**
 * Notify request addresses that their access request was approved, with the
 * freshly generated invitation code. Returns false (never throws) on any
 * delivery problem — the approval itself already committed.
 */
export async function sendRequestApprovedEmail(
	database: typeof db,
	flatNumber: string,
	activationCode: string,
	baseUrl: string,
	emails: string[]
): Promise<boolean> {
	if (emails.length === 0) {
		console.warn(`[mail] No request emails for flat ${flatNumber}, skipping approval email.`);
		return false;
	}
	const activationLink = `${baseUrl}${ACTIVATE_PATH}?flat=${encodeURIComponent(flatNumber)}&code=${encodeURIComponent(activationCode)}`;
	const { subject, text, html } = buildActivationEmail(flatNumber, activationCode, activationLink);
	return deliver(emails, subject, text, html);
}

/** Notify request addresses that their access request was rejected. */
export async function sendRequestRejectedEmail(
	emails: string[],
	requesterName: string | null,
	reason: string | null = null,
	flatNumber: string | null = null,
	baseUrl?: string
): Promise<boolean> {
	if (emails.length === 0) {
		console.warn('[mail] No request emails, skipping rejection email.');
		return false;
	}
	const guideUrl = baseUrl ? `${baseUrl}/guide` : null;
	const { subject, text, html } = buildRejectionEmail(requesterName, reason, flatNumber, guideUrl);
	return deliver(emails, subject, text, html);
}

/** Notify a deleted flat's former addresses that their lot is gone. */
export async function sendLotDeletedEmail(emails: string[], flatNumber: string, baseUrl?: string): Promise<boolean> {
	if (emails.length === 0) {
		console.warn(`[mail] No emails registered for flat ${flatNumber}, skipping deletion email.`);
		return false;
	}
	const guideUrl = baseUrl ? `${baseUrl}/guide` : null;
	const { subject, text, html } = buildLotDeletedEmail(flatNumber, guideUrl);
	return deliver(emails, subject, text, html);
}

interface BookingMailTarget {
	bookingId: number;
	to: string[];
	spotNumber: string;
	flatNumber: string;
	startTime: string;
	endTime: string;
}

/** Booking receipt with a calendar invite attached. */
export async function sendBookingConfirmationEmail(target: BookingMailTarget, baseUrl: string): Promise<boolean> {
	const manageUrl = `${baseUrl}/my-bookings?booking=${target.bookingId}`;
	const { subject, text, html } = buildBookingConfirmationEmail(target, manageUrl);
	return deliver(
		target.to,
		subject,
		text,
		html,
		calendarAttachment({
			uid: bookingUid(target.bookingId),
			start: target.startTime,
			end: target.endTime,
			summary: `Parking — Place ${target.spotNumber}`,
			description: `Réservation Créneau — place ${target.spotNumber} (lot ${target.flatNumber})`,
			method: 'PUBLISH'
		})
	);
}

/** Cancellation notice with a calendar retraction attached. */
export async function sendBookingCancelledEmail(
	target: BookingMailTarget,
	byOwner = false,
	baseUrl?: string
): Promise<boolean> {
	const guideUrl = baseUrl ? `${baseUrl}/guide` : null;
	const manageUrl = baseUrl ? `${baseUrl}/my-bookings?booking=${target.bookingId}` : null;
	const { subject, text, html } = buildBookingCancelledEmail(target, byOwner, guideUrl, manageUrl);
	return deliver(
		target.to,
		subject,
		text,
		html,
		calendarAttachment({
			uid: bookingUid(target.bookingId),
			start: target.startTime,
			end: target.endTime,
			summary: `Parking — Place ${target.spotNumber}`,
			method: 'CANCEL'
		})
	);
}

/** Move notice: same UID, bumped sequence, new slot attached. */
export async function sendBookingMovedEmail(
	target: BookingMailTarget,
	oldStartTime: string,
	oldEndTime: string,
	byOwner = false,
	baseUrl?: string,
	oldSpotNumber?: string | null
): Promise<boolean> {
	const guideUrl = baseUrl ? `${baseUrl}/guide` : null;
	const manageUrl = baseUrl ? `${baseUrl}/my-bookings?booking=${target.bookingId}` : null;
	const { subject, text, html } = buildBookingMovedEmail(
		target,
		oldStartTime,
		oldEndTime,
		byOwner,
		guideUrl,
		manageUrl,
		oldSpotNumber ?? null
	);
	// Calendar clients show the description raw: French slot labels, never ISO.
	const oldSlotFr = `${formatCompactDateTimeFr(oldStartTime)} → ${formatBookingEndFr(oldEndTime)}`;
	return deliver(
		target.to,
		subject,
		text,
		html,
		calendarAttachment({
			uid: bookingUid(target.bookingId),
			start: target.startTime,
			end: target.endTime,
			summary: `Parking — Place ${target.spotNumber}`,
			description: `Ancien créneau : ${oldSlotFr}`,
			sequence: 1,
			method: 'PUBLISH'
		})
	);
}

/**
 * Failure-only mail wrapper: runs `send`, logs any delivery problem under
 * `tag`, and returns `{ mailFailed }` for the response spread — a delivery
 * failure must never fail the surrounding action. The send itself resolves
 * `false` (never throws) on non-delivery; the catch guards builder or
 * recipient-fetch throws.
 */
export async function sendWithMailFlag(
	tag: string,
	send: () => Promise<boolean>,
	detail?: string
): Promise<{ mailFailed: boolean }> {
	try {
		return { mailFailed: !(await send()) };
	} catch (e) {
		console.error(`[${tag}] email failed${detail ? ` for ${detail}` : ''}:`, e);
		return { mailFailed: true };
	}
}

/** Spread for the failure-only flag: `json({ ..., ...mailFlag(mailFailed) })`. */
export function mailFlag(mailFailed: boolean): { mailFailed: true } | Record<string, never> {
	return mailFailed ? { mailFailed: true } : {};
}
