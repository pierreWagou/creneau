import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { applyPendingMigrations, type Migration, type SqlExecutor, type SqlRows, splitSqlStatements } from './migrate';

describe('splitSqlStatements', () => {
	it('splits plain statements', () => {
		expect(splitSqlStatements('CREATE TABLE a (x text);DROP TABLE a;')).toEqual([
			'CREATE TABLE a (x text)',
			'DROP TABLE a'
		]);
	});

	it('ignores semicolons inside line comments', () => {
		const sql = '-- Note: a may not exist; this is safe\nDELETE FROM `flat` WHERE `x` = 1;';
		expect(splitSqlStatements(sql)).toEqual([sql.replace(/;$/, '')]);
	});

	it('does not let a comment swallow the statement after it', () => {
		const sql = '-- caveat; continues here\nUPDATE `flat` SET `s` = 1 WHERE 1;';
		const [stmt] = splitSqlStatements(sql);
		expect(stmt).toContain('UPDATE `flat` SET `s` = 1 WHERE 1');
	});

	it('ignores semicolons inside block comments', () => {
		expect(splitSqlStatements('/* a; b */SELECT 1;')).toEqual(['/* a; b */SELECT 1']);
	});

	it('ignores semicolons inside quoted strings and identifiers', () => {
		expect(splitSqlStatements('SELECT \';\';SELECT `;`;SELECT ";";')).toEqual([
			"SELECT ';'",
			'SELECT `;`',
			'SELECT ";"'
		]);
	});

	it('handles doubled quote escapes', () => {
		expect(splitSqlStatements(`SELECT 'it''s; fine';SELECT 2;`)).toEqual([`SELECT 'it''s; fine'`, 'SELECT 2']);
	});

	it('drops comment-only and blank fragments', () => {
		expect(splitSqlStatements('-- nothing here;\n\n/* still nothing */')).toEqual([]);
	});

	it('keeps a trailing statement without a semicolon', () => {
		expect(splitSqlStatements('SELECT 1;SELECT 2')).toEqual(['SELECT 1', 'SELECT 2']);
	});

	it('returns the whole input for unterminated quotes', () => {
		expect(splitSqlStatements(`SELECT 'oops;`)).toEqual([`SELECT 'oops;`]);
	});
});

describe('splitSqlStatements on the real migration files', () => {
	// Regression: these two comments contain a ';' (0012:52, 0013:3), which the
	// old `split(';')` merged into a comment fragment, so the statement below it
	// failed to parse and was silently skipped while the migration was recorded.
	const load = (tag: string) => splitSqlStatements(readFileSync(resolve(`drizzle/${tag}.sql`), 'utf8'));

	it('0012 keeps the request-husk cleanup DELETE', () => {
		const stmts = load('0012_request_tables');
		const deletes = stmts.filter((s) => s.includes('DELETE FROM `flat`'));
		expect(deletes).toHaveLength(1);
		expect(deletes[0]).toContain("WHERE `status` = 'request'");
		// every statement must start a real statement, not resume mid-comment
		for (const s of stmts) {
			expect(s.replace(/^(--.*\n|\s|\/\*[\s\S]*?\*\/)*/, '')).not.toMatch(/^this /);
		}
	});

	it('0013 keeps the pending-status backfill UPDATE', () => {
		const stmts = load('0013_flat_pending_backfill');
		const updates = stmts.filter((s) => s.includes('UPDATE `flat`'));
		expect(updates).toHaveLength(1);
		expect(updates[0]).toContain("`status` = 'pending'");
		expect(updates[0]).toContain('`activation_code` IS NOT NULL');
	});
});

/** Minimal in-memory client: records hashes, runs or fails statements on demand. */
function fakeClient(failures: Record<string, string> = {}) {
	const hashes: string[] = [];
	const executed: string[] = [];
	const client: SqlExecutor = {
		async execute(stmt): Promise<SqlRows> {
			if (typeof stmt === 'object') {
				hashes.push(String(stmt.args[0]));
				return { rows: [] };
			}
			if (stmt.includes('SELECT hash FROM __drizzle_migrations')) {
				return { rows: hashes.map((hash) => ({ hash })) };
			}
			if (stmt.includes('__drizzle_migrations')) return { rows: [] }; // bookkeeping
			executed.push(stmt);
			const error = failures[stmt.trim()];
			if (error) throw new Error(error);
			return { rows: [] };
		}
	};
	return { client, hashes, executed };
}

const migration = (hash: string, sql: string): Migration => ({ hash, folderMillis: 1, sql: [sql] });

describe('applyPendingMigrations', () => {
	it('records each migration hash once', async () => {
		const { client, hashes, executed } = fakeClient();
		await applyPendingMigrations(client, [migration('h1', 'SELECT 1;'), migration('h2', 'SELECT 2;')]);
		expect(hashes).toEqual(['h1', 'h2']);
		expect(executed).toEqual(['SELECT 1', 'SELECT 2']);

		await applyPendingMigrations(client, [migration('h1', 'SELECT 1;'), migration('h2', 'SELECT 2;')]);
		expect(hashes).toEqual(['h1', 'h2']);
		expect(executed).toHaveLength(2);
	});

	it('silences known-benign re-run conflicts', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = fakeClient({ 'SELECT 1': 'SQLITE_ERROR: table a already exists' });
		await applyPendingMigrations(client, [migration('h1', 'SELECT 1;')]);
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it('logs unexpected failures but still records the migration', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client, hashes } = fakeClient({ 'SELECT 1': 'SQLITE_ERROR: near "this": syntax error' });
		await applyPendingMigrations(client, [migration('abcdef123456', 'SELECT 1;')]);
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('abcdef123456'));
		expect(hashes).toEqual(['abcdef123456']);
		spy.mockRestore();
	});
});
