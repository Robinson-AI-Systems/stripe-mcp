// CAP-4 CLOSEOUT — the consumer test instrument (census element 4,
// frozen in CAP-4's card set; designed in
// stripe-cap4-derivation/element4-consumer-test.md).
//
// The consumer is an AI agent holding ONLY a connection to Stripe
// Unleashed by Robinson AI Systems — an ordinary Full grant on the
// owner's own Stripe account, TEST mode for the build phases and
// the owner's LIVE-consented connection for the go-live phases. No
// Dashboard login, no direct Stripe API key, no other Stripe
// tooling. Anything the consumer cannot do through the connection
// must be handed by the server in guided form (exact link, exact
// clicks, read-back after) or the test records a "no".
//
// This module is the frozen instrument definition: the step table
// (Phases A–E, every step attempted through the connection first)
// and the scorer. CAP-5 executes it at a checked release against
// the deployed server; the fixture run in
// tests/unit/cap4-closeout-consumer-test.test.js proves the
// instrument's mechanics against this tree and reports its own
// verdicts in fixture terms — a fixture verdict is never the CAP-5
// score.
//
// Frozen scoring (element 4, "Pass/fail shape"): each step scores
// exactly one of PASS (completed through the connection, with
// read-back), GUIDED (completed via the server's guided form —
// link + clicks + read-back — which counts as served),
// NO-DISPOSITIONED (cannot be done; the record names the
// disposition: provider-impossible with evidence / deliberately
// out with the ruling that made it out / owned by another named
// unit), or FAIL (a "no" with no disposition, a silent refusal, a
// refusal whose reason is wrong, or a success claim without
// read-back). The test passes as a whole only with zero FAILs;
// PASS/GUIDED/NO-DISPOSITIONED ratios are reported as counts,
// never averaged into a score that could hide a FAIL. One
// deliberate asymmetry: a step that fails because a different unit
// owns it scores NO-DISPOSITIONED only if that unit's own record
// carries the step; otherwise it is a FAIL against the schedule.
//
// execClass names how CAP-5 executes the step:
//   'cap5-test'  — deployed server, TEST mode (Phases A–D)
//   'cap5-live'  — deployed server, owner's LIVE-consented
//                  connection (Phase E and D1)
//   'cap5-owner' — owner's own channel/ceremony on the deployed
//                  server (secret hand-off, pass issue/revoke,
//                  disconnect)
// probe names what the fixture run exercises tonight:
//   'handler' — the step's primary read executes against a fake
//               provider in fixture form, with read-back
//   'guided'  — the guided form resolves (link + clicks +
//               verification) for the step's setting
//   'surface' — every named tool exists in the registry and is
//               admitted on the consumer's Full profile; the
//               end-to-end chain is CAP-5's run
//   'none'    — nothing fixture-exercisable beyond the surface
//               probe (which still runs); the step is CAP-5's
//               entire substance

export const CONSUMER_STEPS=[
  // Phase A — Set the account up (owning).
  {id:'A1',phase:'A',owning:'CAP4-D7-ACCOUNT-ADMIN-READS',
   text:'Read what Stripe still requires for live payments and by when.',
   tools:['admin_list_requirements'],probe:'handler',
   execClass:'cap5-test'},
  {id:'A2',phase:'A',owning:'CAP4-D12-BRAND-READS-GUIDED',
   text:'Set branding (logo, icon, color), public support details, statement descriptor.',
   tools:['brand_set_account_branding','brand_set_public_details',
     'brand_set_statement_descriptor'],probe:'surface',
   execClass:'cap5-test'},
  {id:'A3',phase:'A',owning:'CAP4-D7-ACCOUNT-ADMIN-READS (guided settings)',
   text:'Choose which customer emails Stripe sends (or be told, guided, exactly where and read back).',
   tools:['admin_list_guided_settings'],guided:'receipt_emails',
   probe:'guided',execClass:'cap5-test'},
  {id:'A4',phase:'A',owning:'Batch W workflow composites + guided settings',
   text:'Set the failed-payment policy to the project\u2019s chosen value (guided if Stripe allows no API — the server must say which, before the consumer guesses).',
   tools:['workflow_failed_payments','admin_list_guided_settings'],
   guided:'subscription_retries',probe:'guided',
   execClass:'cap5-test'},
  {id:'A5',phase:'A',owning:'account payment-settings family (D-7 area)',
   text:'Enable the payment methods the project takes (card + ACH) for Checkout and hosted invoices.',
   tools:['account_list_payment_method_settings',
     'account_update_payment_method_settings'],probe:'surface',
   execClass:'cap5-test'},
  {id:'A6',phase:'A',owning:'CAP4-D5-CHECKOUT-READS + portal writes',
   text:'Configure the Billing Portal to the project\u2019s rules (payment-method update and invoice viewing on; cancel and plan-switch off) and read it back.',
   tools:['portal_list_configurations','portal_get_configuration',
     'portal_update_configuration'],probe:'handler',
   execClass:'cap5-test'},

  // Phase B — Build the catalog and billing (building).
  {id:'B1',phase:'B',owning:'catalog family + CAP4-D8 workflow composites',
   text:'Create products and prices from a plain-language list, idempotently (re-run changes nothing).',
   tools:['product_create','price_create','workflow_set_up_catalog'],
   probe:'surface',execClass:'cap5-test'},
  {id:'B2',phase:'B',owning:'Tax family (E-4; closure CAP4-PROD-TAX)',
   text:'Create the tax treatment the project uses.',
   tools:['tax_add_registration','tax_update_settings','taxrate_create'],
   probe:'surface',execClass:'cap5-test'},
  {id:'B3',phase:'B',owning:'customer + billing write families',
   text:'Create a test customer, subscribe them, and produce a paid invoice in TEST.',
   tools:['customer_create','billing_create_subscription',
     'invoice_finalize','invoice_charge_now'],probe:'surface',
   execClass:'cap5-test'},
  {id:'B4',phase:'B',owning:'billing family (preview/change composites)',
   text:'Change the customer\u2019s plan and see the exact price difference before confirming.',
   tools:['billing_preview_change','workflow_change_plan'],
   probe:'surface',execClass:'cap5-test'},
  {id:'B5',phase:'B',owning:'credit-note family (CAP4-D3 reads)',
   text:'Issue a credit note against an invoice.',
   tools:['creditnote_preview','creditnote_create'],probe:'surface',
   execClass:'cap5-test'},
  {id:'B6',phase:'B',owning:'test-clock family (Batch V)',
   text:'Run a test clock forward and observe the renewal invoice.',
   tools:['testclock_create','testclock_advance','testclock_list',
     'invoice_list'],probe:'handler',execClass:'cap5-test'},

  // Phase C — Wire the application (integrating).
  {id:'C1',phase:'C',owning:'webhook family',
   text:'Create the webhook endpoint with the project\u2019s exact event list.',
   tools:['webhook_create'],probe:'surface',execClass:'cap5-test'},
  {id:'C2',phase:'C',owning:'webhook family + Batch V dev forwarder',
   text:'Receive the signing secret — once, through the owner\u2019s channel — and confirm the endpoint delivers (synthetic event \u2192 forwarder \u2192 receipt).',
   tools:['webhook_create','dev_trigger_event','dev_create_forwarder',
     'dev_forward_events'],probe:'surface',execClass:'cap5-owner',
   cap5Note:'The secret hand-off leg runs through the owner\u2019s '+
     'one-time channel and the delivery leg against the deployed '+
     'server\u2019s forwarder; fixture form proves the surfaces only.'},
  {id:'C3',phase:'C',owning:'CAP4-D8-WORKFLOW-READ-COMPOSITES',
   text:'Ask the readiness question for the project and get every need as done / fixed-with-confirm / needs-you-with-clicks / needs-a-decision — no silent skips.',
   tools:['workflow_app_readiness'],probe:'surface',
   execClass:'cap5-test'},
  {id:'C4',phase:'C',owning:'guided settings (key creation)',
   text:'Obtain the exact restricted-key permission list for the project\u2019s own key (guided creation; the server prints what to tick).',
   tools:['admin_list_guided_settings'],guided:'restricted_key_creation',
   probe:'guided',execClass:'cap5-test'},

  // Phase D — Operate (running the business).
  {id:'D1',phase:'D',owning:'CAP4-D1-MONEY-READS',
   text:'Answer "where is my money": balance, next payouts, payout schedule, bank destination — in LIVE.',
   tools:['money_get_balance','money_list_payouts',
     'money_get_payout_schedule','money_list_bank_accounts'],
   probe:'none',execClass:'cap5-live',
   cap5Note:'LIVE substance only; fixture form proves the four '+
     'mode-aware surfaces exist (their mode idiom is D-1\u2019s own '+
     'suite). No fixture verdict is claimed for the LIVE read.'},
  {id:'D2',phase:'D',owning:'customer family + workflow composites',
   text:'Find a customer from a vague description and produce their full overview.',
   tools:['customer_find','workflow_customer_overview'],
   probe:'handler',execClass:'cap5-test'},
  {id:'D3',phase:'D',owning:'workflow composites + money ceremony',
   text:'Refund a charge found from a plain description, with the exact-approval money ceremony.',
   tools:['workflow_refund_customer','payment_create_refund'],
   probe:'surface',execClass:'cap5-test',
   cap5Note:'The money ceremony leg (exact owner approval) is '+
     'executed by CAP-5 under the owner\u2019s separate approval; '+
     'fixture form proves the surfaces only.'},
  {id:'D4',phase:'D',owning:'billing family + workflow composites',
   text:'Cancel a subscription with the chosen timing, previewing every consequence first.',
   tools:['billing_cancel_subscription','workflow_cancel_customer'],
   probe:'surface',execClass:'cap5-test'},
  {id:'D5',phase:'D',owning:'CAP4-D8B-DISPUTE-KIT-SAVE + CAP4-D4 reads',
   text:'Handle a dispute: assemble the evidence kit against its deadline and save evidence.',
   tools:['workflow_dispute_kit','workflow_dispute_kit_save',
     'dispute_save_evidence','dispute_list'],probe:'surface',
   execClass:'cap5-test'},
  {id:'D6',phase:'D',owning:'workflow composites + CAP4-D6 report reads',
   text:'Close the month: money snapshot and the report file hand-off for the accountant.',
   tools:['workflow_money_snapshot','workflow_month_end_close',
     'report_list_types','report_get_result_file'],probe:'handler',
   execClass:'cap5-test'},

  // Phase E — Go live and stay safe (the mode crossing).
  {id:'E1',phase:'E',owning:'CAP4-D8-WORKFLOW-READ-COMPOSITES',
   text:'Repeat C1–C3 for LIVE and get an honest test/live parity read (including "these two events are missing in live").',
   tools:['webhook_create','workflow_app_readiness',
     'workflow_go_live_checklist'],probe:'none',
   execClass:'cap5-live',
   cap5Note:'Runs on the owner\u2019s LIVE-consented connection; the '+
     'parity read must name gaps, never smooth them.'},
  {id:'E2',phase:'E',owning:'owner setup-page ceremony + CAP4-D7B probe',
   text:'Enroll the LIVE key and complete the activation ceremony as the owner.',
   tools:['stripe_check_key_permissions'],probe:'none',
   execClass:'cap5-owner',
   cap5Note:'The enrollment and activation ceremony runs on the '+
     'owner\u2019s setup page; no registry tool performs it. CAP-5 '+
     'executes it as the owner, with D7b\u2019s per-mode probe as '+
     'the read-back.'},
  {id:'E3',phase:'E',owning:'CAP4-D2/D3/D4 read families',
   text:'Read LIVE payments, invoices, disputes, and events with the same tools that worked in TEST.',
   tools:['payment_list','invoice_list','dispute_list','event_list'],
   probe:'none',execClass:'cap5-live',
   cap5Note:'The mode-truth leg: the same handlers, on the '+
     'LIVE-consented connection. Fixture form proves the surfaces; '+
     'the D-series suites prove the mode idiom.'},
  {id:'E4',phase:'E',owning:'pass family (V4 conversion)',
   text:'Issue a scoped pass to a second agent and revoke it; prove the revoked pass is refused.',
   tools:['stripe_create_pass','stripe_revoke_connection'],
   probe:'surface',execClass:'cap5-owner',
   cap5Note:'Executed on the owner\u2019s connection against the '+
     'deployed server. (The CAP-5 knock test already proved the '+
     'revocation mechanics at build 5b5f701c; this step is the '+
     'full pass lifecycle at the checked release.)'},
  {id:'E5',phase:'E',owning:'connection lifecycle (CAP4-RECENSUS-1 exit)',
   text:'Disconnect and prove the tokens die.',
   tools:['stripe_revoke_connection','stripe_deenroll_account'],
   probe:'surface',execClass:'cap5-owner',
   cap5Note:'Executed on the owner\u2019s connection; the absence '+
     'read-back is the proof. De-enrollment (RECENSUS-1) is the '+
     'full-exit form of this step.'},
];

// The frozen scorer. Evidence fields follow element 4 exactly:
//   completed       — the step was done through the connection
//   viaGuided       — done via the server's guided form
//   readBack        — the outcome was read back, not just claimed
//   refusalReasonTrue — where the server refused, the reason it
//                     gave is the true one
//   disposition     — null, or {kind, record} where kind is
//                     'provider-impossible' | 'deliberately-out' |
//                     'other-unit'
//   owningRecordCarriesStep — for kind 'other-unit' only: the
//                     owning unit's own record carries this step
//                     (the frozen asymmetry)
export function scoreStep(ev){
  if(ev.completed){
    if(!ev.readBack)return 'FAIL'; // success claim without read-back
    return ev.viaGuided?'GUIDED':'PASS';
  }
  if(ev.disposition){
    if(ev.refusalReasonTrue===false)return 'FAIL'; // wrong reason
    const d=ev.disposition;
    if(d.kind==='other-unit'&&ev.owningRecordCarriesStep!==true)
      return 'FAIL'; // the asymmetry: not carried = schedule FAIL
    return 'NO-DISPOSITIONED';
  }
  return 'FAIL'; // a "no" with no disposition, or a silent refusal
}

// The whole-test verdict: zero FAILs, counts reported, never an
// averaged score.
export function summarize(scores){
  const counts={PASS:0,GUIDED:0,'NO-DISPOSITIONED':0,FAIL:0};
  for(const s of scores)counts[s]++;
  return {counts,total:scores.length,passes:counts.FAIL===0};
}
