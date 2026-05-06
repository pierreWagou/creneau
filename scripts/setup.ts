import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'path';
import * as schema from '../src/lib/server/db/schema';

const DB_PATH = process.env.DATABASE_URL || resolve('data/creneau.db');

console.log(`Setting up database at: ${DB_PATH}`);

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite, { schema });

// Run migrations
migrate(db, { migrationsFolder: resolve('drizzle') });
console.log('Migrations applied.');

// Check if we already have data
const existingFlats = db.select().from(schema.flat).all();
if (existingFlats.length === 0) {
	// Seed initial data
	console.log('Seeding initial data...');

	// Create admin flat
	const adminCode = 'A1B2';
	db.insert(schema.flat)
		.values({
			number: '1A',
			activationCode: adminCode,
			isAdmin: true
		})
		.run();

	// Create a parking spot
	db.insert(schema.spot)
		.values({
			name: 'Place 1',
			description: 'Place de parking partagée'
		})
		.run();

	console.log('');
	console.log('=== Initial Setup Complete ===');
	console.log('');
	console.log('Admin flat: 1A');
	console.log(`Activation code: ${adminCode}`);
	console.log('');
	console.log('Go to /activate and use these credentials to set up your admin account.');
	console.log('Then use the admin panel to add more flats and parking spots.');
	console.log('');
} else {
	console.log('Database already has data, skipping seed.');
}

sqlite.close();
console.log('Done.');
