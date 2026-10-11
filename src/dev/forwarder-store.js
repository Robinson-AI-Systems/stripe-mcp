// V-4b1: durable, account-scoped TEST forwarding configuration.
// Signing secrets are encrypted by the caller and NEVER returned in public reads.
import {parseForwardUrl} from './forwarder-security.js';

const fail=x=>{throw new TypeError(x);};
const account=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]+$/.test(x);
const forwarder=x=>typeof x==='string'&&/^fwd_[a-f0-9]{32}$/.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const validTypes=x=>Array.isArray(x)&&x.length>=1&&x.length<=25&&
  x.every(y=>typeof y==='string'&&
    /^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,80}$/.test(y))&&
  new Set(x).size===x.length&&x.every((v,i)=>i===0||x[i-1]<v);
const saneConfig=({accountId,id,requestKey,url,types,configDigest,secretEnc})=>{
  if(!account(accountId)||!forwarder(id)||typeof requestKey!=='string'||
    requestKey.length<1||requestKey.length>128||
    !validTypes(types)||!digest(configDigest)||
    typeof secretEnc!=='string'||!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(secretEnc))
    fail('Valid TEST account, encrypted secret and immutable forwarding configuration required');
  const normalized=parseForwardUrl(url);
  if(normalized.url!==url)fail('Store only canonical public HTTPS forwarder target');
};
export async function initDevForwarderTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS dev_forwarders (
    id TEXT PRIMARY KEY,
    stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
    request_key TEXT NOT NULL,
    config_digest TEXT NOT NULL,
    url TEXT NOT NULL,
    types TEXT[] NOT NULL,
    secret_enc TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    UNIQUE(stripe_account,request_key),
    CHECK(cardinality(types) BETWEEN 1 AND 25)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS dev_forwarders_account_active
    ON dev_forwarders(stripe_account,created_at DESC) WHERE deleted_at IS NULL`;
}
export function createDevForwarderStore(sql){
  return {
    async ensureDevForwarder({accountId,id,requestKey,url,types,
      configDigest,secretEnc}){
      saneConfig({accountId,id,requestKey,url,types,configDigest,secretEnc});
      const inserted=await sql`INSERT INTO dev_forwarders
        (id,stripe_account,request_key,config_digest,url,types,secret_enc)
        VALUES (${id},${accountId},${requestKey},${configDigest},
          ${url},${types}::text[],${secretEnc})
        ON CONFLICT (stripe_account,request_key) DO NOTHING
        RETURNING id,stripe_account,url,types,config_digest,created_at`;
      const rows=inserted.length?inserted:await sql`SELECT id,stripe_account,url,types,
        config_digest,created_at FROM dev_forwarders
        WHERE stripe_account=${accountId} AND request_key=${requestKey}
          AND deleted_at IS NULL`;
      if(rows.length!==1||rows[0].config_digest!==configDigest||
        rows[0].url!==url||rows[0].types?.join('|')!==types.join('|'))
        fail('A retry key belongs to another immutable or deleted forwarder');
      return {id:rows[0].id,stripe_account:rows[0].stripe_account,
        url:rows[0].url,types:rows[0].types,
        created_at:rows[0].created_at,newlyCreated:inserted.length===1};
    },
    async getDevForwarderByRequestKey({accountId,requestKey}){
      if(!account(accountId)||typeof requestKey!=='string'||
        requestKey.length<1||requestKey.length>128)
        fail('Exact TEST account and retry key required');
      const rows=await sql`SELECT id,url,types,config_digest,deleted_at
        FROM dev_forwarders WHERE stripe_account=${accountId}
          AND request_key=${requestKey}`;
      return rows[0]??null;
    },
    async listDevForwarders({accountId,limit=20,offset=0}){
      if(!account(accountId)||!Number.isInteger(limit)||limit<1||limit>50||
        !Number.isInteger(offset)||offset<0||offset>10000)
        fail('Valid TEST account and bounded forwarder listing required');
      return sql`SELECT id,url,types,created_at,last_used_at
        FROM dev_forwarders WHERE stripe_account=${accountId}
          AND deleted_at IS NULL ORDER BY created_at DESC,id
        LIMIT ${limit} OFFSET ${offset}`;
    },
    async getDevForwarder({accountId,id,includeDeleted=false}){
      if(!account(accountId)||!forwarder(id)||typeof includeDeleted!=='boolean')
        fail('Exact account and forwarder ID required');
      const rows=await sql`SELECT id,url,types,created_at,last_used_at,
        deleted_at FROM dev_forwarders WHERE stripe_account=${accountId}
          AND id=${id} AND (${includeDeleted} OR deleted_at IS NULL)`;
      return rows[0]??null;
    },
    async getDevForwarderForDelivery({accountId,id}){
      if(!account(accountId)||!forwarder(id))
        fail('Exact TEST account and forwarder ID required');
      // Internal only. Do not pass to MCP or audit/change-log results.
      const rows=await sql`SELECT id,url,types,secret_enc
        FROM dev_forwarders WHERE stripe_account=${accountId} AND id=${id}
          AND deleted_at IS NULL`;
      return rows[0]??null;
    },
    async deleteDevForwarder({accountId,id}){
      if(!account(accountId)||!forwarder(id))
        fail('Exact TEST account and forwarder ID required');
      const rows=await sql`UPDATE dev_forwarders SET deleted_at=now()
        WHERE stripe_account=${accountId} AND id=${id} AND deleted_at IS NULL
        RETURNING id`;
      return rows.length===1;
    },
    async markDevForwarderUsed({accountId,id}){
      if(!account(accountId)||!forwarder(id))
        fail('Exact TEST account and forwarder ID required');
      const rows=await sql`UPDATE dev_forwarders SET last_used_at=now()
        WHERE stripe_account=${accountId} AND id=${id} AND deleted_at IS NULL
        RETURNING id`;
      return rows.length===1;
    }
  };
}
