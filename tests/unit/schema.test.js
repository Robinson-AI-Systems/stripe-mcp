import { describe, it, expect } from 'vitest';
import { SCHEMA_TABLES, createDb } from '../../src/db.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';

describe('database schema declaration', () => {
  it('exposes all seven planned A-2 tables without requiring a connection at import', () => {
    expect(SCHEMA_TABLES).toEqual([
      'stripe_accounts', 'oauth_clients', 'oauth_codes', 'oauth_tokens',
      'login_attempts', 'change_log', 'one_time_secrets'
    ]);
  });

  it('fake schema initialization is idempotent', async () => {
    const db = createFakeDb();
    await db.initSchema();
    const first = await db.listTables();
    await db.initSchema();
    expect(await db.listTables()).toEqual(first);
    expect(first).toEqual([...SCHEMA_TABLES].sort());
  });

  it('refuses missing query functions, without silently connecting elsewhere', () => {
    expect(() => createDb(null)).toThrow(/tagged-template/);
  });
});
