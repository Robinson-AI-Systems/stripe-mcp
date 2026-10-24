// Internal CAP-3 encrypted credential vault. No MCP tool/HTTP route uses this.
// Pending ciphertext is NOT an executable Stripe credential or verified grant.
import { encryptSecret, readEncryptionKey } from '../core/crypto.js';

const modes=new Set(['test','live']);
const kinds=new Set(['account_secret','account_restricted','stripe_app_oauth',
  'connect_oauth','organization_secret']);
const account=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
const grant=x=>typeof x==='string'&&/^grant_[a-f0-9-]{36}$/.test(x);
const denied=reason=>Object.freeze({
  status:'denied',reason,canExecute:false,providerVerified:false
});
const safe=(x,max=3000)=>typeof x==='string'&&x.length>=16&&x.length<=max&&
  !/[\u0000-\u001f\u007f]/.test(x);
const requireSecret=(value,kind,mode)=>{
  if(!safe(value))throw new TypeError('Valid private provider credential expected');
  const pattern=kind==='account_secret'?new RegExp('^sk_'+mode+'_[A-Za-z0-9]+$'):
    kind==='account_restricted'?new RegExp('^rk_'+mode+'_[A-Za-z0-9]+$'):
      kind==='organization_secret'?/^sk_org_[A-Za-z0-9]+$/:null;
  if(pattern&&!pattern.test(value))
    throw new TypeError('Provider credential kind and environment differ');
  // Stripe App and Connect OAuth tokens do not share the account-key prefix.
  // Their real provider signature, issuer, expiry and scopes will be
  // independently verified by the future provider adapter, NOT here.
};
function selected(meta,owned){
  if(!meta||!account(meta.account)||!modes.has(meta.mode)||
     !kinds.has(meta.kind)||!grant(meta.grantId)||
     !owned||!Array.isArray(owned)||owned.length!==1)return false;
  const row=owned[0];
  return row.id===meta.grantId&&row.stripe_account===meta.account&&
    row.mode===meta.mode&&row.kind===meta.kind&&
    row.tenant_id===meta.tenantId&&row.context===meta.context&&
    row.status==='pending_verification';
}
export function credentialAad({tenantId,principalId,context,revision,
  grantId,account:acct,mode,kind}={}){
  if(typeof tenantId!=='string'||!/^tenant_[a-f0-9-]{36}$/.test(tenantId)||
     typeof principalId!=='string'||!/^person_[a-f0-9]{64}$/.test(principalId)||
     !['development','product_admin','production'].includes(context)||
     !Number.isSafeInteger(revision)||revision<1||
     !grant(grantId)||!account(acct)||!modes.has(mode)||!kinds.has(kind))
    throw new TypeError('Exact immutable tenant/person/grant/key context required');
  return ['stripe-provider-grant','v1',tenantId,principalId,context,
    String(revision),grantId,acct,mode,kind].join('/');
}

/** Return ONLY redacted state; never output a credential or its envelope. */
export function createTenantCredentialVault({
  tenancy,encryptionKey=readEncryptionKey()
}={}){
  if(!tenancy||![
    'getMembership','listGrants','insertSealedGrant','rotateSealedGrant',
    'sealedGrantMetadata','revokeSealedGrant'
  ].every(name=>typeof tenancy[name]==='function')||
     !Buffer.isBuffer(encryptionKey)||encryptionKey.length!==32)
    throw new TypeError('Server tenant store and AES-256 key required');

  async function checkOwner(meta){
    if(!meta||!meta.identity||
       typeof meta.tenantId!=='string'||
       !Number.isSafeInteger(meta.revision)||
       !grant(meta.grantId)||!account(meta.account)||
       !modes.has(meta.mode)||!kinds.has(meta.kind))
      return null;
    const member=await tenancy.getMembership({
      tenantId:meta.tenantId,identity:meta.identity,context:meta.context
    });
    if(!member||member.revision!==meta.revision)return null;
    const owned=await tenancy.listGrants({
      tenantId:meta.tenantId,identity:meta.identity,
      context:meta.context,revision:meta.revision,
      account:meta.account,mode:meta.mode
    });
    if(!Array.isArray(owned))return null;
    const row=owned.filter(g=>g.id===meta.grantId);
    if(!selected(meta,row)||member.principal_id!==row[0].principal_id||
       member.tenant_id!==meta.tenantId||member.context!==meta.context||
       row[0].membership_revision!==meta.revision)return null;
    const aad=credentialAad({...meta,principalId:member.principal_id});
    return {aad};
  }
  return Object.freeze({
    async stage(meta){
      const owner=await checkOwner(meta);
      if(!owner)return denied('verified-membership-and-exact-owned-pending-grant-required');
      requireSecret(meta.credential,meta.kind,meta.mode);
      const ciphertext=encryptSecret(meta.credential,{
        aad:owner.aad,key:encryptionKey});
      const saved=await tenancy.insertSealedGrant({...meta,ciphertext});
      return saved
        ?Object.freeze({status:'pending-provider-proof',generation:1,
          canExecute:false,providerVerified:false})
        :denied('credential-already-present-revoked-or-stale');
    },
    async rotate(meta){
      const owner=await checkOwner(meta);
      if(!owner)return denied('verified-membership-and-exact-owned-pending-grant-required');
      if(!Number.isSafeInteger(meta.expectedGeneration)||meta.expectedGeneration<1)
        return denied('expected-generation-required');
      requireSecret(meta.credential,meta.kind,meta.mode);
      const ciphertext=encryptSecret(meta.credential,{
        aad:owner.aad,key:encryptionKey});
      const next=await tenancy.rotateSealedGrant({...meta,ciphertext});
      return next===null?denied('revoked-or-replaced-credential'):
        Object.freeze({status:'pending-provider-proof',generation:next,
          canExecute:false,providerVerified:false});
    },
    async metadata(meta){
      const owner=await checkOwner(meta);
      if(!owner)return denied('verified-membership-and-exact-owned-pending-grant-required');
      const record=await tenancy.sealedGrantMetadata(meta);
      if(!record)return denied('no-current-owned-pending-secret');
      return Object.freeze({status:'pending-provider-proof',
        generation:Number(record.generation),canExecute:false,
        providerVerified:false});
    },
    async revoke(meta){
      const owner=await checkOwner(meta);
      if(!owner)return denied('verified-membership-and-exact-owned-pending-grant-required');
      const revoked=await tenancy.revokeSealedGrant(meta);
      return Object.freeze({status:revoked?'revoked':'not-current',
        canExecute:false,providerVerified:false});
    }
  });
}
