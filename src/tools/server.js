// Safe account information only. No Stripe key or full provider object is returned.
import { STRIPE_API_VERSION } from '../stripe/client.js';
const schema = { type: 'object', properties: {}, additionalProperties: false };
const profiles = ['read_only','everyday','full'];
export const tools = [
  { name:'stripe_whoami', description:'Read selected Stripe account, profile, masked key, API version and limit.',
    inputSchema:schema, annotations:{readOnlyHint:true}, writes:false, profiles },
  { name:'stripe_list_accounts', description:'List connected Stripe accounts and configured modes, without keys.',
    inputSchema:schema, annotations:{readOnlyHint:true}, writes:false, profiles }
];
const ok = value => ({ content:[{type:'text',text:JSON.stringify(value)}] });
const fail = value => ({ isError:true,content:[{type:'text',text:value}] });
export const handlers = {
  async stripe_whoami(_args,{db,connection}) {
    if (!connection.stripeAccount) return fail('No Stripe account is selected for this connection');
    const row = await db.getStripeAccount(connection.stripeAccount);
    if (!row) return fail('Selected Stripe account is not configured');
    return ok({account:row.id,label:row.label,mode:connection.mode,profile:connection.profile,
      listing:connection.listing,
      keyType:connection.mode === 'test' ? row.test_key_kind : row.live_key_kind,
      keyLast4:connection.mode === 'test' ? row.test_key_last4 : row.live_key_last4,
      stripeApiVersion:STRIPE_API_VERSION,moneyLimitCents:row.money_limit_cents,
      moneyUsedTodayCents:null,moneyTrackingStatus:'Not available until Batch B',
      liveEnabled:row.live_enabled === true});
  },
  async stripe_list_accounts(_args,{db}) {
    const rows = await db.listStripeAccounts();
    return ok({accounts:rows.map(row=>({account:row.id,label:row.label,isDefault:row.is_default===true,
      testConfigured:row.test_connected===true,liveConfigured:row.live_connected===true,
      liveEnabled:row.live_enabled===true}))});
  }
};
