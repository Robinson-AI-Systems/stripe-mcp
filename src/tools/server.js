// Safe account information only. No Stripe key or full provider object is returned.
import { STRIPE_API_VERSION } from '../stripe/client.js';
import { whereIsSetting } from '../data/dashboard-map.js';
const schema = { type: 'object', properties: {}, additionalProperties: false };
const profiles = ['read_only','everyday','full'];
export const tools = [
  { name:'stripe_whoami', description:'Read selected Stripe account, profile, masked key, API version and limit.',
    inputSchema:schema, annotations:{readOnlyHint:true}, writes:false, profiles },
  { name:'stripe_list_accounts', description:'List connected Stripe accounts and configured modes, without keys.',
    inputSchema:schema, annotations:{readOnlyHint:true}, writes:false, profiles },
  { name:'stripe_recent_changes', description:'Read safe audit summaries for the selected Stripe account, without snapshots.',
    inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:100},
      mode:{type:'string',enum:['test','live']}},additionalProperties:false},
    annotations:{readOnlyHint:true},writes:false,profiles },
  { name:'stripe_list_connections', description:'List connection metadata for the selected account, never bearer credentials.',
    inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:100}},
      additionalProperties:false},annotations:{readOnlyHint:true},writes:false,profiles },
  { name:'stripe_where_is_setting', description:'Find owner-only Stripe Dashboard settings with clear steps, not API writes.',
    inputSchema:{type:'object',properties:{setting:{type:'string'}},
      required:['setting'],additionalProperties:false},annotations:{readOnlyHint:true},
    writes:false,profiles }
];
const ok = value => ({ content:[{type:'text',text:JSON.stringify(value)}] });
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
      stripeApiVersion:STRIPE_API_VERSION,moneyLimitCents:row.money_limit_cents,
      moneyUsedTodayCents:usage ? Number(usage.used_cents) : null,
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
    if (args?.mode && args.mode!==connection.mode && connection.profile!=='full')
      return fail('Cross-mode audit inspection requires the full profile');
    if (!Number.isInteger(args?.limit??20) || (args?.limit??20)<1 ||
        (args?.limit??20)>100 || (args?.mode!==undefined &&
        !['test','live'].includes(args.mode))) return fail('Invalid audit filter');
    const changes=await db.listRecentChanges({account:connection.stripeAccount,
      mode:args?.mode??connection.mode,limit:args?.limit??20});
    return ok({account:connection.stripeAccount,changes,includesRawSnapshots:false});
  },
  async stripe_list_connections(args,{db,connection}) {
    if (!connection.stripeAccount) return fail('Select a Stripe account first');
    if (!Number.isInteger(args?.limit??50) || (args?.limit??50)<1 ||
        (args?.limit??50)>100) return fail('Invalid connection limit');
    const connections=await db.listConnectionsForAccount({
      account:connection.stripeAccount,limit:args?.limit??50});
    return ok({account:connection.stripeAccount,connections});
  },
  async stripe_where_is_setting(args) {
    if (typeof args?.setting !== 'string' || !args.setting || args.setting.length>100) {
      return fail('Choose a supported dashboard setting by name');
    }
    return ok(whereIsSetting(args.setting));
  }
};
