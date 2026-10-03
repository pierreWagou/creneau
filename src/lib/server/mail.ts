import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';
import { SMTP_DEFAULT_PORT, SMTP_POOL_SIZE, SMTP_TIMEOUT_MS } from '$lib/constants';
import { getFlatEmails } from './contacts';
import type { db } from './db';
import { buildActivationEmail } from './mail-templates';

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
	const port = Number(SMTP_PORT) || SMTP_DEFAULT_PORT;
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

/**
 * Send the activation email to every address registered on the flat.
 *
 * Deliberately coarse: resolves `false` for all three non-delivery cases —
 * (1) SMTP not configured, (2) no registered emails, (3) SMTP send failed —
 * and never throws. Callers surface it as a "email sent" / "email skipped"
 * toast + `emailSent` flag, so a delivery failure must never fail the
 * surrounding admin action (the code is already generated and usable).
 */
export async function sendActivationEmail(
	database: typeof db,
	flatNumber: string,
	activationCode: string,
	baseUrl: string
): Promise<boolean> {
	const transport = getTransporter();
	if (!transport) return false;

	const emails = await getFlatEmails(database, flatNumber);
	if (emails.length === 0) {
		console.warn(`[mail] No emails registered for flat ${flatNumber}, skipping activation email.`);
		return false;
	}

	const activationLink = `${baseUrl}/activate?flat=${encodeURIComponent(flatNumber)}&code=${encodeURIComponent(activationCode)}`;
	const { subject, text, html } = buildActivationEmail(flatNumber, activationCode, activationLink);

	try {
		await transport.sendMail({
			from: env.SMTP_FROM || 'noreply-creneau@wagou.fr',
			to: emails.join(', '),
			subject,
			text,
			html
		});
		console.log(`[mail] Activation email sent to ${emails.join(', ')} for flat ${flatNumber}`);
		return true;
	} catch (e) {
		console.error(`[mail] Failed to send activation email for flat ${flatNumber}:`, e);
		transporter = null;
		return false;
	}
}
