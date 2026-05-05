import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const building = sqliteTable('building', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});

export const flat = sqliteTable('flat', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	number: text('number').notNull().unique(),
	activationCode: text('activation_code').notNull(),
	displayName: text('display_name'),
	pinHash: text('pin_hash'),
	isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
	activatedAt: text('activated_at'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});

export const slot = sqliteTable('slot', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	description: text('description'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});

export const booking = sqliteTable('booking', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	slotId: integer('slot_id')
		.notNull()
		.references(() => slot.id),
	flatId: integer('flat_id')
		.notNull()
		.references(() => flat.id),
	startTime: text('start_time').notNull(),
	endTime: text('end_time').notNull(),
	label: text('label'), // 'morning', 'afternoon', 'evening', or null for custom
	note: text('note'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	flatId: integer('flat_id')
		.notNull()
		.references(() => flat.id),
	expiresAt: text('expires_at').notNull(),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});
