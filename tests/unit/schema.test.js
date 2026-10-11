import { describe, it, expect } from 'vitest';
import { SCHEMA_TABLES, createDb } from '../../src/db.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';

describe('database schema declaration', () => {
  it('exposes the seven A-2 and additive B-1 money/B-2 live/B-8 owner-intent and LIVE-disable/default-account/money-limit and V-1 developer run tables without requiring a connection at import', () => {
    expect(SCHEMA_TABLES).toEqual([
      'stripe_accounts', 'oauth_clients', 'oauth_codes', 'oauth_tokens',
      'login_attempts', 'change_log', 'one_time_secrets', 'money_reservations', 'money_approvals', 'live_enable_intents', 'owner_revoke_intents', 'owner_disable_live_intents', 'owner_default_account_intents', 'owner_money_limit_intents', 'owner_money_decision_intents', 'result_store', 'dev_runs', 'dev_run_objects', 'dev_forwarders', 'dev_forwarder_replays', 'dev_forwarder_replay_events', 'dev_simulation_cycles', 'webhook_create_intents'
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
