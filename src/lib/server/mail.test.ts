import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { db as database } from './db';

vi.mock('nodemailer', () => ({
	default: { createTransport: vi.fn() }
}));

// mail.ts owns its `./db` import, so the module mock builds the memory DB.
// Seeded per test — immune to the repo .env (Mailpit dev defaults).
const testEnv: Record<string, string | undefined> = {};
vi.mock('$env/dynamic/private', () => ({ env: testEnv }));

vi.mock('./db', async () => {
	const { createClient } = await import('@libsql/client');
	const { drizzle } = await import('drizzle-orm/libsql');
	const client = createClient({ url: ':memory:' });
	(globalThis as unknown as Record<string, unknown>).__mailTestClient = client;
	return { db: drizzle(client) };
});

type MemClient = { execute: (sql: string) => Promise<unknown> };
function memDb(): MemClient {
	return (globalThis as unknown as Record<string, MemClient>).__mailTestClient;
}

async function loadMail() {
	vi.resetModules();
	const nodemailer = (await import('nodemailer')).default as unknown as {
		createTransport: ReturnType<typeof vi.fn>;
	};
	nodemailer.createTransport.mockReset();
	const { db } = (await import('./db')) as unknown as { db: typeof database };
	const {
		sendActivationEmail,
		sendBookingCancelledEmail,
		sendBookingConfirmationEmail,
		sendBookingMovedEmail,
		sendRequestRejectedEmail
	} = await import('./mail');
	return {
		sendActivationEmail,
		sendBookingCancelledEmail,
		sendBookingConfirmationEmail,
		sendBookingMovedEmail,
		sendRequestRejectedEmail,
		createTransport: nodemailer.createTransport,
		db
	};
}

function mockTransport(fail = false) {
	return {
		sendMail: vi.fn().mockImplementation(() => (fail ? Promise.reject(new Error('smtp down')) : Promise.resolve()))
	};
}

describe('sendActivationEmail', () => {
	beforeAll(async () => {
		await import('./db'); // instantiate the mocked module (sets the shared client)
		await memDb().execute(`
			CREATE TABLE flat_email (
				flat_number text NOT NULL,
				email text NOT NULL,
				PRIMARY KEY (flat_number, email)
			)
		`);
	});

	beforeEach(async () => {
		for (const key of Object.keys(testEnv)) delete testEnv[key];
		await memDb().execute('DELETE FROM flat_email');
		await memDb().execute(
			`INSERT INTO flat_email (flat_number, email) VALUES ('A01', 'a@test.com'), ('A01', 'b@test.com')`
		);
	});

	it('returns false without sending when SMTP is unconfigured', async () => {
		const { sendActivationEmail, createTransport, db } = await loadMail();
		await expect(sendActivationEmail(db, 'A01', 'CODE', 'https://x.test')).resolves.toBe(false);
		expect(createTransport).not.toHaveBeenCalled();
	});

	it('sends to every registered address by default', async () => {
		testEnv.SMTP_HOST = 'smtp.test';
		testEnv.SMTP_USER = 'u';
		testEnv.SMTP_PASSWORD = 'p';
		const { sendActivationEmail, createTransport, db } = await loadMail();
		const transport = mockTransport();
		createTransport.mockReturnValue(transport);
		await expect(sendActivationEmail(db, 'A01', 'CODE', 'https://x.test')).resolves.toBe(true);
		expect(transport.sendMail).toHaveBeenCalledOnce();
		expect(transport.sendMail.mock.calls[0][0].to).toBe('a@test.com, b@test.com');
	});

	it('targets a single registered address with the override', async () => {
		testEnv.SMTP_HOST = 'smtp.test';
		testEnv.SMTP_USER = 'u';
		testEnv.SMTP_PASSWORD = 'p';
		const { sendActivationEmail, createTransport, db } = await loadMail();
		const transport = mockTransport();
		createTransport.mockReturnValue(transport);
		await expect(sendActivationEmail(db, 'A01', 'CODE', 'https://x.test', 'b@test.com')).resolves.toBe(true);
		expect(transport.sendMail.mock.calls[0][0].to).toBe('b@test.com');
	});

	it('attaches the inline header badge to every mail', async () => {
		testEnv.SMTP_HOST = 'smtp.test';
		testEnv.SMTP_USER = 'u';
		testEnv.SMTP_PASSWORD = 'p';
		const { sendActivationEmail, createTransport, db } = await loadMail();
		const transport = mockTransport();
		createTransport.mockReturnValue(transport);
		await expect(sendActivationEmail(db, 'A01', 'CODE', 'https://x.test')).resolves.toBe(true);
		const attachments = transport.sendMail.mock.calls[0][0].attachments;
		expect(attachments).toHaveLength(1);
		expect(attachments[0]).toMatchObject({
			filename: 'logo.png',
			contentType: 'image/png',
			encoding: 'base64',
			contentDisposition: 'inline',
			cid: 'creneau-logo'
		});
		expect(typeof attachments[0].content).toBe('string');
	});

	it('matches the override case-insensitively', async () => {
		testEnv.SMTP_HOST = 'smtp.test';
		testEnv.SMTP_USER = 'u';
		testEnv.SMTP_PASSWORD = 'p';
		const { sendActivationEmail, createTransport, db } = await loadMail();
		const transport = mockTransport();
		createTransport.mockReturnValue(transport);
		await expect(sendActivationEmail(db, 'A01', 'CODE', 'https://x.test', 'B@TEST.COM')).resolves.toBe(true);
		expect(transport.sendMail.mock.calls[0][0].to).toBe('b@test.com');
	});

	it('sends nothing for an unregistered override', async () => {
		testEnv.SMTP_HOST = 'smtp.test';
		testEnv.SMTP_USER = 'u';
		testEnv.SMTP_PASSWORD = 'p';
		const { sendActivationEmail, createTransport, db } = await loadMail();
		const transport = mockTransport();
		createTransport.mockReturnValue(transport);
		await expect(sendActivationEmail(db, 'A01', 'CODE', 'https://x.test', 'stranger@test.com')).resolves.toBe(false);
		expect(transport.sendMail).not.toHaveBeenCalled();
	});

	it('resolves false and resets the transporter on SMTP failure', async () => {
		testEnv.SMTP_HOST = 'smtp.test';
		testEnv.SMTP_USER = 'u';
		testEnv.SMTP_PASSWORD = 'p';
		const { sendActivationEmail, createTransport, db } = await loadMail();
		createTransport.mockReturnValue(mockTransport(true));
		await expect(sendActivationEmail(db, 'A01', 'CODE', 'https://x.test')).resolves.toBe(false);
		// Reset means the next call rebuilds the transporter instead of reusing the dead one
		createTransport.mockReturnValue(mockTransport());
		await expect(sendActivationEmail(db, 'A01', 'CODE', 'https://x.test')).resolves.toBe(true);
		expect(createTransport).toHaveBeenCalledTimes(2);
	});
});

describe('booking and request senders', () => {
	beforeEach(async () => {
		for (const key of Object.keys(testEnv)) delete testEnv[key];
		testEnv.SMTP_HOST = 'smtp.test';
		testEnv.SMTP_USER = 'u';
		testEnv.SMTP_PASSWORD = 'p';
	});

	const TARGET = {
		bookingId: 7,
		to: ['a@test.com'],
		spotNumber: '36',
		flatNumber: 'A01',
		startTime: '2026-07-24T14:00:00',
		endTime: '2026-07-24T16:00:00'
	};

	it('confirmation attaches a PUBLISH invite', async () => {
		const { sendBookingConfirmationEmail, createTransport } = await loadMail();
		const transport = mockTransport();
		createTransport.mockReturnValue(transport);
		await expect(sendBookingConfirmationEmail(TARGET, 'https://x.test')).resolves.toBe(true);
		const call = transport.sendMail.mock.calls[0][0];
		expect(call.to).toBe('a@test.com');
		expect(call.subject).toContain('confirmée');
		expect(call.attachments).toHaveLength(2);
		expect(call.attachments[0].filename).toBe('reservation.ics');
		expect(call.attachments[0].content).toContain('METHOD:PUBLISH');
		expect(call.attachments[0].content).toContain('UID:booking-7@creneau');
		expect(call.attachments[1]).toMatchObject({ filename: 'logo.png', cid: 'creneau-logo' });
	});

	it('cancellation attaches a CANCEL retraction', async () => {
		const { sendBookingCancelledEmail, createTransport } = await loadMail();
		const transport = mockTransport();
		createTransport.mockReturnValue(transport);
		await expect(sendBookingCancelledEmail(TARGET)).resolves.toBe(true);
		const call = transport.sendMail.mock.calls[0][0];
		expect(call.subject).toContain('annulée');
		expect(call.attachments[0].content).toContain('METHOD:CANCEL');
	});

	it('move attaches an updated invite with the same UID', async () => {
		const { sendBookingMovedEmail, createTransport } = await loadMail();
		const transport = mockTransport();
		createTransport.mockReturnValue(transport);
		await expect(sendBookingMovedEmail(TARGET, '2026-07-24T10:00:00', '2026-07-24T12:00:00')).resolves.toBe(true);
		const call = transport.sendMail.mock.calls[0][0];
		expect(call.subject).toContain('modifiée');
		expect(call.attachments[0].content).toContain('UID:booking-7@creneau');
		expect(call.attachments[0].content).toContain('SEQUENCE:1');
	});

	it('move ICS description uses French slot labels, not raw ISO', async () => {
		const { sendBookingMovedEmail, createTransport } = await loadMail();
		const transport = mockTransport();
		createTransport.mockReturnValue(transport);
		await expect(sendBookingMovedEmail(TARGET, '2026-07-24T10:00:00', '2026-07-24T12:00:00')).resolves.toBe(true);
		const content: string = transport.sendMail.mock.calls[0][0].attachments[0].content;
		const description = content.split('\r\n').find((line) => line.startsWith('DESCRIPTION:'));
		expect(description).toContain('24 juil.');
		expect(description).toContain('10:00');
		expect(description).toContain('12:00');
		expect(description).not.toContain('2026-07-24T');
	});

	it('rejection goes to the explicit address list', async () => {
		const { sendRequestRejectedEmail, createTransport } = await loadMail();
		const transport = mockTransport();
		createTransport.mockReturnValue(transport);
		await expect(sendRequestRejectedEmail(['r@test.com'], 'Dupont')).resolves.toBe(true);
		const call = transport.sendMail.mock.calls[0][0];
		expect(call.to).toBe('r@test.com');
		expect(call.subject).toContain('demande');
	});

	it('rejection with no addresses sends nothing', async () => {
		const { sendRequestRejectedEmail, createTransport } = await loadMail();
		const transport = mockTransport();
		createTransport.mockReturnValue(transport);
		await expect(sendRequestRejectedEmail([], null)).resolves.toBe(false);
		expect(transport.sendMail).not.toHaveBeenCalled();
	});
});
