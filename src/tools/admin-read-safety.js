// Shared TEST owner administration read transport; never use for writes.
export function requireAdminTestAccount(ctx){
  const id=ctx?.connection?.stripeAccount;
  if(ctx?.connection?.mode!=='test'||typeof id!=='string'||
    !/^acct_[A-Za-z0-9]{2,100}$/.test(id))
    throw new TypeError('Select a connected TEST Stripe account');
  return id;
}
export function validateAdminArgs(a,allowed=[]){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!allowed.includes(k)))
    throw new TypeError('Unsupported owner read arguments');
}
export function parseAdminReply(r){
  if(r?.isError||!Array.isArray(r?.content)||r.content.length!==1||
    typeof r.content[0]?.text!=='string')return null;
  try{
    const v=JSON.parse(r.content[0].text);
    return v&&typeof v==='object'&&!Array.isArray(v)?v:null;
  }catch{return null;}
}
// The read-only account_get handler must independently establish the selected TEST
// Stripe account, not merely echo a connection ID on permission refusal.
export function verifiedAdminIdentity(value,account){
  return typeof account==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(account)&&
    value?.id===account&&value?.available!==false&&
    typeof value.chargesEnabled==='boolean'&&
    typeof value.payoutsEnabled==='boolean'&&
    typeof value.detailsSubmitted==='boolean'&&
    ['ok','needs_attention','not_readable'].includes(value.verification);
}
export async function readAdminTool(handler,args,ctx){
  try{return parseAdminReply(await handler(args,ctx));}
  catch{return null;}
}
