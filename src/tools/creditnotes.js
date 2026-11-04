// D-5c credit note reads in the connection's own mode (CAP-4 D-3)
// and exact Stripe accounting preview.
import {allProfiles,guarded,id,paging,pageResult,checkId} from './billing-shared.js';
import {safeCredit,creditPreflight,creditReasons,creditAllocation,
  creditAmount,creditMemo} from './creditnote-shared.js';
const page={limit:{type:'integer',minimum:1,maximum:100},
  starting_after:{type:'string',minLength:2,maxLength:110}};
const def=(name,description,properties={},required=[])=>({
  name,description,area:'invoices',profiles:allProfiles,writes:false,
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties,required,additionalProperties:false}
});
export const tools=[
  def('creditnote_list','List verified USD credit notes in the connection mode with bounded pagination.',{
    ...page,invoiceId:id('in'),customerId:id('cus')}),
  def('creditnote_get','Read one verified USD credit note in the connection mode without secrets.',
    {creditNoteId:id('cn')},['creditNoteId']),
  def('creditnote_preview','Preview a credit note in the connection mode with exact refund and credit allocations.',{
    invoiceId:id('in'),amountCents:creditAmount,reason:creditReasons,
    allocation:creditAllocation,memo:creditMemo
  },['invoiceId','amountCents','reason','allocation'])
];
export const handlers={
  creditnote_list:(a,ctx)=>guarded(ctx,async s=>pageResult(
    await s.creditNotes.list({...paging(a),
      ...(a?.invoiceId?{invoice:checkId(a.invoiceId,'in')}:{}),
      ...(a?.customerId?{customer:checkId(a.customerId,'cus')}:{}),
    }),v=>safeCredit(v,ctx?.connection?.mode))),
  creditnote_get:(a,ctx)=>guarded(ctx,async s=>
    safeCredit(await s.creditNotes.retrieve(checkId(a?.creditNoteId,'cn')),
      ctx?.connection?.mode)),
  creditnote_preview:(a,ctx)=>guarded(ctx,async s=>{
    const before=await creditPreflight(a,s,ctx?.connection?.mode);
    return {...before._creditPreview,allocation:a.allocation,
      targetInvoice:before.id,ownerMoneyApprovalRequired:true,
      proposedAmountCents:a.amountCents};
  })
};
