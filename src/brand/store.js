// H-1: immutable account/mode-scoped Checkout brand kit with optimistic versioning.
// This table contains only public presentation choices and Stripe public file IDs.
const accountValid=a=>typeof a==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(a);
const modeValid=m=>m==='test'||m==='live';
const allowedKeys=['backgroundColor','buttonColor','borderStyle','fontFamily',
  'displayName','logoFileId','iconFileId','submitMessage','termsMessage'];
const fonts=['arial','avenir','courier_new','georgia','helvetica','lato','lucida','open_sans',
  'pt_sans','roboto','source_sans_pro','times_new_roman','ubuntu'];
const borders=['rounded','rectangular','pill'];
const file=v=>typeof v==='string'&&/^file_[A-Za-z0-9]{2,100}$/.test(v);
const hex=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
export function validateBrandKit(input){
  if(!input||Array.isArray(input)||typeof input!=='object'||
    Object.keys(input).length>allowedKeys.length||
    Object.keys(input).some(k=>!allowedKeys.includes(k)))
    throw new TypeError('Brand kit must contain only supported presentation fields');
  const s={};
  for(const [k,v] of Object.entries(input)){
    if(v===null){s[k]=null;continue;}
    if((k==='backgroundColor'||k==='buttonColor')&&!hex(v))
      throw new TypeError('Brand colors must be six-digit hex values');
    if(k==='borderStyle'&&!borders.includes(v))
      throw new TypeError('Unsupported Checkout border style');
    if(k==='fontFamily'&&!fonts.includes(v))
      throw new TypeError('Unsupported Checkout font family');
    if((k==='logoFileId'||k==='iconFileId')&&!file(v))
      throw new TypeError('Brand images require uploaded Stripe file IDs');
    if(k==='displayName'&&
      (typeof v!=='string'||v.trim()!==v||v.length<1||v.length>60||
        /[\x00-\x1f<>]/.test(v)))
      throw new TypeError('Brand display name invalid');
    if((k==='submitMessage'||k==='termsMessage')&&
      (typeof v!=='string'||v.trim()!==v||v.length<1||v.length>300||
        /[\x00-\x1f]/.test(v)))
      throw new TypeError('Brand customer-facing message invalid');
    s[k]=v;
  }
  return Object.freeze(s);
}
export function checkoutBranding(kit,overrides={}){
  const next={...validateBrandKit(kit??{}),...validateBrandKit(overrides)};
  const fields={backgroundColor:'background_color',buttonColor:'button_color',
    borderStyle:'border_style',fontFamily:'font_family',displayName:'display_name',
    logoFileId:'logo',iconFileId:'icon'};
  // Null explicitly clears an override; never forward it as an invalid Stripe
  // file object. The kit is a local default only, not an account-wide change.
  const entries=Object.entries(fields).filter(([k])=>
    !['logoFileId','iconFileId'].includes(k)&&next[k]!==undefined&&next[k]!==null)
    .map(([k,stripeKey])=>[stripeKey,next[k]]);
  // Stripe expressly disallows logo and icon together on one Checkout Session.
  // Prefer an explicit selected override, otherwise favor the saved logo.
  const explicitIcon=Object.hasOwn(overrides,'iconFileId')&&next.iconFileId;
  const chosen=explicitIcon?'icon':next.logoFileId?'logo':next.iconFileId?'icon':null;
  if(chosen){
    const fileId=chosen==='logo'?next.logoFileId:next.iconFileId;
    entries.push([chosen,{type:'file',file:fileId}]);
  }
  return Object.fromEntries(entries);
}
export async function initBrandKitTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS brand_kits (
    stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
    mode TEXT NOT NULL CHECK (mode IN ('test','live')),
    settings JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (stripe_account,mode)
  )`;
}
export function createBrandKitStore(sql){
  return {
    async getBrandKit({account,mode}){
      if(!accountValid(account)||!modeValid(mode))
        throw new TypeError('Selected Stripe account and mode required');
      const rows=await sql`SELECT settings,version,updated_at FROM brand_kits
        WHERE stripe_account=${account} AND mode=${mode}`;
      return rows[0]?{settings:validateBrandKit(rows[0].settings),
        version:Number(rows[0].version),updatedAt:rows[0].updated_at}:null;
    },
    async saveBrandKit({account,mode,settings,expectedVersion}){
      if(!accountValid(account)||mode!=='test'||
        !Number.isSafeInteger(expectedVersion)||expectedVersion<0)
        throw new TypeError('Only selected TEST account with a known kit revision may be changed');
      const canonical=validateBrandKit(settings),value=JSON.stringify(canonical);
      const rows=await sql`INSERT INTO brand_kits(stripe_account,mode,settings,version)
        SELECT id,${mode},${value}::jsonb,1 FROM stripe_accounts
          WHERE id=${account} AND ${expectedVersion}=0
        ON CONFLICT (stripe_account,mode) DO UPDATE SET
          settings=EXCLUDED.settings,version=brand_kits.version+1,updated_at=now()
        WHERE brand_kits.version=${expectedVersion}
          AND brand_kits.settings IS DISTINCT FROM EXCLUDED.settings
        RETURNING settings,version,updated_at`;
      if(rows.length)return {settings:validateBrandKit(rows[0].settings),
        version:Number(rows[0].version),updatedAt:rows[0].updated_at};
      const after=await this.getBrandKit({account,mode});
      if(after&&JSON.stringify(after.settings)===value)return after;
      throw new Error('Brand kit revision changed; refresh before saving again');
    }
  };
}
