// G-2b2: upload verified public PDF/PNG/JPEG as TEST dispute evidence.
// No evidence bytes in MCP, audit, URLs or previews; upload does not submit a dispute.
import {defineWrite,gone} from './write.js';
import {client,writeProfiles,validateFields} from './billing-shared.js';
import {downloadEvidence,parseEvidenceUrl,MAX_EVIDENCE_BYTES} from '../stripe/evidence-source.js';
const props={sourceUrl:{type:'string',minLength:12,maxLength:2048},
  filename:{type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}\\.(?:pdf|png|jpg|jpeg)$'}};
const validFile=id=>typeof id==='string'&&/^file_[A-Za-z0-9]{2,100}$/.test(id);
export function makeEvidenceUpload({download=downloadEvidence}={}) {
  let createdId=null,expected=null;
  const operation=defineWrite({
    name:'file_upload_evidence',
    read:async(a,ctx)=>{
      validateFields(a,props,['sourceUrl','filename']);
      parseEvidenceUrl(a.sourceUrl);
      if(!new RegExp(props.filename.pattern).test(a.filename))
        throw new TypeError('Provide safe PDF, PNG or JPEG file name');
      const stripe=await client(ctx),account=await stripe.accounts.retrieve();
      if(account?.object!=='account'||account.id!==ctx.connection.stripeAccount||
         account.livemode===true)
        throw new TypeError('Own TEST Stripe account identity unavailable');
      return {...account,metadata:{}};
    },
    summarize:(account,a)=>'TEST MODE: import one public HTTPS PDF, PNG or JPEG (maximum 10 MiB) named '+
      a.filename+' from '+parseEvidenceUrl(a.sourceUrl).hostname+
      ' into dispute evidence storage for account '+account.id+
      '. This does NOT attach or submit a dispute. Confirm only after verifying the source.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const payload=await download(a.sourceUrl,{maxBytes:MAX_EVIDENCE_BYTES});
      const extension=a.filename.split('.').at(-1).toLowerCase();
      if(!payload||!Buffer.isBuffer(payload.buffer)||payload.size!==payload.buffer.length||
        payload.size<8||payload.size>MAX_EVIDENCE_BYTES||
        !['pdf','png','jpg','jpeg'].includes(extension)||
        !(payload.extension===extension||
          (payload.extension==='jpg'&&extension==='jpeg')))
        throw new TypeError('Source bytes did not match declared evidence file type');
      expected=payload.size;
      const stripe=await client(ctx),created=await stripe.files.create({
        purpose:'dispute_evidence',
        file:{data:payload.buffer,name:a.filename,type:payload.mime}
      },{idempotencyKey});
      if(created?.object!=='file'||!validFile(created.id))
        throw new TypeError('Stripe did not return an evidence file identity');
      createdId=created.id;
    },
    readAfter:async(_a,ctx)=>createdId?
      (await client(ctx)).files.retrieve(createdId):null,
    verify:(_before,after,a)=>after?.object==='file'&&after.id===createdId&&
      after.purpose==='dispute_evidence'&&after.livemode!==true&&
      after.filename===a.filename&&after.size===expected&&
      expected>0&&expected<=MAX_EVIDENCE_BYTES
  });
  return {...operation,async handler(args,ctx){
    const result=await operation.handler(args,ctx);
    if(result?.isError||!createdId)return result;
    const parsed=JSON.parse(result.content[0].text);
    if(parsed.confirmed!==true)return result;
    return {...result,content:[{type:'text',text:JSON.stringify({...parsed,
      fileId:createdId,purpose:'dispute_evidence',sizeBytes:expected,
      evidenceSubmitted:false,contentsUrl:null})}]};
  }};
}
export const tools=[{...makeEvidenceUpload().tool,area:'files',
  profiles:writeProfiles,
  description:'Import a public PDF, PNG or JPEG URL into TEST dispute evidence; never submit.',
  inputSchema:{type:'object',properties:{...props,dryRun:{type:'boolean'},
    confirm:{type:'boolean'},requestKey:{type:'string',minLength:1,maxLength:128}},
    required:['sourceUrl','filename'],additionalProperties:false}}];
export const handlers={file_upload_evidence:(a,ctx)=>ctx?.connection?.mode!=='test'?
  gone('Evidence import requires TEST mode'):makeEvidenceUpload().handler(a,ctx)};
