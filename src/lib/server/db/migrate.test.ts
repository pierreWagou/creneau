import { describe, expect, it, vi } from 'vitest';
import { applyPendingMigrations, type Migration, type SqlExecutor, type SqlRows, splitSqlStatements } from './migrate';

function fakeClient(failOn?: (stmt: string) => Error | null): { client: SqlExecutor; executed: string[] } {
	const executed: string[] = [];
	const client: SqlExecutor = {
		execute(stmt: string | { sql: string; args: unknown[] }): Promise<SqlRows> {
			const sql = typeof stmt === 'string' ? stmt : stmt.sql;
			executed.push(sql);
			if (sql.startsWith('SELECT hash')) return Promise.resolve({ rows: [] });
			const err = failOn?.(sql) ?? null;
			if (err) return Promise.reject(err);
			return Promise.resolve({ rows: [] });
		}
	};
	return { client, executed };
}

function migration(hash: string, sql: string[]): Migration {
	return { hash, folderMillis: 0, sql };
}

describe('splitSqlStatements', () => {
	it('does not split on semicolons inside line comments', () => {
		const stmts = splitSqlStatements('-- … ; this is safe\nCREATE TABLE t (a text);');
		expect(stmts).toEqual(['-- … ; this is safe\nCREATE TABLE t (a text)']);
	});

	it('drops comment-only fragments', () => {
		expect(splitSqlStatements('-- just a comment\n')).toEqual([]);
	});
});

describe('applyPendingMigrations', () => {
	it('applies unapplied migrations statement by statement', async () => {
		const { client, executed } = fakeClient();
		await applyPendingMigrations(client, [migration('abc', ['CREATE TABLE t (a text); INSERT INTO t VALUES (1);'])]);
		expect(executed.some((s) => s.includes('CREATE TABLE t'))).toBe(true);
		expect(executed.some((s) => s.includes('INSERT INTO t'))).toBe(true);
		expect(executed.some((s) => s.includes('__drizzle_migrations'))).toBe(true);
	});

	it('records the migration even when a statement fails deterministically', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const { client, executed } = fakeClient((stmt) =>
				stmt.includes('BOGUS') ? new Error('syntax error near BOGUS') : null
			);
			await applyPendingMigrations(client, [migration('abc', ['CREATE TABLE t (a text); BOGUS STATEMENT;'])]);
			expect(err).toHaveBeenCalled();
			expect(executed.some((s) => s.includes('INSERT OR IGNORE INTO __drizzle_migrations'))).toBe(true);
		} finally {
			err.mockRestore();
		}
	});

	it('stays silent on known-benign re-run conflicts', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const { client } = fakeClient((stmt) =>
				stmt.includes('CREATE TABLE t ') ? new Error('table t already exists') : null
			);
			await applyPendingMigrations(client, [migration('abc', ['CREATE TABLE t (a text);'])]);
			expect(err).not.toHaveBeenCalled();
		} finally {
			err.mockRestore();
		}
	});
});
