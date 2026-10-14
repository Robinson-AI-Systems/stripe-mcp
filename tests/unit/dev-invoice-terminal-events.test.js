import {describe,it,expect} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {verifyTerminalInvoice,verifyTerminalItem,matchesTerminalInvoiceEvent,
  ensureTerminalInvoiceEvent} from '../../src/dev/triggers-invoice-terminal.js';
const account='acct_INVOICE123',customer='cus_INVOICE123',
  invoiceId='in_INVOICE123',itemId='ii_INVOICE123';
const make=type=>planTrigger({type,requestKey:type},account);
const rows=new Map([
  ['customer_1',{object_id:customer}],
  ['invoice_1',{object_id:invoiceId}],
  ['invoice_item_1',{object_id:itemId}]
]);
const invoice=(plan,more={})=>({
  id:invoiceId,object:'invoice',livemode:false,customer,metadata:{
    rtc_run:plan.runId},status:'draft',amount_due:3600,amount_paid:0,
  amount_remaining:3600,currency:'usd',collection_method:'send_invoice',
  ...more
});
const item=plan=>({
  id:itemId,object:'invoiceitem',livemode:false,customer,
  invoice:invoiceId,metadata:{rtc_run:plan.runId},amount:3600,currency:'usd'
});
function fixture(plan){
  const calls=[];let bill=invoice(plan);
  const sdk={
    invoiceItems:{retrieve:async id=>{
      expect(id).toBe(itemId);calls.push('item_read');return item(plan);
    }},
    invoices:{
      retrieve:async id=>{
        expect(id).toBe(invoiceId);calls.push('invoice_read');return {...bill};
      },
      finalizeInvoice:async(id,{auto_advance},opts)=>{
        expect(id).toBe(invoiceId);expect(auto_advance).toBe(false);
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        calls.push('finalize');bill={...bill,status:'open'};return {...bill};
      },
      voidInvoice:async(id,_args,opts)=>{
        expect(id).toBe(invoiceId);
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        calls.push('void');bill={...bill,status:'void'};return {...bill};
      },
      markUncollectible:async(id,_args,opts)=>{
        expect(id).toBe(invoiceId);
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        calls.push('uncollectible');bill={...bill,status:'uncollectible'};
        return {...bill};
      }
    }
  };
  return {sdk,calls,seen:()=>bill,change:x=>{bill=x;}};
}
describe('native audited no-charge TEST invoice terminal Event path',()=>{
  it.each(['invoice.voided','invoice.marked_uncollectible'])(
    '%s requires exact verified invoice/line and safe replay',async type=>{
    const plan=make(type),f=fixture(plan);
    expect(plan.steps.map(x=>x.type)).toEqual([
      'customer','invoice','invoice_item','event'
    ]);
    verifyTerminalItem(plan,item(plan),rows);
    verifyTerminalInvoice(plan,f.seen(),rows);
    await ensureTerminalInvoiceEvent(f.sdk,plan,rows,'rmcp_terminal_test');
    verifyTerminalInvoice(plan,f.seen(),rows,{final:true});
    expect(matchesTerminalInvoiceEvent(plan,f.seen(),{
      id:invoiceId,customer})).toBe(true);
    const actions=f.calls.filter(x=>!x.endsWith('_read')).length;
    await ensureTerminalInvoiceEvent(f.sdk,plan,rows,'rmcp_terminal_test');
    expect(f.calls.filter(x=>!x.endsWith('_read')).toHaveLength(actions);
    expect(matchesTerminalInvoiceEvent(plan,{...f.seen(),livemode:true},{
      id:invoiceId,customer})).toBe(false);
  });
  it('never transitions an already terminal, conflicting invoice state',async()=>{
    const plan=make('invoice.voided'),f=fixture(plan);
    f.change(invoice(plan,{status:'uncollectible'}));
    await expect(ensureTerminalInvoiceEvent(f.sdk,plan,rows,
      'rmcp_terminal_test')).rejects.toThrow();
    expect(f.calls).toEqual(['item_read','invoice_read']);
  });
  it('refuses changed TEST run, account, totals, method, or line provenance',()=>{
    const plan=make('invoice.voided');
    for(const change of [
      {livemode:true},{metadata:{rtc_run:'run_FOREIGN'}},
      {customer:'cus_FOREIGN'},{collection_method:'charge_automatically'},
      {amount_paid:3600},{amount_due:0},{currency:'eur'}
    ])expect(()=>verifyTerminalInvoice(plan,invoice(plan,change),rows))
      .toThrow();
    for(const change of [
      {metadata:{rtc_run:'run_FOREIGN'}},{invoice:'in_FOREIGN'},
      {customer:'cus_FOREIGN'},{amount:0},{currency:'eur'},
      {livemode:true}
    ])expect(()=>verifyTerminalItem(plan,{...item(plan),...change},rows))
      .toThrow();
  });
});
