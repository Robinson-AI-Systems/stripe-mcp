// Server-internal CAP-3 tenant authority foundation.
// NOT an authentication endpoint, provider-token store, or usable Stripe credential.
// A verified OIDC adapter must establish issuer+subject before calling provisionTenant.
import { createHash, randomUUID, randomBytes } from 'node:crypto';

const account=id=>typeof id==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(id);
const contexts=new Set(['development','product_admin','production']);
const roles=new Set(['owner','administrator','member','developer']);
const kinds=new Set(['account_secret','account_restricted','stripe_app_oauth',
  'connect_oauth','organization_secret']);
const modes=new Set(['test','live']);
const uuid=()=>randomUUID();
const sha=x=>createHash('sha256').update(x).digest('hex');
const text=(v,max=128)=>typeof v==='string'&&v.length>0&&v.length<=max&&
  !/[\u0000-\u001f\u007f]/.test(v);
const safeOrigin=value=>{
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&
    !u.password&&!u.search&&!u.hash&&!u.pathname?.replace(/\//g,'')&&
    u.origin===value;}
  catch{return false;}
};
const error=why=>{throw new TypeError('Tenant authority: '+why);};
const only=(value,keys)=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).some(k=>!keys.includes(k)))error('unreviewed or sensitive fields');
};
function principal(input){
  only(input,['issuer','subject']);
  if(!safeOrigin(input.issuer)||!text(input.subject,256))error('verified OIDC identity expected');
  return {id:'person_'+sha(input.issuer+'\0'+input.subject),
    issuer:input.issuer,subjectHash:sha(input.subject)};
}
function selector({tenantId,identity,context,revision}){
  if(!text(tenantId,70)||!/^tenant_[a-f0-9-]{36}$/.test(tenantId)||
    !contexts.has(context)||!Number.isSafeInteger(revision)||revision<1)
    error('exact member selector and revision required');
  return {...principal(identity),tenantId,context,revision};
}
const REDACTED_FIELDS=['id','tenant_id','principal_id','context',
  'stripe_account','mode','kind','provider_issuer','provider_resource',
  'status','membership_revision','created_at','expires_at','revoked_at'];
function redact(row){
  if(!row)return null;
  return Object.fromEntries(REDACTED_FIELDS.map(k=>[k,row[k]??null]));
}
function descriptor(input) {
  only(input,['tenantId','identity','context','revision','account','mode','kind',
    'providerIssuer','providerResource','expiresAt']);
  const s=selector(input);
  if(!account(input.account)||!modes.has(input.mode)||!kinds.has(input.kind)||
    !safeOrigin(input.providerIssuer)||!text(input.providerResource,256)||
    !input.providerResource.startsWith('https://')||
    (input.expiresAt!=null&&(!Number.isFinite(new Date(input.expiresAt).getTime())||
      new Date(input.expiresAt).getTime()<=Date.now())))
    error('exact Stripe account, provider issuer, resource and mode required');
  return {...s,account:input.account,mode:input.mode,kind:input.kind,
    providerIssuer:input.providerIssuer,providerResource:input.providerResource,
    expiresAt:input.expiresAt==null?null:new Date(input.expiresAt)};
}

export const TENANCY_TABLES=Object.freeze(['tenancy_principals','tenancy_tenants',
  'tenancy_memberships','tenancy_grants','tenancy_auth_intents']);
export async function initTenancyTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS tenancy_principals (
    id TEXT PRIMARY KEY, issuer TEXT NOT NULL, subject_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(issuer,subject_hash))`;
  await sql`CREATE TABLE IF NOT EXISTS tenancy_tenants (
    id TEXT PRIMARY KEY, label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS tenancy_memberships (
    tenant_id TEXT NOT NULL REFERENCES tenancy_tenants(id),
    principal_id TEXT NOT NULL REFERENCES tenancy_principals(id),
    context TEXT NOT NULL CHECK(context IN ('development','product_admin','production')),
    role TEXT NOT NULL CHECK(role IN ('owner','administrator','member','developer')),
    revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(tenant_id,principal_id,context))`;
  await sql`CREATE TABLE IF NOT EXISTS tenancy_grants (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, principal_id TEXT NOT NULL,
    context TEXT NOT NULL, membership_revision INTEGER NOT NULL CHECK(membership_revision>0),
    stripe_account TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('test','live')),
    kind TEXT NOT NULL, provider_issuer TEXT NOT NULL,
    provider_resource TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending_verification'
      CHECK(status IN ('pending_verification','verified','revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
    FOREIGN KEY(tenant_id,principal_id,context)
      REFERENCES tenancy_memberships(tenant_id,principal_id,context))`;
  await sql`CREATE INDEX IF NOT EXISTS tenancy_grants_owner_idx ON
    tenancy_grants(tenant_id,principal_id,context,stripe_account,mode)`;
  await sql`CREATE TABLE IF NOT EXISTS tenancy_auth_intents (
    state_hash TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, principal_id TEXT NOT NULL,
    context TEXT NOT NULL, membership_revision INTEGER NOT NULL,
    kind TEXT NOT NULL, stripe_account TEXT NOT NULL, mode TEXT NOT NULL,
    client_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY(tenant_id,principal_id,context)
      REFERENCES tenancy_memberships(tenant_id,principal_id,context))`;
  await sql`CREATE INDEX IF NOT EXISTS tenancy_auth_intents_expiry_idx ON
    tenancy_auth_intents(expires_at)`;
}
export function createTenancyStore(sql){
  if(typeof sql!=='function')error('tagged SQL implementation required');
  return {
    // Internal-only migration entry point; callers must not expose it as an API.
    initializeTables:()=>initTenancyTables(sql),
    // ONLY the eventual trusted OIDC callback may call this; never a public
    // route accepting issuer/subject strings from a user or Stripe account grant.
    async provisionTenant({verifiedIdentity,label,context='production'}){
      const id=principal(verifiedIdentity),tenantId='tenant_'+uuid();
      if(!text(label,100)||!contexts.has(context))
        error('valid tenant display name and context required');
      const rows=await sql`WITH identity AS (
        INSERT INTO tenancy_principals(id,issuer,subject_hash)
        VALUES(${id.id},${id.issuer},${id.subjectHash})
        ON CONFLICT(id) DO UPDATE SET issuer=EXCLUDED.issuer
        RETURNING id
      ), tenant AS (
        INSERT INTO tenancy_tenants(id,label) VALUES(${tenantId},${label})
        RETURNING id
      )
      INSERT INTO tenancy_memberships(tenant_id,principal_id,context,role)
      SELECT tenant.id,identity.id,${context},'owner'
      FROM tenant CROSS JOIN identity RETURNING tenant_id,principal_id,revision,context,role`;
      if(rows.length!==1)throw new Error('Tenant identity creation was not committed');
      return {tenantId,principalId:id.id,revision:1,context,role:'owner'};
    },
    async getMembership({tenantId,identity,context}){
      if(!text(tenantId,70)||!contexts.has(context))error('invalid tenant/context');
      const p=principal(identity);
      const rows=await sql`SELECT tenant_id,principal_id,context,role,revision
        FROM tenancy_memberships WHERE tenant_id=${tenantId}
        AND principal_id=${p.id} AND context=${context} AND active=TRUE`;
      return rows[0]??null;
    },
    async addMember({actor,memberIdentity,role,context}){
      const a=selector(actor),p=principal(memberIdentity);
      if(!roles.has(role)||context!==a.context||role==='owner'||
     (role==='developer'&&context!=='development'))
        error('owner grants require a separate verified ownership transfer');
      // Only the existing current owner can add active roles to the same tenant.
      const rows=await sql`WITH actor AS (
        SELECT 1 FROM tenancy_memberships
        WHERE tenant_id=${a.tenantId} AND principal_id=${a.id}
        AND context=${a.context} AND revision=${a.revision}
        AND active=TRUE AND role='owner'
      ), identity AS (
        INSERT INTO tenancy_principals(id,issuer,subject_hash)
        SELECT ${p.id},${p.issuer},${p.subjectHash} FROM actor
        ON CONFLICT(id) DO UPDATE SET issuer=EXCLUDED.issuer RETURNING id
      )
      INSERT INTO tenancy_memberships(tenant_id,principal_id,context,role)
      SELECT ${a.tenantId},identity.id,${context},${role} FROM identity
      ON CONFLICT(tenant_id,principal_id,context) DO NOTHING
      RETURNING principal_id,role,revision`;
      return rows.length===1;
    },
    async revokeMember({actor,targetIdentity,context,expectedRevision}){
      const a=selector(actor),target=principal(targetIdentity);
      if(context!==a.context||target.id===a.id||
         !Number.isSafeInteger(expectedRevision)||expectedRevision<1)
        error('independent member and expected membership revision required');
      const rows=await sql`UPDATE tenancy_memberships m SET
        active=FALSE,revision=m.revision+1,updated_at=now()
      WHERE m.tenant_id=${a.tenantId} AND m.principal_id=${target.id}
        AND m.context=${context} AND m.active=TRUE
        AND m.revision=${expectedRevision}
        AND EXISTS (SELECT 1 FROM tenancy_memberships actor
          WHERE actor.tenant_id=${a.tenantId} AND actor.principal_id=${a.id}
          AND actor.context=${a.context} AND actor.revision=${a.revision}
          AND actor.active=TRUE AND actor.role='owner')
      RETURNING m.revision`;
      return rows.length===1;
    },
    async stageGrant(input){
      const g=descriptor(input),grantId='grant_'+uuid();
      // A staged descriptor contains NO keys and can NEVER be used for a
      // provider request. Provider verified grants require later OAuth proof.
      const rows=await sql`INSERT INTO tenancy_grants
        (id,tenant_id,principal_id,context,membership_revision,
         stripe_account,mode,kind,provider_issuer,provider_resource,expires_at)
      SELECT ${grantId},${g.tenantId},${g.id},${g.context},${g.revision},
        ${g.account},${g.mode},${g.kind},${g.providerIssuer},
        ${g.providerResource},${g.expiresAt}
      FROM tenancy_memberships m
      WHERE m.tenant_id=${g.tenantId} AND m.principal_id=${g.id}
        AND m.context=${g.context} AND m.revision=${g.revision}
        AND m.active=TRUE
      RETURNING id,tenant_id,principal_id,context,stripe_account,mode,kind,status`;
      return rows.length===1?redact(rows[0]):null;
    },
    async listGrants({tenantId,identity,context,revision,account,mode}){
      const a=selector({tenantId,identity,context,revision});
      if(account!=null&&!accountId(account))error('invalid account filter');
      if(mode!=null&&!modes.has(mode))error('invalid mode filter');
      const rows=await sql`SELECT g.id,g.tenant_id,g.principal_id,g.context,
        g.stripe_account,g.mode,g.kind,g.provider_issuer,g.provider_resource,
        g.status,g.membership_revision,g.created_at,g.expires_at,g.revoked_at
      FROM tenancy_grants g JOIN tenancy_memberships m
        ON m.tenant_id=g.tenant_id AND m.principal_id=g.principal_id
          AND m.context=g.context
      WHERE g.tenant_id=${a.tenantId} AND g.principal_id=${a.id}
        AND g.context=${a.context} AND g.membership_revision=m.revision
        AND m.revision=${a.revision} AND m.active=TRUE
        AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>now())
        AND (${account??null} IS NULL OR g.stripe_account=${account??null})
        AND (${mode??null} IS NULL OR g.mode=${mode??null})
      ORDER BY g.created_at DESC,g.id LIMIT 100`;
      return rows.map(redact);
    },
    async revokeGrant({tenantId,identity,context,revision,grantId}){
      const a=selector({tenantId,identity,context,revision});
      if(!/^grant_[a-f0-9-]{36}$/.test(grantId??''))
        error('valid exact owned grant ID required');
      const rows=await sql`UPDATE tenancy_grants g SET
        revoked_at=now(),status='revoked'
      WHERE g.id=${grantId} AND g.tenant_id=${a.tenantId}
        AND g.principal_id=${a.id} AND g.context=${a.context}
        AND g.revoked_at IS NULL
        AND EXISTS(SELECT 1 FROM tenancy_memberships m
          WHERE m.tenant_id=g.tenant_id AND m.principal_id=g.principal_id
          AND m.context=g.context AND m.revision=${a.revision}
          AND m.active=TRUE AND g.membership_revision=m.revision)
      RETURNING g.id`;
      return rows.length===1;
    },
    async issueIntent({tenantId,identity,context,revision,account,mode,kind,clientId}){
      const a=selector({tenantId,identity,context,revision});
      if(!accountId(account)||!modes.has(mode)||!kinds.has(kind)||
         !text(clientId,128))error('bounded exact OAuth intent required');
      const state=randomBytes(32).toString('base64url'),hash=sha(state);
      const rows=await sql`INSERT INTO tenancy_auth_intents
        (state_hash,tenant_id,principal_id,context,membership_revision,
         kind,stripe_account,mode,client_id,expires_at)
      SELECT ${hash},${a.tenantId},${a.id},${a.context},${a.revision},
        ${kind},${account},${mode},${clientId},now()+interval '10 minutes'
      FROM tenancy_memberships m WHERE m.tenant_id=${a.tenantId}
        AND m.principal_id=${a.id} AND m.context=${a.context}
        AND m.active=TRUE AND m.revision=${a.revision}
      RETURNING state_hash`;
      return rows.length===1?{state,expiresInSeconds:600}:null;
    },
    async consumeIntent({state,tenantId,identity,context,revision,clientId}){
      const a=selector({tenantId,identity,context,revision});
      if(typeof state!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(state)||
         !text(clientId,128))return null;
      // One statement consumes state atomically; losing membership, wrong
      // browser/client/tenant or concurrent exchanges never return a grant.
      const rows=await sql`UPDATE tenancy_auth_intents i SET consumed_at=now()
      WHERE i.state_hash=${sha(state)} AND i.consumed_at IS NULL
        AND i.expires_at>now() AND i.tenant_id=${a.tenantId}
        AND i.principal_id=${a.id} AND i.context=${a.context}
        AND i.membership_revision=${a.revision} AND i.client_id=${clientId}
        AND EXISTS (SELECT 1 FROM tenancy_memberships m
          WHERE m.tenant_id=i.tenant_id AND m.principal_id=i.principal_id
          AND m.context=i.context AND m.revision=i.membership_revision
          AND m.active=TRUE)
      RETURNING i.stripe_account,i.mode,i.kind,i.client_id`;
      return rows[0]??null;
    }
  };
}
function accountId(id){return account(id);}
