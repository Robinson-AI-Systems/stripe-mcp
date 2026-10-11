// G-2b1: create time-limited public links for brand logos/icons only.
// Dispute, financial and identity files MUST NOT become shared links.
import {defineWrite,gone} from './write.js';
import {client,fullProfiles,validateFields} from './billing-shared.js';
import {fileId,fileSafe,publicPurpose} from './file-reads.js';
const props={fileId:{type:'string',pattern:'^file_[A-Za-z0-9]{2,100}$'},
  expiresAt:{type:'integer',minimum:946684800,maximum:4102444800},
  outsideApp:{type:'boolean'}};
function validate(a) {
  validateFields(a,props,['fileId','expiresAt']);
  if(!fileId(a.fileId))throw new TypeError('Valid file ID required');
  const now=Math.floor(Date.now()/1000);
  if(!Number.isSafeInteger(a.expiresAt)||a.expiresAt<=now+60||
     a.expiresAt>now+86400)
    throw new TypeError('A future expiry between 1 minute and 24 hours is required');
}
export function makeFileLinkWrite(){
  let newId=null;
  return defineWrite({
    name:'file_create_link',
    read:async(a,ctx)=>{
      validate(a);
      const s=await client(ctx),f=await s.files.retrieve(a.fileId);
      const safe=fileSafe(f,a.fileId);
      if(!publicPurpose.includes(safe.purpose))
        throw new TypeError('Only public brand assets can receive a shareable link');
      return f;
    },
    summarize:(before,a)=>'TEST MODE: create a public, expiring URL for '+before.purpose+
      ' file '+before.id+' (expires '+new Date(a.expiresAt*1000).toISOString()+
      '). Never use file links for dispute, report or identity documents.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const result=await (await client(ctx)).fileLinks.create({
        file:a.fileId,expires_at:a.expiresAt},{idempotencyKey});
      if(result?.object!=='file_link'||!/^link_[A-Za-z0-9]{2,100}$/.test(result.id))
        throw new TypeError('Created file link identity unverified');
      newId=result.id;
    },
    readAfter:async(_a,ctx)=>newId?
      (await client(ctx)).fileLinks.retrieve(newId):null,
    verify:(before,after,a)=>after?.object==='file_link'&&after.id===newId&&
      (typeof after.file==='string'?after.file:after.file?.id)===before.id&&
      after.expires_at===a.expiresAt&&after.expired===false&&
      typeof after.url==='string'&&
      /^https:\/\/files\.stripe\.com\/links\/[-A-Za-z0-9_]+$/.test(after.url)
  });
}
export const tools=[{...makeFileLinkWrite().tool,
  area:'files',profiles:fullProfiles,
  description:'Create a confirmed, short-lived public link to a TEST brand logo/icon only.',
  inputSchema:{type:'object',properties:{...props,dryRun:{type:'boolean'},
    confirm:{type:'boolean'},requestKey:{type:'string',minLength:1,maxLength:128}},
    required:['fileId','expiresAt'],additionalProperties:false}}];
export const handlers={file_create_link:(a,ctx)=>ctx?.connection?.mode!=='test'?
  gone('Public file link creation requires TEST mode'):makeFileLinkWrite().handler(a,ctx)};
