import {describe,it,expect,vi} from 'vitest';
import {registry} from '../../src/tools/index.js';
const JSONresult=data=>({content:[{type:'text',text:JSON.stringify(data)}]});
const parse=result=>JSON.parse(result.content[0].text);
const original={version:1,tool:'product_unarchive',
  args:{productId:'prod_UNDO123'},readTool:'product_get',
  readArgs:{productId:'prod_UNDO123'},
  expected:{active:false},restored:{active:true}};
function fixture({rowInverse=original}={}){
  let active=false;
  const nested=vi.fn(async(name,args)=>{
    if(name==='product_get')
      return JSONresult({id:'prod_UNDO123',active});
    if(name==='product_unarchive'){
      if(args.confirm!==true||args.dryRun!==false)
        return {isError:true,...JSONresult({done:false,error:'Guard rejected'})};
      active=true;
      return JSONresult({done:true,confirmed:true,logged:{id:123}});
    }
    throw new Error('Unreviewed nested tool');
  });
  const db={
    recordChange:vi.fn(async()=>999),
    getUndoCandidate:vi.fn(async()=>({id:22,undone_by:null,
      inverse:rowInverse,dry_run:false,amount_cents:null,direction:null})),
    claimUndoCandidate:vi.fn(async()=>true),
    finishUndoCandidate:vi.fn(async()=>true)
  };
  const conn={stripeAccount:'acct_UNDO123',mode:'test',profile:'full'};
  return {db,nested,conn,ctx:{db,registry,connection:conn,
    connectionId:'safe-undo',runRead:nested}};
}
describe('X-1 immutable source inverse and bounded nested original write',()=>{
  it('previews without any permanent claim or nested mutation',async()=>{
    const f=fixture();
    const response=await registry.handlers.stripe_undo_change({
      changeId:22,dryRun:true,requestKey:'preview'},f.ctx);
    expect(parse(response)).toMatchObject({done:false,needsConfirmation:true});
    expect(f.db.claimUndoCandidate).not.toHaveBeenCalled();
    expect(f.nested.mock.calls.filter(([name])=>name==='product_unarchive'))
      .toHaveLength(0);
  });
  it('hash-bounds a 110-char owner key before atomic claim and links verified original',async()=>{
    const f=fixture();
    const result=await registry.handlers.stripe_undo_change({
      changeId:22,confirm:true,requestKey:'A'.repeat(110)},f.ctx);
    expect(parse(result).done).toBe(true);
    const write=f.nested.mock.calls.find(([name])=>name==='product_unarchive');
    expect(write[1].requestKey.length).toBeLessThan(128);
    expect(write[1].requestKey).toMatch(/^undo-22-[a-f0-9]{32}$/);
    expect(f.db.claimUndoCandidate).toHaveBeenCalledTimes(1);
    expect(f.db.finishUndoCandidate).toHaveBeenCalledWith({
      account:'acct_UNDO123',mode:'test',id:22,undoId:123});
  });
  it('refuses unsound or unsupported inverse before claiming anything',async()=>{
    const f=fixture({rowInverse:{...original,tool:'money_create_payout'}});
    const out=await registry.handlers.stripe_undo_change({
      changeId:22,confirm:true,requestKey:'refused'},f.ctx);
    expect(out.isError).toBe(true);
    expect(f.db.claimUndoCandidate).not.toHaveBeenCalled();
  });
  it('never writes in read_only mode',async()=>{
    const f=fixture();
    f.ctx.connection={...f.conn,profile:'read_only'};
    const out=await registry.handlers.stripe_undo_change({
      changeId:22,confirm:true},f.ctx);
    expect(out.isError).toBe(true);
    expect(f.db.claimUndoCandidate).not.toHaveBeenCalled();
  });
});
