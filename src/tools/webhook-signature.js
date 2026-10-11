// Read-only TEST signature verifier: no secret or raw event body in output.
import {createWebhookSignatureStore,endpointOk} from '../webhooks/signature-store.js';
import {client,reply,fail,fullProfiles} from './billing-shared.js';
const typeOk=x=>typeof x==='string'&&x.length<=100&&
  /^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,75}$/.test(x);
export const tools=[{
  name:'webhook_check_signature',area:'webhooks',writes:false,profiles:fullProfiles,
  annotations:{readOnlyHint:true},
  description:'Verify a TEST webhook payload and Stripe-Signature with an owner-stored secret; returns only safe event identity.',
  inputSchema:{type:'object',properties:{
    endpointId:{type:'string',pattern:'^we_[A-Za-z0-9]{2,100}$'},
    payload:{type:'string',minLength:2,maxLength:65536},
    signature:{type:'string',minLength:15,maxLength:2048}
  },required:['endpointId','payload','signature'],additionalProperties:false}
}];
export const handlers={
  async webhook_check_signature(a,ctx){
    const invalid=()=>fail('Signature not verified for this selected TEST endpoint');
    if(ctx?.connection?.mode!=='test'||!ctx.connection.stripeAccount||
      ctx.connection.profile!=='full'||!a||typeof a!=='object'||
      Object.keys(a).some(k=>!['endpointId','payload','signature'].includes(k))||
      !endpointOk(a.endpointId)||typeof a.payload!=='string'||
      Buffer.byteLength(a.payload,'utf8')>65536||a.payload.length<2||
      typeof a.signature!=='string'||a.signature.length>2048||
      !/^t=\d{1,20},/.test(a.signature))return invalid();
    try{
      const secret=await (ctx.services?.webhookSignatureStore??
        createWebhookSignatureStore({db:ctx.db})).load({
          account:ctx.connection.stripeAccount,endpoint:a.endpointId});
      if(!secret)return invalid();
      const stripe=await client(ctx);
      const event=stripe.webhooks.constructEvent(a.payload,a.signature,secret,300);
      if(event?.livemode!==false||event.account!=null||
        !/^evt_[A-Za-z0-9]{2,100}$/.test(event.id??'')||
        !typeOk(event.type))return invalid();
      return reply({verified:true,mode:'test',endpointId:a.endpointId,
        eventId:event.id,eventType:event.type,
        note:'Signature checked against independently owner-provisioned endpoint secret. Event data withheld.'});
    }catch{return invalid();}
  }
};
