// Owner-obedience V2, family 9 (Files): the two file write
// operations were refused at the dispatcher in BOTH modes (the
// `files` area was in neither guarded set) and carried TEST-only
// handler gates. They are now admitted by the dispatcher in both
// modes and complete the confirmed-action sequence in the
// connection's own mode (fake provider + fake database only; no
// LIVE key, no real account, no real file). The aim checks are
// unchanged: the evidence import keeps its public-source, PDF/PNG/
// JPEG and size bounds and never attaches or submits a dispute;
// file links stay scoped to brand-asset files, require expiry and
// withhold the URL if post-creation verification changes. File
// bytes and download URLs surface nowhere they did not surface in
// TEST before.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {isGuardedTestWrite,isGuardedLiveWrite,listingForConnection}
  from '../../src/core/profiles.js';
import {makeEvidenceUpload,tools as evidenceTools,
  handlers as evidenceHandlers} from '../../src/tools/evidence-upload.js';
import {tools as linkTools,handlers as linkHandlers}
  from '../../src/tools/file-links-write.js';

const NAMES=['file_upload_evidence','file_create_link'];
const acct='acct_LIVEFILES';
const fileId='file_FAKE1234',linkId='link_FAKE1234';
const expiresAt=Math.floor(Date.now()/1000)+3600;
const filename='evidence.pdf',sourceUrl='https://public.example.com/document.pdf';
const bytes=Buffer.from('%PDF-1.7\nfixture');
const payload={buffer:bytes,size:bytes.length,extension:'pdf',mime:'application/pdf'};
const parse=r=>JSON.parse(r.content[0].text);
const FINGERPRINT=/^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/;
afterEach(()=>vi.unstubAllEnvs());

describe('V2 Files dispatcher admission (both modes)',()=>{
  const family=registry.tools.filter(t=>NAMES.includes(t.name));
  it('the registry carries exactly the two family tools',()=>{
    expect(family.map(t=>t.name).sort()).toEqual([...NAMES].sort());
    for(const t of family){
      expect(t.area).toBe('files');
      expect(t.writeContract).toBe('defineWrite-v1');
    }
    expect(evidenceTools).toHaveLength(1);
    expect(linkTools).toHaveLength(1);
  });
  it('admits both in TEST for their write profiles, never read_only',()=>{
    const evidence=family.find(t=>t.name==='file_upload_evidence');
    const link=family.find(t=>t.name==='file_create_link');
    expect(isGuardedTestWrite(evidence,{mode:'test',profile:'everyday'})).toBe(true);
    expect(isGuardedTestWrite(evidence,{mode:'test',profile:'full'})).toBe(true);
    expect(isGuardedTestWrite(link,{mode:'test',profile:'full'})).toBe(true);
    // The link tool is full-profile only, exactly as built.
    expect(isGuardedTestWrite(link,{mode:'test',profile:'everyday'})).toBe(false);
    for(const t of family)
      expect(isGuardedTestWrite(t,{mode:'test',profile:'read_only'}),t.name).toBe(false);
  });
  it('admits both in LIVE only on the owner-approved connection',()=>{
    const owner={mode:'live',profile:'full',listing:'catalog',
      context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0};
    for(const t of family){
      expect(isGuardedLiveWrite(t,owner),t.name).toBe(true);
      expect(isGuardedLiveWrite(t,{...owner,rtcLiveOwnerApproved:false}),
        t.name).toBe(false);
    }
    // Neither tool is a money tool: no funding term applies, as built.
    const evidence=family.find(t=>t.name==='file_upload_evidence');
    expect(isGuardedLiveWrite(evidence,{...owner,profile:'everyday'})).toBe(true);
  });
  it('lists both in the TEST catalog and the LIVE owner catalog',()=>{
    const testNames=listingForConnection(registry,
      {mode:'test',profile:'full',listing:'catalog'}).map(t=>t.name);
    const liveNames=listingForConnection(registry,
      {mode:'live',profile:'full',listing:'catalog',context:'customer',
        rtcLiveOwnerApproved:true,moneyLimitCents:0}).map(t=>t.name);
    for(const n of NAMES){
      expect(testNames,n).toContain(n);
      expect(liveNames,n).toContain(n);
    }
  });
});

function testEvidenceFixture(download=vi.fn(async()=>payload)){
  const file={object:'file',id:fileId,purpose:'dispute_evidence',
    filename,size:bytes.length,livemode:false};
  let account={object:'account',id:acct,livemode:false,charges_enabled:true};
  const s={accounts:{retrieve:vi.fn(async()=>({...account}))},
    files:{create:vi.fn(async()=>file),retrieve:vi.fn(async()=>file)}};
  const ctx={connection:{mode:'test',stripeAccount:acct,profile:'everyday'},
    db:createFakeDb(),services:{stripeForConnection:async()=>s}};
  const tool=makeEvidenceUpload({download});
  return {s,ctx,download,call:(a)=>tool.handler(a,ctx),
    drift:()=>{account={...account,charges_enabled:false};}};
}
function liveDb(){
  return createFakeDb({accounts:[{id:acct,label:'Fixture',
    money_limit_cents:100000,live_enabled:true,live_connected:true}]});
}
function liveCtx(db,sdk,profile='full'){
  vi.stubEnv('VERCEL_ENV','production');
  return {db,connectionId:'owner-live',liveAccessGranted:true,
    connection:{stripeAccount:acct,mode:'live',profile,listing:'catalog',
      context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0},
    services:{stripeForConnection:async()=>sdk}};
}

describe('V2 Files TEST reachability and fingerprint binding',()=>{
  it('evidence import dispatches through the handlers export in TEST (gate removed)',async()=>{
    const f=testEvidenceFixture();
    const preview=parse(await evidenceHandlers.file_upload_evidence(
      {sourceUrl,filename,dryRun:true},f.ctx));
    expect(preview.done).toBe(false);
    expect(preview.preview).toContain('TEST MODE');
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    expect(f.download).not.toHaveBeenCalled();
  });
  it('evidence import: preview fingerprint binds the confirmation; drift refuses',async()=>{
    const f=testEvidenceFixture();
    const args={sourceUrl,filename,requestKey:'fp-evidence'};
    const preview=parse(await f.call({...args,dryRun:true}));
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    const fabricated=parse(await f.call({...args,confirm:true,
      previewFingerprint:'WRITE-00000-00000-00000-00000'}));
    expect(fabricated.done).toBe(false);
    expect(f.download).not.toHaveBeenCalled();
    f.drift();
    const drifted=parse(await f.call({...args,confirm:true,
      previewFingerprint:preview.previewFingerprint}));
    expect(drifted.done).toBe(false);
    expect(drifted.previewFingerprint).toMatch(FINGERPRINT);
    expect(drifted.previewFingerprint).not.toBe(preview.previewFingerprint);
    expect(f.download).not.toHaveBeenCalled();
    expect(f.s.files.create).not.toHaveBeenCalled();
    const done=parse(await f.call({...args,confirm:true,
      previewFingerprint:drifted.previewFingerprint}));
    expect(done).toMatchObject({confirmed:true,done:true,fileId,
      evidenceSubmitted:false,contentsUrl:null});
    expect(f.s.files.create).toHaveBeenCalledTimes(1);
  });
  it('file link: preview discloses public reachability and expiry; fingerprint confirms',async()=>{
    const uploaded={object:'file',id:fileId,purpose:'business_logo',size:123,
      created:1680203749,filename:'brand.png',type:'png'};
    const created={object:'file_link',id:linkId,file:fileId,
      expires_at:expiresAt,expired:false,
      url:'https://files.stripe.com/links/FAKELINK123'};
    const stripe={files:{retrieve:vi.fn(async()=>uploaded)},
      fileLinks:{create:vi.fn(async()=>created),
        retrieve:vi.fn(async()=>created)}};
    const ctx={db:createFakeDb(),
      connection:{mode:'test',stripeAccount:acct,profile:'full'},
      services:{stripeForConnection:async()=>stripe}};
    const args={fileId,expiresAt,requestKey:'fp-link'};
    const preview=parse(await linkHandlers.file_create_link(
      {...args,dryRun:true},ctx));
    expect(preview.preview).toContain('TEST MODE');
    expect(preview.preview).toContain('Anyone with the URL can fetch the file'+
      ' until it expires');
    expect(preview.preview).toContain(new Date(expiresAt*1000).toISOString());
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    expect(stripe.fileLinks.create).not.toHaveBeenCalled();
    const fabricated=parse(await linkHandlers.file_create_link(
      {...args,confirm:true,previewFingerprint:'WRITE-00000-00000-00000-00000'},ctx));
    expect(fabricated.done).toBe(false);
    expect(stripe.fileLinks.create).not.toHaveBeenCalled();
    const done=parse(await linkHandlers.file_create_link(
      {...args,confirm:true,previewFingerprint:preview.previewFingerprint},ctx));
    expect(done).toMatchObject({confirmed:true,done:true,
      publicUrl:created.url,expiresAt});
    expect(stripe.fileLinks.create).toHaveBeenCalledTimes(1);
  });
});

describe('V2 Files LIVE on the owner connection (fake provider)',()=>{
  function liveEvidenceSdk({fileMode=true}={}){
    const file={object:'file',id:fileId,purpose:'dispute_evidence',
      filename,size:bytes.length,livemode:fileMode};
    return {accounts:{retrieve:vi.fn(async()=>({object:'account',id:acct,
        livemode:true}))},
      balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:true}))},
      files:{create:vi.fn(async()=>file),retrieve:vi.fn(async()=>file)}};
  }
  it('evidence import completes preview to confirm in LIVE',async()=>{
    const sdk=liveEvidenceSdk();
    const download=vi.fn(async()=>payload);
    const tool=makeEvidenceUpload({download});
    const ctx=liveCtx(liveDb(),sdk,'everyday');
    const args={sourceUrl,filename,requestKey:'live-evidence'};
    const preview=parse(await tool.handler({...args,dryRun:true},ctx));
    expect(preview.mode).toBe('LIVE');
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('real evidence material');
    expect(preview.preview).toContain('issuing bank');
    expect(preview.preview).toContain('does NOT attach or submit a dispute');
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    expect(download).not.toHaveBeenCalled();
    const done=parse(await tool.handler({...args,confirm:true,
      previewFingerprint:preview.previewFingerprint},ctx));
    expect(done).toMatchObject({mode:'LIVE',confirmed:true,done:true,fileId,
      purpose:'dispute_evidence',sizeBytes:bytes.length,
      evidenceSubmitted:false,contentsUrl:null});
    expect(sdk.files.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(done)).not.toContain('https://public.example.com');
    expect(JSON.stringify(done)).not.toContain('%PDF');
  });
  it('evidence import refuses a wrong-mode read-back and a wrong-mode account in LIVE',async()=>{
    const wrongFile=makeEvidenceUpload({download:vi.fn(async()=>payload)});
    const ctxA=liveCtx(liveDb(),liveEvidenceSdk({fileMode:false}),'everyday');
    const unconfirmed=parse(await wrongFile.handler(
      {sourceUrl,filename,confirm:true,requestKey:'live-wrong-file'},ctxA));
    expect(unconfirmed.confirmed).toBe(false);
    expect(unconfirmed).not.toHaveProperty('fileId');
    const wrongAccountSdk=liveEvidenceSdk();
    wrongAccountSdk.accounts.retrieve=vi.fn(async()=>({object:'account',
      id:acct,livemode:false}));
    const download=vi.fn(async()=>payload);
    const tool=makeEvidenceUpload({download});
    const ctxB=liveCtx(liveDb(),wrongAccountSdk,'everyday');
    await expect(tool.handler({sourceUrl,filename,dryRun:true},ctxB))
      .rejects.toThrow();
    expect(download).not.toHaveBeenCalled();
  });
  it('evidence import still refuses a wrong file type in LIVE',async()=>{
    const download=vi.fn(async()=>payload);
    const tool=makeEvidenceUpload({download});
    const ctx=liveCtx(liveDb(),liveEvidenceSdk(),'everyday');
    await expect(tool.handler({sourceUrl,filename:'evidence.exe',
      confirm:true},ctx)).rejects.toThrow();
    expect(download).not.toHaveBeenCalled();
  });
  it('file link completes preview to confirm in LIVE and discloses public reachability',async()=>{
    const liveFile={object:'file',id:fileId,purpose:'business_logo',size:123,
      created:1680203749,filename:'brand.png',type:'png',livemode:true};
    const liveLink={object:'file_link',id:linkId,file:fileId,
      expires_at:expiresAt,expired:false,
      url:'https://files.stripe.com/links/FAKELINK123',livemode:true};
    const stripe={accounts:{retrieve:vi.fn(async()=>({object:'account',
        id:acct,livemode:true}))},
      balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:true}))},
      files:{retrieve:vi.fn(async()=>liveFile)},
      fileLinks:{create:vi.fn(async()=>liveLink),
        retrieve:vi.fn(async()=>liveLink)}};
    const ctx=liveCtx(liveDb(),stripe);
    const args={fileId,expiresAt,requestKey:'live-link'};
    const preview=parse(await linkHandlers.file_create_link(
      {...args,dryRun:true},ctx));
    expect(preview.mode).toBe('LIVE');
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('Anyone with the URL can fetch the file'+
      ' until it expires');
    expect(preview.preview).toContain(new Date(expiresAt*1000).toISOString());
    const done=parse(await linkHandlers.file_create_link(
      {...args,confirm:true,previewFingerprint:preview.previewFingerprint},ctx));
    expect(done).toMatchObject({mode:'LIVE',confirmed:true,done:true,
      publicUrl:liveLink.url,expiresAt,scope:'public_brand_asset_only'});
    expect(stripe.fileLinks.create).toHaveBeenCalledTimes(1);
  });
  it('file link refuses wrong-mode objects in both directions and keeps the brand scope in LIVE',async()=>{
    const liveFile={object:'file',id:fileId,purpose:'business_logo',size:123,
      created:1680203749,filename:'brand.png',type:'png',livemode:true};
    const base={accounts:{retrieve:vi.fn(async()=>({object:'account',
        id:acct,livemode:true}))},
      balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:true}))},
      fileLinks:{create:vi.fn(async()=>({})),retrieve:vi.fn(async()=>({}))}};
    // A TEST file under a LIVE connection refuses at read.
    const testFileSdk={...base,files:{retrieve:vi.fn(async()=>(
      {...liveFile,livemode:false}))}};
    await expect(linkHandlers.file_create_link({fileId,expiresAt,dryRun:true},
      liveCtx(liveDb(),testFileSdk))).rejects.toThrow();
    expect(testFileSdk.fileLinks.create).not.toHaveBeenCalled();
    // A LIVE file under a TEST connection refuses at read.
    const testCtx={db:createFakeDb(),
      connection:{mode:'test',stripeAccount:acct,profile:'full'},
      services:{stripeForConnection:async()=>({files:{
        retrieve:vi.fn(async()=>liveFile)},
        fileLinks:base.fileLinks})}};
    await expect(linkHandlers.file_create_link({fileId,expiresAt,dryRun:true},
      testCtx)).rejects.toThrow();
    // The brand-asset scope guard is unrelaxed in LIVE: evidence files
    // can never receive a public link.
    const evidenceSdk={...base,files:{retrieve:vi.fn(async()=>(
      {...liveFile,purpose:'dispute_evidence'}))}};
    await expect(linkHandlers.file_create_link({fileId,expiresAt,dryRun:true},
      liveCtx(liveDb(),evidenceSdk))).rejects.toThrow();
    expect(evidenceSdk.fileLinks.create).not.toHaveBeenCalled();
  });
  it('file link stays unconfirmed when the created link read-back is wrong-mode',async()=>{
    const liveFile={object:'file',id:fileId,purpose:'business_logo',size:123,
      created:1680203749,filename:'brand.png',type:'png',livemode:true};
    const wrongLink={object:'file_link',id:linkId,file:fileId,
      expires_at:expiresAt,expired:false,
      url:'https://files.stripe.com/links/FAKELINK123',livemode:false};
    const stripe={accounts:{retrieve:vi.fn(async()=>({object:'account',
        id:acct,livemode:true}))},
      balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:true}))},
      files:{retrieve:vi.fn(async()=>liveFile)},
      fileLinks:{create:vi.fn(async()=>wrongLink),
        retrieve:vi.fn(async()=>wrongLink)}};
    const result=parse(await linkHandlers.file_create_link(
      {fileId,expiresAt,confirm:true,requestKey:'live-wrong-link'},
      liveCtx(liveDb(),stripe)));
    expect(result.confirmed).toBe(false);
    expect(result).not.toHaveProperty('publicUrl');
  });
});
