// Durable account-scoped meter event deduplication and single-use credit-void owner consent.
// Do not prune reserved/uncertain identifiers: Stripe's own deduplication is temporary.
export function createMeteredBillingStore(sql){
  return {
    async claimMeterUsageEvent({account,meterId,customerId,eventName,identifier,
      units,requestKey,mode}){
      if(!/^acct_[A-Za-z0-9]{2,100}$/.test(account??'')||
        !/^mtr_[A-Za-z0-9]{2,100}$/.test(meterId??'')||
        !/^cus_[A-Za-z0-9]{2,100}$/.test(customerId??'')||
        !/^[a-zA-Z][a-zA-Z0-9_.-]{2,59}$/.test(eventName??'')||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$/.test(identifier??'')||
        !Number.isSafeInteger(units)||units<1||units>100000000||
        typeof requestKey!=='string'||!requestKey.startsWith('rmcp_')||
        !['test','live'].includes(mode))
        throw new TypeError('Valid account-scoped meter event identity required');
      const rows=await sql`INSERT INTO meter_usage_claims
        (stripe_account,meter_id,customer_id,event_name,identifier,units,request_key,mode)
        SELECT ${account},${meterId},${customerId},${eventName},
          ${identifier},${units},${requestKey},${mode}
        FROM stripe_accounts WHERE id=${account}
        ON CONFLICT DO NOTHING RETURNING identifier`;
      return rows.length===1;
    },
    async confirmMeterUsageEvent({account,meterId,identifier,requestKey,mode}){
      if(!/^acct_[A-Za-z0-9]{2,100}$/.test(account??'')||
        !/^mtr_[A-Za-z0-9]{2,100}$/.test(meterId??'')||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$/.test(identifier??'')||
        typeof requestKey!=='string'||!requestKey.startsWith('rmcp_')||
        !['test','live'].includes(mode))
        throw new TypeError('Exact meter acknowledgment required');
      const rows=await sql`UPDATE meter_usage_claims
        SET state='provider_acknowledged',acknowledged_at=now()
        WHERE stripe_account=${account} AND meter_id=${meterId} AND mode=${mode}
          AND identifier=${identifier} AND request_key=${requestKey}
          AND state='pending' RETURNING identifier`;
      return rows.length===1;
    },
    // Distinct from money-out: voiding existing credits changes future customer
    // obligations but is not a disbursement. Independent owner approval is
    // consumed exactly once without misreporting cash paid out or budget use.
    async consumeApprovedMoneyChange({account,idempotencyKey,tool,target,mode,
      amountCents,currency}){
      if(!/^acct_[A-Za-z0-9]{2,100}$/.test(account??'')||
        typeof idempotencyKey!=='string'||!idempotencyKey.startsWith('rmcp_')||
        tool!=='credit_void_grant'||!/^credgr_[A-Za-z0-9]{2,100}$/.test(target??'')||
        !['test','live'].includes(mode)||currency!=='usd'||
        !Number.isSafeInteger(amountCents)||amountCents<1)
        throw new TypeError('Exact approved financial change required');
      const rows=await sql`UPDATE money_approvals SET consumed_at=now()
        WHERE stripe_account=${account} AND request_key=${idempotencyKey}
          AND tool=${tool} AND target=${target} AND mode=${mode}
          AND amount_cents=${amountCents} AND currency=${currency}
          AND approved_at IS NOT NULL AND approved_at>now()-interval '10 minutes'
          AND consumed_at IS NULL AND expires_at>now()
        RETURNING id`;
      return rows.length===1;
    }
  };
}
export async function initMeteredBillingTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS meter_usage_claims (
    stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
    meter_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    identifier TEXT NOT NULL,
    units BIGINT NOT NULL CHECK (units>0),
    request_key TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('test','live')),
    state TEXT NOT NULL DEFAULT 'pending'
      CHECK (state IN ('pending','provider_acknowledged')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    PRIMARY KEY (stripe_account,mode,identifier)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS meter_usage_claims_pending_idx
    ON meter_usage_claims (stripe_account,created_at)
    WHERE state='pending'`;
}
