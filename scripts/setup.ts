import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { resolve } from 'path';
import * as schema from '../src/lib/server/db/schema';

const DB_PATH = process.env.DATABASE_URL || `file:${resolve('data/creneau.db')}`;

console.log(`Setting up database at: ${DB_PATH}`);

const client = createClient({ url: DB_PATH });
const db = drizzle(client, { schema });

// Run migrations
await migrate(db, { migrationsFolder: resolve('drizzle') });
console.log('Migrations applied.');

// Check if we already have data
const existingFlats = await db.select().from(schema.flat).all();
if (existingFlats.length === 0) {
	// Seed initial data
	console.log('Seeding initial data...');

	const activationCode = generateActivationCode();

	await db.insert(schema.flat).values({
		number: 'B23',
		activationCode,
		isAdmin: true
	});

	await db.insert(schema.spot).values({
		name: '36',
		description: 'Place handicapé — partagée entre résidents (aucune personne à mobilité réduite dans l\'immeuble)'
	});

	console.log('');
	console.log('=== Initial Setup Complete ===');
	console.log('');
	console.log('Admin flat: B23');
	console.log(`Activation code: ${activationCode}`);
	console.log('');
	console.log('Go to /activate and use these credentials to set up your admin account.');
	console.log('');
} else {
	console.log('Database already has data, skipping seed.');
}

console.log('Done.');

function generateActivationCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 4; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}
