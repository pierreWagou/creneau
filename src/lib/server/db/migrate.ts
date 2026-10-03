/**
 * Shared migration runner, used by `db/index.ts` (app boot) and `e2e/setup-db.ts`.
 *
 * Statements must be split with {@link splitSqlStatements} — a naive `split(';')`
 * cuts comments like `-- … ; this is safe` in half, which turns the following real
 * statement into a syntax error that is swallowed and recorded as applied.
 */

/** Rows returned by a statement. */
export interface SqlRows {
	rows: Array<Record<string, unknown>>;
}

/** Structural client interface: libsql `Client` satisfies it, tests can fake it. */
export interface SqlExecutor {
	execute(stmt: string | { sql: string; args: unknown[] }): Promise<SqlRows>;
}

/** Shape of drizzle's `MigrationMeta` (its own type has no tag field). */
export interface Migration {
	hash: string;
	folderMillis: number;
	sql: string[];
}

/** Errors that are expected on partial re-runs of unguarded migrations. */
const BENIGN_SQLITE_ERRORS = ['already exists', 'no such table', 'duplicate column'];

/**
 * Split SQL into statements on `;`, aware of `--` / block comments and quoted
 * strings/identifiers (`'…'`, `"…"`, `` `…` ``, doubling escapes). Comment-only
 * fragments are dropped; unterminated constructs are returned as-is.
 */
export function splitSqlStatements(sql: string): string[] {
	const statements: string[] = [];
	let current = '';
	let hasCode = false;
	let i = 0;
	const n = sql.length;

	while (i < n) {
		const ch = sql[i];
		const next = i + 1 < n ? sql[i + 1] : '';

		// Line comment: runs to (and keeps) the newline
		if (ch === '-' && next === '-') {
			const nl = sql.indexOf('\n', i);
			const end = nl === -1 ? n : nl + 1;
			current += sql.slice(i, end);
			i = end;
			continue;
		}

		// Block comment: runs through the closing marker
		if (ch === '/' && next === '*') {
			const end = sql.indexOf('*/', i + 2);
			const stop = end === -1 ? n : end + 2;
			current += sql.slice(i, stop);
			i = stop;
			continue;
		}

		// Quoted string or identifier: doubled quote escapes the quote
		if (ch === "'" || ch === '"' || ch === '`') {
			let j = i + 1;
			while (j < n) {
				if (sql[j] === ch) {
					if (sql[j + 1] === ch) {
						j += 2;
						continue;
					}
					j += 1;
					break;
				}
				j += 1;
			}
			current += sql.slice(i, j);
			hasCode = true;
			i = j;
			continue;
		}

		if (ch === ';') {
			if (hasCode) statements.push(current.trim());
			current = '';
			hasCode = false;
			i += 1;
			continue;
		}

		if (!/\s/.test(ch)) hasCode = true;
		current += ch;
		i += 1;
	}

	if (hasCode) statements.push(current.trim());
	return statements;
}

/**
 * Apply every migration not yet recorded in `__drizzle_migrations`.
 *
 * Statement-level failures are tolerated for the known-benign re-run conflicts;
 * anything else is logged with the migration hash and the migration is STILL
 * recorded as applied — re-queueing a deterministic failure would loop forever
 * at boot. Fix forward with a new migration instead.
 */
export async function applyPendingMigrations(client: SqlExecutor, migrations: Migration[]): Promise<void> {
	await client.execute(`
		CREATE TABLE IF NOT EXISTS __drizzle_migrations (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at numeric
		)
	`);

	const applied = await client.execute('SELECT hash FROM __drizzle_migrations');
	const appliedHashes = new Set(applied.rows.map((r) => String(r.hash)));

	for (const migration of migrations) {
		if (appliedHashes.has(migration.hash)) continue;

		for (const sqlChunk of migration.sql) {
			for (const stmt of splitSqlStatements(sqlChunk)) {
				try {
					await client.execute(stmt);
				} catch (e) {
					const message = e instanceof Error ? e.message : String(e);
					const benign = BENIGN_SQLITE_ERRORS.some((code) => message.includes(code));
					if (!benign) {
						console.error(`[db/migrate] ${migration.hash.slice(0, 12)} — statement failed: ${message}`);
					}
				}
			}
		}

		await client.execute({
			sql: 'INSERT OR IGNORE INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)',
			args: [migration.hash, migration.folderMillis]
		});
	}
}
