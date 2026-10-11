// Durable account-scoped developer seeding ledger. Every real Stripe-created ID is recorded.
const runId=x=>typeof x==='string'&&/^run_[a-f0-9]{24}$/.test(x);
const accountId=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]+$/.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const key=x=>typeof x==='string'&&x.length>0&&x.length<=128;
const scenario=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{2,40}$/.test(x);
const idPrefixes={product:'prod',price:'price',customer:'cus',payment_intent:'pi',subscription:'sub',invoice:'in',test_clock:'clock',connected_account:'acct',event:'evt',charge:'ch',dispute:'du',invoice_item:'ii'};
export async function initDevRunTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS dev_runs (
    id TEXT PRIMARY KEY,
    stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
    connection TEXT,
    request_key TEXT NOT NULL,
    scenario TEXT NOT NULL,
    size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 10),
    plan_digest TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running'
      CHECK (status IN ('running','completed','uncertain')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    UNIQUE(stripe_account,request_key)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS dev_runs_account_recent
    ON dev_runs (stripe_account,created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS dev_run_objects (
    run_id TEXT NOT NULL REFERENCES dev_runs(id),
    step_name TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cleaned BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY(run_id,object_id),
    UNIQUE(run_id,step_name)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS dev_objects_pending_cleanup
    ON dev_run_objects (run_id,cleaned)`;
}
export function createDevRunStore(sql){
  return {
    async getDevRun({account,requestKey}){
      if(!accountId(account)||!key(requestKey))throw new TypeError('Valid account and seed retry key required');
      const rows=await sql`SELECT id,stripe_account,connection,request_key,
        scenario,size,plan_digest,status,created_at,completed_at
        FROM dev_runs WHERE stripe_account=${account} AND request_key=${requestKey}`;
      return rows[0]??null;
    },
    async ensureDevRun({id,account,connection,requestKey,scenario:kind,size,planDigest}){
      if(!runId(id)||!accountId(account)||!key(requestKey)||
        !scenario(kind)||!Number.isInteger(size)||size<1||size>10||
        !digest(planDigest)||!(connection===null||typeof connection==='string'&&
        connection.length<200))throw new TypeError('Valid immutable TEST seed run identity required');
      await sql`INSERT INTO dev_runs
        (id,stripe_account,connection,request_key,scenario,size,plan_digest)
        VALUES (${id},${account},${connection},${requestKey},${kind},${size},${planDigest})
        ON CONFLICT (stripe_account,request_key) DO NOTHING`;
      const run=await this.getDevRun({account,requestKey});
      if(run?.id!==id||run.scenario!==kind||run.size!==size||
        run.plan_digest!==planDigest)
        throw new Error('Seed retry key already belongs to another immutable plan');
      return run;
    },
    async getDevRunById({account,id}){
      if(!accountId(account)||!runId(id))
        throw new TypeError('Selected account and valid TEST run required');
      const rows=await sql`SELECT id,stripe_account,connection,request_key,scenario,
        size,plan_digest,status,created_at,completed_at FROM dev_runs
        WHERE stripe_account=${account} AND id=${id}`;
      return rows[0]??null;
    },
    // A paid store run is complete before a refund can be independently
    // owner-approved. Record only a verified refund for its recorded payment.
    async recordDevRunRefund({account,id,paymentStep,refundId}){
      if(!accountId(account)||!runId(id)||
        typeof paymentStep!=='string'||!/^payment_[1-5]$/.test(paymentStep)||
        typeof refundId!=='string'||!/^re_[A-Za-z0-9]{2,100}$/.test(refundId))
        throw new TypeError('Verified TEST refund/run/payment identity required');
      const refundStep='refund_'+paymentStep.slice('payment_'.length);
      const rows=await sql`WITH eligible AS (
        SELECT r.id FROM dev_runs r JOIN dev_run_objects p
          ON p.run_id=r.id AND p.step_name=${paymentStep}
          AND p.object_type='payment_intent' AND p.cleaned=FALSE
        WHERE r.id=${id} AND r.stripe_account=${account}
          AND r.status='completed' AND r.scenario='basic-store'
      ), inserted AS (
        INSERT INTO dev_run_objects(run_id,step_name,object_type,object_id)
        SELECT id,${refundStep},'refund',${refundId} FROM eligible
        ON CONFLICT DO NOTHING
        RETURNING step_name,object_type,object_id
      )
      SELECT step_name,object_type,object_id FROM inserted
      UNION ALL
      SELECT o.step_name,o.object_type,o.object_id FROM dev_run_objects o
        JOIN eligible e ON e.id=o.run_id
        WHERE o.step_name=${refundStep}
          AND NOT EXISTS (SELECT 1 FROM inserted)`;
      return rows.length===1&&rows[0].object_type==='refund'&&
        rows[0].object_id===refundId;
    },
    async getDevRunObjects({account,id}){
      if(!accountId(account)||!runId(id))throw new TypeError('Valid account/run required');
      const rows=await sql`SELECT o.step_name,o.object_type,o.object_id,o.cleaned,o.created_at
        FROM dev_run_objects o JOIN dev_runs r ON r.id=o.run_id
        WHERE r.stripe_account=${account} AND r.id=${id}
        ORDER BY o.created_at,o.step_name`;
      return rows;
    },
    async recordDevRunObject({account,id,stepName,objectType,objectId}){
      if(!accountId(account)||!runId(id)||
        typeof stepName!=='string'||!/^[a-z0-9_-]{1,70}$/.test(stepName)||
        !idPrefixes[objectType]||
        typeof objectId!=='string'||
        !new RegExp('^'+idPrefixes[objectType]+'_[A-Za-z0-9]{2,100}$').test(objectId))
        throw new TypeError('Verified provider-created run object required');
      const rows=await sql`WITH eligible AS (
        SELECT id FROM dev_runs
        WHERE id=${id} AND stripe_account=${account} AND status='running'
      ), inserted AS (
        INSERT INTO dev_run_objects(run_id,step_name,object_type,object_id)
        SELECT id,${stepName},${objectType},${objectId} FROM eligible
        ON CONFLICT DO NOTHING RETURNING step_name,object_type,object_id
      )
      SELECT step_name,object_type,object_id FROM inserted
      UNION ALL
      SELECT step_name,object_type,object_id FROM dev_run_objects
      WHERE run_id=${id} AND step_name=${stepName}
        AND NOT EXISTS (SELECT 1 FROM inserted)`;
      return rows.length===1&&rows[0].object_type===objectType&&
        rows[0].object_id===objectId;
    },
    async markDevRunObjectCleaned({account,id,stepName,objectType,objectId}){
      if(!accountId(account)||!runId(id)||
        typeof stepName!=='string'||!/^[a-z0-9_-]{1,70}$/.test(stepName)||
        !idPrefixes[objectType]||typeof objectId!=='string'||
        !objectId.startsWith(idPrefixes[objectType]+'_')||
        !/^[A-Za-z0-9_]{3,110}$/.test(objectId))
        throw new TypeError('Exact account-scoped cleanup identity required');
      const rows=await sql`UPDATE dev_run_objects o SET cleaned=TRUE
        FROM dev_runs r WHERE o.run_id=r.id AND r.stripe_account=${account}
          AND r.id=${id} AND o.step_name=${stepName}
          AND o.object_type=${objectType} AND o.object_id=${objectId}
        RETURNING o.object_id`;
      return rows.length===1&&rows[0].object_id===objectId;
    },
    async completeDevRun({account,id,expectedSteps}){
      if(!accountId(account)||!runId(id)||!Number.isInteger(expectedSteps)||
        expectedSteps<1||expectedSteps>50)
        throw new TypeError('Exact expected seeded object count required');
      const rows=await sql`UPDATE dev_runs r SET status='completed',completed_at=now()
        WHERE r.id=${id} AND r.stripe_account=${account} AND r.status='running'
          AND (SELECT count(*)::integer FROM dev_run_objects o
            WHERE o.run_id=r.id AND o.cleaned=FALSE)=${expectedSteps}
        RETURNING r.id`;
      if(rows.length)return true;
      const prior=await sql`SELECT id FROM dev_runs WHERE id=${id}
        AND stripe_account=${account} AND status='completed'`;
      return prior.length===1;
    },
    async listDevRuns({account,limit=20,offset=0}){
      if(!accountId(account)||!Number.isInteger(limit)||limit<1||limit>50||
        !Number.isInteger(offset)||offset<0||offset>100000)
        throw new TypeError('Bounded account-scoped runs query required');
      return sql`SELECT r.id,r.scenario,r.size,r.status,r.created_at,r.completed_at,
        count(o.object_id)::integer AS object_count
        FROM dev_runs r LEFT JOIN dev_run_objects o ON o.run_id=r.id
        WHERE r.stripe_account=${account}
        GROUP BY r.id ORDER BY r.created_at DESC,r.id DESC
        LIMIT ${limit} OFFSET ${offset}`;
    }
  };
}
