// A-1's service-independent fake database; extended with Batch A-2 schema tracking.
import { SCHEMA_TABLES } from '../../src/db.js';

export function createFakeDb() {
  const rows = new Map();
  const createdTables = new Set();
  return {
    async initSchema() {
      for (const table of SCHEMA_TABLES) createdTables.add(table);
    },
    async listTables() { return [...createdTables].sort(); },
    async put(key, value) { rows.set(key, structuredClone(value)); },
    async get(key) { return rows.has(key) ? structuredClone(rows.get(key)) : null; }
  };
}
