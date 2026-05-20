import fs from 'node:fs';
import path from 'node:path';

export default async function globalSetup() {
	// Delete test database to start fresh
	const dbPath = path.resolve('data/test.db');
	for (const ext of ['', '-wal', '-shm']) {
		try {
			fs.unlinkSync(dbPath + ext);
		} catch {
			// File doesn't exist, that's fine
		}
	}
}
