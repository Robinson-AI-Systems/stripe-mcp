// Native TEST webhook code retains its original verified endpoint guards.
// LIVE additionally requires the service-owned selected account/key and two
// independent Stripe account identity and LIVE balance facts on every call.
import {client,reply,fail} from './billing-shared.js';
import {selectedAccountClient} from './account-mode.js';
export const isWebhookMode=ctx=>['test','live'].includes(ctx?.connection?.mode);
export async function webhookClient(ctx){
  if(ctx?.connection?.mode==='test')return client(ctx);
  if(ctx?.connection?.mode==='live')return selectedAccountClient(ctx);
  throw new TypeError('Authenticated Stripe environment required');
}
export async function guardedWebhook(ctx,read){
  try{return reply(await read(await webhookClient(ctx)));}
  catch(error){if(error instanceof TypeError)return fail(error.message);throw error;}
}
