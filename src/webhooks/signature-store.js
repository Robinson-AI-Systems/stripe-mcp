// Owner-provisioned signing material stays encrypted and scoped to one TEST endpoint.
import {encryptSecret,decryptSecret,readEncryptionKey} from '../core/crypto.js';
export const accountOk=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
export const endpointOk=x=>typeof x==='string'&&/^we_[A-Za-z0-9]{2,100}$/.test(x);
const signingOk=x=>typeof x==='string'&&/^whsec_[A-Za-z0-9_+\-/=]{12,256}$/.test(x);
const context=(account,endpoint)=>'stripe-webhook-signing/'+account+'/test/'+endpoint;
export function createWebhookSignatureStore({db,encryptionKey=readEncryptionKey()}){
  if(typeof db?.saveWebhookSigningSecret!=='function'||
    typeof db?.getWebhookSigningSecret!=='function')throw new TypeError('Signing store unavailable');
  return {
    async save({account,endpoint,secret}){
      if(!accountOk(account)||!endpointOk(endpoint)||!signingOk(secret))
        throw new TypeError('Exact TEST account, endpoint and signing secret required');
      const ciphertext=encryptSecret(secret,{aad:context(account,endpoint),key:encryptionKey});
      return db.saveWebhookSigningSecret({account,endpoint,ciphertext});
    },
    async load({account,endpoint}){
      if(!accountOk(account)||!endpointOk(endpoint))throw new TypeError('Exact TEST account and endpoint required');
      const row=await db.getWebhookSigningSecret({account,endpoint});
      if(!row?.ciphertext)return null;
      return decryptSecret(row.ciphertext,{aad:context(account,endpoint),key:encryptionKey});
    }
  };
}
export function createOwnerWebhookProvisioner({db,keyStore,makeClient,store}){
  if(!keyStore||typeof makeClient!=='function'||!store)
    throw new TypeError('Owner-only TEST webhook provisioning unavailable');
  return async ({account,endpoint,secret})=>{
    if(!accountOk(account)||!endpointOk(endpoint)||!signingOk(secret))
      throw new TypeError('Invalid TEST webhook credentials');
    const accountRow=await db.getStripeAccount(account);
    if(accountRow?.test_connected!==true)throw new Error('Connected TEST account required');
    const key=await keyStore.loadKey({account,mode:'test'});
    const sdk=makeClient({key,mode:'test'});
    const current=await sdk.webhookEndpoints.retrieve(endpoint);
    if(current?.id!==endpoint||current.object!=='webhook_endpoint'||
      current.livemode!==false||current.application!=null||current.connect===true)
      throw new Error('The endpoint must belong to this TEST account');
    if(await store.save({account,endpoint,secret})!==true)
      throw new Error('Private signing secret could not be saved');
    return {account,endpoint};
  };
}
export function createWebhookSignatureDb(sql){
  return {
    async saveWebhookSigningSecret({account,endpoint,ciphertext}){
      if(!accountOk(account)||!endpointOk(endpoint)||typeof ciphertext!=='string'||
        !/^v1\./.test(ciphertext))throw new TypeError('Encrypted TEST signing secret required');
      const rows=await sql`INSERT INTO webhook_signing_secrets
        (stripe_account,endpoint_id,ciphertext,updated_at)
        VALUES (${account},${endpoint},${ciphertext},now())
        ON CONFLICT (stripe_account,endpoint_id)
        DO UPDATE SET ciphertext=EXCLUDED.ciphertext,updated_at=now()
        RETURNING endpoint_id`;
      return rows.length===1;
    },
    async getWebhookSigningSecret({account,endpoint}){
      if(!accountOk(account)||!endpointOk(endpoint))throw new TypeError('Exact TEST selector required');
      const rows=await sql`SELECT ciphertext FROM webhook_signing_secrets
        WHERE stripe_account=${account} AND endpoint_id=${endpoint}`;
      return rows.length===1?{ciphertext:rows[0].ciphertext}:null;
    }
  };
}
export async function initWebhookSignatureTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS webhook_signing_secrets (
    stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
    endpoint_id TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (stripe_account,endpoint_id)
  )`;
}
