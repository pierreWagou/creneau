import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const spot = sqliteTable('spot', {
	number: text('number').primaryKey(),
	description: text('description'),
	createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
});

export const flat = sqliteTable('flat', {
	number: text('number').primaryKey(),
	activationCode: text('activation_code'),
	activationCodeExpiresAt: text('activation_code_expires_at'),
	displayName: text('display_name'),
	pinHash: text('pin_hash'),
	isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
	activatedAt: text('activated_at'),
	createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
});

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
