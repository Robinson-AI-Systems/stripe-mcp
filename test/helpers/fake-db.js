// A-1's service-independent fake database; A-2 extends it with the real Stripe schema.
export function createFakeDb() {
  const rows = new Map();
  return {
    async initSchema() {},
    async put(key, value) { rows.set(key, structuredClone(value)); },
    async get(key) { return rows.has(key) ? structuredClone(rows.get(key)) : null; }
  };
}
