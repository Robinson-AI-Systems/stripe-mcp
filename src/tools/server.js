// Safe account information only. No Stripe key or full provider object is returned.
import { STRIPE_API_VERSION } from '../stripe/client.js';
import { whereIsSetting } from '../data/dashboard-map.js';
import { denverLocalTime } from './util.js';
const schema = { type: 'object', properties: {}, additionalProperties: false };
const profiles = ['read_only','everyday','full'];
export const tools = [
  { name:'stripe_whoami', description:'Read selected Stripe account, profile, masked key, API version and limit.',
    inputSchema:schema, annotations:{readOnlyHint:true}, writes:false, profiles },
  { name:'stripe_list_accounts', description:'List connected Stripe accounts and configured modes, without keys.',
    inputSchema:schema, annotations:{readOnlyHint:true}, writes:false, profiles },
  { name:'stripe_recent_changes', description:'Read safe audit summaries for the selected Stripe account, without snapshots.',
    inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:100},
      mode:{type:'string',enum:['test','live']},offset:{type:'integer',minimum:0}},additionalProperties:false},
    annotations:{readOnlyHint:true},writes:false,profiles },
  { name:'stripe_list_connections', description:'List connection metadata for the selected account, never bearer credentials.',
    inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:50},
      offset:{type:'integer',minimum:0}},
      additionalProperties:false},annotations:{readOnlyHint:true},writes:false,profiles },
  { name:'stripe_where_is_setting', description:'Find owner-only Stripe Dashboard settings with clear steps, not API writes.',
    inputSchema:{type:'object',properties:{setting:{type:'string'}},
      required:['setting'],additionalProperties:false},annotations:{readOnlyHint:true},
    writes:false,profiles }
];
const ok = value => ({ content:[{type:'text',text:JSON.stringify(value)}] });
const MAX_PAGE_BYTES=6200; // Leaves room for the shared output shaper.
const safeCents=value=>{
  const number=Number(value);
  return Number.isSafeInteger(number) && number>=0 ? number : null;
};
function local(value) {
  if (value==null) return null;
  const milliseconds=value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(milliseconds) ? denverLocalTime(Math.floor(milliseconds/1000)) : null;
}
function safeReadRow(row) {
  const value={...row};
  // Long text is explicitly flagged; it is never silently omitted.
  for (const [field,max] of [['summary',480],['target',120],['client_id',160]]) {
    if (typeof value[field]==='string' && value[field].length>max) {
      value[field]=value[field].slice(0,max);
      value[field+'Truncated']=true;
    }
  }
  for (const field of ['at','created_at','last_used_at','expires_at','revoked_at']) {
    const denver=local(value[field]);
    if (denver) value[field+'_local']=denver;
  }
  return value;
}
function pageOf(rows,{account,offset,limit,field,extra={}}) {
  const results=[];
  for(const row of rows) {
    if (results.length>=limit) break;
    const next=safeReadRow(row);
    const payload={account,[field]:[...results,next],...extra,
      hasMore:rows.length>results.length+1,
      nextOffset:offset+results.length+1};
    if (Buffer.byteLength(JSON.stringify(payload),'utf8')>MAX_PAGE_BYTES) break;
    results.push(next);
  }
  const hasMore=rows.length>results.length;
  return {account,[field]:results,...extra,hasMore,
    nextOffset:hasMore?offset+results.length:null,
    maxInlineBytes:8192};
}
const fail = value => ({ isError:true,content:[{type:'text',text:value}] });
export const handlers = {
  async stripe_whoami(_args,{db,connection}) {
    if (!connection.stripeAccount) return fail('No Stripe account is selected for this connection');
    const row = await db.getStripeAccount(connection.stripeAccount);
    if (!row) return fail('Selected Stripe account is not configured');
    const usage=typeof db.getMoneyUsage==='function' ?
      await db.getMoneyUsage({account:connection.stripeAccount,
        connection:connection.clientId || 'status'}) : null;
    return ok({account:row.id,label:row.label,mode:connection.mode,profile:connection.profile,
      listing:connection.listing,
      keyType:connection.mode === 'test' ? row.test_key_kind : row.live_key_kind,
      keyLast4:connection.mode === 'test' ? row.test_key_last4 : row.live_key_last4,
      stripeApiVersion:STRIPE_API_VERSION,currency:'usd',moneyLimitCents:safeCents(row.money_limit_cents),
      moneyUsedTodayCents:usage ? safeCents(usage.used_cents) : null,
      moneyTrackingStatus:usage ? 'Shared account-wide daily total' : 'Not available',
      liveEnabled:row.live_enabled === true});
  },
  async stripe_list_accounts(_args,{db}) {
    const rows = await db.listStripeAccounts();
    return ok({accounts:rows.map(row=>({account:row.id,label:row.label,isDefault:row.is_default===true,
      testConfigured:row.test_connected===true,liveConfigured:row.live_connected===true,
      liveEnabled:row.live_enabled===true}))});
  },
  async stripe_recent_changes(args,{db,connection}) {
    if (!connection.stripeAccount) return fail('Select a Stripe account first');
    if (args?.mode && args.mode!==connection.mode && connection.profile!=='full') {
      return fail('Cross-mode audit inspection requires the full profile');
    }
    const limit=args?.limit??20,offset=args?.offset??0;
    if (!Number.isInteger(limit)||limit<1||limit>50||
        !Number.isInteger(offset)||offset<0||offset>1000000||
        (args?.mode!==undefined&&!['test','live'].includes(args.mode))) {
      return fail('Invalid audit filter');
    }
    const rows=await db.listRecentChanges({account:connection.stripeAccount,
      mode:args?.mode??connection.mode,limit:limit+1,offset});
    return ok(pageOf(rows,{account:connection.stripeAccount,offset,limit,
      field:'changes',extra:{includesRawSnapshots:false}}));
  },
  async stripe_list_connections(args,{db,connection}) {
    if (!connection.stripeAccount) return fail('Select a Stripe account first');
    const limit=args?.limit??20,offset=args?.offset??0;
    if (!Number.isInteger(limit)||limit<1||limit>50||
        !Number.isInteger(offset)||offset<0||offset>1000000) {
      return fail('Invalid connection pagination');
    }
    const rows=await db.listConnectionsForAccount({
      account:connection.stripeAccount,limit:limit+1,offset});
    return ok(pageOf(rows,{account:connection.stripeAccount,offset,limit,
      field:'connections'}));
  },
  async stripe_where_is_setting(args) {
    if (typeof args?.setting !== 'string' || !args.setting || args.setting.length>100) {
      return fail('Choose a supported dashboard setting by name');
    }
    return ok(whereIsSetting(args.setting));
  }
};
