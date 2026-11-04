// Shared owner administration read transport; never use for writes.
// CAP-4 D-7: the gate is mode-aware — the requirement is a connected
// account in the connection's own mode (TEST or LIVE), verified; the
// refusal names the connection's mode (generic when no valid mode is
// selected), so a TEST refusal stays byte-identical to the historical
// text and a LIVE refusal never claims only a TEST account qualifies.
export function requireAdminAccount(ctx){
  const mode=ctx?.connection?.mode,id=ctx?.connection?.stripeAccount;
  if(!['test','live'].includes(mode)||typeof id!=='string'||
    !/^acct_[A-Za-z0-9]{2,100}$/.test(id))
    throw new TypeError('Select a connected '+
      (['test','live'].includes(mode)?mode.toUpperCase():'TEST or LIVE')+
      ' Stripe account');
  return {account:id,mode};
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
// The read-only account_get handler must independently establish the selected
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
