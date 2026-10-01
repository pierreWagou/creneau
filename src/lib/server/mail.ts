import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';
import { SMTP_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER } from '$env/static/private';
import { getFlatEmails } from './contacts';
import type { db } from './db';
import { activationEmail } from './mail-templates';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
	if (transporter) return transporter;
	if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
		console.warn(
			'[mail] SMTP not configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASSWORD). Emails will not be sent.'
		);
		return null;
	}
	transporter = nodemailer.createTransport({
		host: SMTP_HOST,
		port: Number(SMTP_PORT) || 465,
		secure: Number(SMTP_PORT) === 465,
		pool: true,
		maxConnections: 2,
		connectionTimeout: 5000,
		greetingTimeout: 5000,
		auth: {
			user: SMTP_USER,
			pass: SMTP_PASSWORD
		}
	});
	return transporter;
}

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
	const { subject, text, html } = activationEmail(flatNumber, activationCode, activationLink);

	try {
		await transport.sendMail({
			from: SMTP_FROM || 'noreply-creneau@wagou.fr',
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
