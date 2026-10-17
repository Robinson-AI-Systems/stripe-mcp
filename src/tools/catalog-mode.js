// Use the original TEST catalog client unchanged. LIVE requires a separately
// owner-enabled account, the actual selected encrypted key, and independent
// Stripe account ID plus balance mode verified by the source-owned factory.
import {client,reply,fail} from './billing-shared.js';
import {selectedAccountClient} from './account-mode.js';
export const catalogMode=ctx=>['test','live'].includes(ctx?.connection?.mode);
export async function catalogClient(ctx){
  if(ctx?.connection?.mode==='test')return client(ctx);
  if(ctx?.connection?.mode==='live')return selectedAccountClient(ctx);
  throw new TypeError('Selected Stripe account/mode required for catalog');
}
export async function guardedCatalog(ctx,reader){
  try{return reply(await reader(await catalogClient(ctx)));}
  catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
}
