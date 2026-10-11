// Durable TEST webhook creation intent: reserve before Stripe, never retry an uncertain POST.
// Holds no provider secrets, signing material, destination auth tokens or private query values.
const validAccount=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]+$/.test(x);
const validKey=x=>typeof x==='string'&&x.length>=1&&x.length<=128;
const validDigest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const validEndpoint=x=>typeof x==='string'&&/^we_[A-Za-z0-9]{2,100}$/.test(x);
function inputs(p){
  if(!validAccount(p.accountId)||!validKey(p.requestKey)||!validDigest(p.digest))
    throw new TypeError('Selected account, stable key and exact config digest required');
}
export function createWebhookCreationStore(sql){
  return {
    async reserveWebhookCreate(p){
      inputs(p);
      const rows=await sql`INSERT INTO webhook_create_intents
        (stripe_account,request_key,config_digest,state)
        VALUES (${p.accountId},${p.requestKey},${p.digest},'reserved')
        ON CONFLICT (stripe_account,request_key) DO NOTHING
        RETURNING request_key`;
      if(rows.length===1)return {newlyReserved:true,state:'reserved',endpointId:null};
      const found=await sql`SELECT config_digest,state,endpoint_id FROM webhook_create_intents
        WHERE stripe_account=${p.accountId} AND request_key=${p.requestKey}`;
      if(found.length!==1||found[0].config_digest!==p.digest)
        throw new TypeError('Webhook create retry key belongs to a different configuration');
      return {newlyReserved:false,state:found[0].state,endpointId:found[0].endpoint_id};
    },
    async completeWebhookCreate(p){
      inputs(p);
      if(!validEndpoint(p.endpointId))throw new TypeError('Verified Stripe endpoint required');
      const rows=await sql`UPDATE webhook_create_intents SET state='confirmed',
        endpoint_id=${p.endpointId},updated_at=now()
        WHERE stripe_account=${p.accountId} AND request_key=${p.requestKey}
          AND config_digest=${p.digest} AND state='reserved'
        RETURNING endpoint_id`;
      return rows.length===1;
    },
    async getWebhookCreate(p){
      inputs(p);
      const rows=await sql`SELECT state,endpoint_id,config_digest
        FROM webhook_create_intents WHERE stripe_account=${p.accountId}
          AND request_key=${p.requestKey}`;
      if(rows.length===0)return null;
      if(rows[0].config_digest!==p.digest)
        throw new TypeError('Webhook create retry key configuration changed');
      return {state:rows[0].state,endpointId:rows[0].endpoint_id};
    }
  };
}
export async function initWebhookCreationTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS webhook_create_intents (
    stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
    request_key TEXT NOT NULL,
    config_digest TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('reserved','confirmed')),
    endpoint_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (stripe_account,request_key)
  )`;
}
