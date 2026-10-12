// Durable account- and endpoint-scoped TEST webhook delivery evidence.
// Records metadata only; never persist event bodies, signing values or PII.
import {accountOk,endpointOk} from './signature-store.js';
const eventOk=x=>typeof x==='string'&&/^evt_[A-Za-z0-9]{2,100}$/.test(x);
const typeOk=x=>typeof x==='string'&&x.length<=120&&
  /^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,75}$/.test(x);
export function createTestWebhookReceiptStore(sql){
  return {
    async recordTestWebhookReceipt({account,endpoint,eventId,eventType}){
      if(!accountOk(account)||!endpointOk(endpoint)||!eventOk(eventId)||!typeOk(eventType))
        throw new TypeError('Invalid TEST receipt identity');
      const rows=await sql`INSERT INTO test_webhook_receipts
        (stripe_account,endpoint_id,event_id,event_type)
        VALUES (${account},${endpoint},${eventId},${eventType})
        ON CONFLICT (stripe_account,endpoint_id,event_id) DO NOTHING
        RETURNING event_id`;
      return rows.length===1;
    },
    async getTestWebhookReceipt({account,endpoint,eventId}){
      if(!accountOk(account)||!endpointOk(endpoint)||!eventOk(eventId))
        throw new TypeError('Invalid TEST receipt selector');
      const rows=await sql`SELECT event_type,received_at FROM test_webhook_receipts
        WHERE stripe_account=${account} AND endpoint_id=${endpoint}
          AND event_id=${eventId}`;
      return rows.length===1?{eventId,eventType:rows[0].event_type,
        receivedAt:rows[0].received_at}:null;
    }
  };
}
export async function initTestWebhookReceiptTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS test_webhook_receipts (
    stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
    endpoint_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (stripe_account,endpoint_id,event_id)
  )`;
}
