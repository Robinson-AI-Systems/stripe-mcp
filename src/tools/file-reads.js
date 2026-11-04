// G-2b1: file metadata in the connection's own mode, without bearer
// URLs, private content or identity files.
import {allProfiles,guarded,local,pageResult,paging} from './billing-shared.js';
export const fileId=v=>typeof v==='string'&&/^file_[A-Za-z0-9]{2,100}$/.test(v);
export const safePurpose=['dispute_evidence','finance_report_run','business_logo','business_icon'];
export const publicPurpose=['business_logo','business_icon'];
const invalid=msg=>{throw new TypeError(msg);};
export function fileSafe(v,expectId=null,mode=null) {
  // When the caller supplies the connection mode (the file-link write
  // preflight, owner-obedience V2 family 9; the read tools above,
  // CAP-4 D-6), a file verifies only in its own mode: a present
  // livemode must equal that mode. Callers that supply no mode keep
  // the historical check exactly (any livemode===true file is
  // unverified) and the historical refusal wording.
  const modeMismatch=['test','live'].includes(mode)
    ? (typeof v?.livemode==='boolean'&&v.livemode!==(mode==='live'))
    : v?.livemode===true;
  if(v?.object!=='file'||!fileId(v.id)||
     (expectId&&v.id!==expectId)||modeMismatch||
     !safePurpose.includes(v.purpose)||
     !Number.isSafeInteger(v.created)||v.created<946684800||v.created>4102444800||
     !Number.isSafeInteger(v.size)||v.size<0||v.size>1000000000)
    invalid('Verified '+(mode==='live'?'LIVE':'TEST')+
      ' file metadata or permitted purpose unavailable');
  const filename=typeof v.filename==='string'&&v.filename.length<=255&&
    !/[\r\n\0]/.test(v.filename)?v.filename:null;
  const type=typeof v.type==='string'&&/^[a-zA-Z0-9/_.+-]{1,64}$/.test(v.type)?
    v.type:null;
  return {id:v.id,purpose:v.purpose,filename,type,sizeBytes:v.size,
    createdUnix:v.created,createdAt:local(v.created),
    contentsUrl:null,publicUrl:null,bytesIncluded:false};
}
const def=(name,description,props,required=[])=>({
  name,description,area:'files',writes:false,profiles:allProfiles,
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties:props,required,additionalProperties:false}
});
export const tools=[
  def('file_list','List TEST or LIVE file metadata by purpose; no contents links.',{
    purpose:{type:'string',enum:safePurpose},
    limit:{type:'integer',minimum:1,maximum:100},
    starting_after:{type:'string',pattern:'^file_[A-Za-z0-9]{2,100}$'}},['purpose']),
  def('file_get','Read TEST or LIVE file metadata and purpose; no contents or links.',{
    fileId:{type:'string',pattern:'^file_[A-Za-z0-9]{2,100}$'}},['fileId'])
];
function validate(a,keys,required=[]){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!keys.includes(k))||required.some(k=>a[k]===undefined))
    invalid('Exact file read arguments required');
}
export const handlers={
  file_list:(a,ctx)=>guarded(ctx,async s=>{
      validate(a,['purpose','limit','starting_after'],['purpose']);
      if(!safePurpose.includes(a.purpose)||
        (a.starting_after!==undefined&&!fileId(a.starting_after)))
        invalid('Only selected TEST file purposes and cursors may be listed');
      const mode=ctx?.connection?.mode;
      return pageResult(await s.files.list({...paging(a),purpose:a.purpose}),v=>{
        const item=fileSafe(v,null,mode);
        if(item.purpose!==a.purpose)invalid('Provider file purpose mismatch');
        return item;
      });
    }),
  file_get:(a,ctx)=>guarded(ctx,async s=>{
      validate(a,['fileId'],['fileId']);
      if(!fileId(a.fileId))invalid('Exact file ID required');
      return fileSafe(await s.files.retrieve(a.fileId),a.fileId,
        ctx?.connection?.mode);
    })
};
