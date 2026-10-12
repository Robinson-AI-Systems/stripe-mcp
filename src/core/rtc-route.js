// Per-request deployment wiring; never reuse a service key or private bearer globally.
import {createDb} from '../db.js';
import {registry} from '../tools/index.js';
import {createStripeForConnection} from '../stripe/provider.js';
import {createPermissionReprobe} from '../keys.js';
import {createRtcReadOnlyHttpHandler} from './rtc-http.js';
import {send} from './http.js';
export async function serveRtc(req,res,route,name){
  try{
    const db=createDb();
    await db.initSchema();
    return await createRtcReadOnlyHttpHandler({db,registry,
      services:{stripeForConnection:createStripeForConnection({db}),
        stripePermissionReprobe:createPermissionReprobe({db})}})(req,res,route,name);
  }catch{return send(res,503,{ok:false,error:{
    code:'service_error',what:'Service temporarily unavailable',
    cause:'Server setup or storage failed',todo:'Retry later.',technical:''}});}
}
