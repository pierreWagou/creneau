import fs from 'node:fs';
import path from 'node:path';

export default async function globalSetup() {
	// Warm-server runs (E2E_REUSE_SERVER=1) start the dev server AFTER a fresh
	// setup-db, so unlinking here would strand its singleton connection on a
	// deleted inode — the runner owns the reset in that flow instead.
	if (process.env.E2E_REUSE_SERVER) return;
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
