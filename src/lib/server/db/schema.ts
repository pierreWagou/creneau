import { sql } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const spot = sqliteTable('spot', {
	number: text('number').primaryKey(),
	flatNumber: text('flat_number').references(() => flat.number, { onDelete: 'set null' }),
	description: text('description'),
	createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
});

export const flat = sqliteTable('flat', {
	number: text('number').primaryKey(),
	status: text('status', { enum: ['inactive', 'active'] })
		.notNull()
		.default('inactive'),
	activationCode: text('activation_code'),
	activationCodeExpiresAt: text('activation_code_expires_at'),
	displayName: text('display_name'),
	pinHash: text('pin_hash'),
	isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
	activatedAt: text('activated_at'),
	createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
});

export const request = sqliteTable('request', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	flatNumber: text('flat_number').notNull(),
	requesterName: text('requester_name'),
	status: text('status', { enum: ['pending', 'approved', 'rejected'] })
		.notNull()
		.default('pending'),
	reviewedBy: text('reviewed_by'),
	reviewedAt: text('reviewed_at'),
	createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
});

export const requestSpot = sqliteTable(
	'request_spot',
	{
		requestId: integer('request_id')
			.references(() => request.id, { onDelete: 'cascade' })
			.notNull(),
		spotNumber: text('spot_number').notNull()
	},
	(t) => [primaryKey(t.requestId, t.spotNumber)]
);

export const requestEmail = sqliteTable(
	'request_email',
	{
		requestId: integer('request_id')
			.references(() => request.id, { onDelete: 'cascade' })
			.notNull(),
		email: text('email').notNull()
	},
	(t) => [primaryKey(t.requestId, t.email)]
);

export const requestPhone = sqliteTable(
	'request_phone',
	{
		requestId: integer('request_id')
			.references(() => request.id, { onDelete: 'cascade' })
			.notNull(),
		phone: text('phone').notNull()
	},
	(t) => [primaryKey(t.requestId, t.phone)]
);

export const flatEmail = sqliteTable(
	'flat_email',
	{
		flatNumber: text('flat_number')
			.references(() => flat.number, { onDelete: 'cascade' })
			.notNull(),
		email: text('email').notNull()
	},
	(t) => [primaryKey(t.flatNumber, t.email)]
);

export const flatPhone = sqliteTable(
	'flat_phone',
	{
		flatNumber: text('flat_number')
			.references(() => flat.number, { onDelete: 'cascade' })
			.notNull(),
		phone: text('phone').notNull()
	},
	(t) => [primaryKey(t.flatNumber, t.phone)]
);

export const booking = sqliteTable('booking', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	spotNumber: text('spot_number')
		.notNull()
		.references(() => spot.number, { onDelete: 'cascade' }),
	flatNumber: text('flat_number')
		.notNull()
		.references(() => flat.number, { onDelete: 'cascade' }),
	startTime: text('start_time').notNull(),
	endTime: text('end_time').notNull(),
	note: text('note'),
	createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	flatNumber: text('flat_number')
		.notNull()
		.references(() => flat.number, { onDelete: 'cascade' }),
	expiresAt: text('expires_at').notNull(),
	createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
});
