# G-2d worked execution packet — irreversible TEST dispute actions

**Planning guidance, not implemented and not an execution card.** Next eligible slice at inspected main #93;
implementer must create `docs/pr-cards/G-2d.md` JIT after rechecking open work and drift A. Approved scope: Batch G G4,
G-2 card's G-2d, TOOL-CATALOG Disputes; acceptance: separate confirmed evidence submission. No migration expected.
One risk area: irreversible dispute actions under the existing guards and independent money approval.

## 1. Bounded reads and existing facts

- `src/tools/dispute-evidence-draft.js:makeDisputeDraft` and its `target`/field mapping: drafts explicitly submit:false.
- `src/tools/dispute-reads.js`: safe status/deadline projection; `billing-shared.js`: validation/client/ref/local.
- `src/tools/write.js:defineWrite`, `src/core/write.js` hooks; `src/tools/app-guard.js` charge/customer ownership.
- `src/money.js:prepareMoney/reserveMoneyBeforeWrite`; `src/db.js:requestMoneyApproval`, owner decision intents and
  reserve/settle methods (locate named function then ≤150 lines); `api/stripe/setup.js` existing owner approval flow.
- `tests/unit/dispute-evidence-draft.test.js`, `money-payout-reverse-contract.test.js`,
  `tests/helpers/write-contract.js`; DB owner-approval tests; native draft stripe-mock test.
- AI-PR-READ-FIRST money/guard/secrets; G design G4; PLAN Batch G. No whole-vendor scan.

Actual SDK pin is stripe 23.0.0 / `2026-09-30.endive`. Local OpenAPI lookup `node scripts/openapi-find.mjs disputes`
returns `PostDisputesDispute`, `PostDisputesDisputeClose`, `GetDisputesDispute` for the mappings below.
Official references checked 2026-10-11: [update](https://docs.stripe.com/api/disputes/update),
[close](https://docs.stripe.com/api/disputes/close), [object](https://docs.stripe.com/api/disputes/object).
Update submit defaults true; close is irreversible and ordinary needs_response → lost. Inspect pinned
`node_modules/stripe/types/DisputesResource.d.ts` and object status enums before coding; issuing disputes are separate.

## 2. Drift A finding that the card must resolve

`prepareMoney` **and** `src/db.js:requestMoneyApproval` currently allow ch/po/etc. targets but not `du_`.
Fake DB request validation also needs inspection. G-2c says acceptance is money-out; using `du_` currently fails closed.
**Proposed compatible extension:** admit exactly validated `du_` IDs in those target validators, still with provider-derived
positive USD amount, selected account, exact tool/key/target binding and existing owner approval/cap rules. This is a
proposed implementation detail, not a change made by this docs PR. Record it in drift A and review it against the
approved money contract. If it requires a semantic amendment under DRIFT-PROTOCOL, review that before coding it.
Do not bind only to the charge to dodge validation: two different disputes must not share an interchangeable grant.
No weakening of grant matching or owner consent, no new AI approval argument and no default-limit change.
The current TOOL-CATALOG row still marks `dispute_accept` C, while the approved G-2c successor instruction explicitly
requires money-out approval. Record this drift too: the implementation PR must reconcile that row to `$` and retain
its everyday-profile eligibility plus the irreversible warning. Do not treat the older C mark as a money-guard exemption.

## 3. Proposed files and interfaces

| Status | File / interface |
| --- | --- |
| Proposed | `src/tools/dispute-finalize.js`: export factories `makeDisputeSubmit()` / `makeDisputeAccept()`, each returning real defineWrite operation; `tools`, `handlers` namespaces |
| Existing to extend | `src/tools/index.js` import/registration; `src/money.js` and DB validation only as above; fake DB to mirror real constraints |
| Proposed | `tests/unit/dispute-finalize.test.js` behavioral/actual-handler contracts; `tests/mock/dispute-finalize.test.js` request compatibility |
| Existing to extend | registry/profiles/meta tests, money validation/owner approval DB tests, catalog; JIT card and work-index only at implementation time |

Schema controls: `{disputeId, outsideApp?, dryRun?, confirm?, requestKey?}`, exact du_ pattern, unknown keys refused.
No arbitrary evidence payload, amount, owner approval, submit boolean or inverse argument. Keep catalog-prescribed
profiles (currently E/everyday in the catalog, with full inherited); establish them explicitly in the card, with read_only always denied. Submission is irreversible confirmation
(catalog C); acceptance is `$` money-out. Adapter generates technical safety metadata; do not replace its guarded marks.

## 4. Input → provider → ledger → verified result

| Action | Before / eligibility | Mutation | Independent verification |
| --- | --- | --- | --- |
| Both | disputeId → disputes.retrieve; exact object/ID/livemode:false; retrieve matching charge and customer ownership | None during preflight/preview; do not lose parent ownership markers | Wrong account/ID, missing parent or LIVE must refuse before apply |
| submit | Eligible unsubmitted needs_response/warning_needs_response; future integer due_by, not past_due, submission_count 0; staged evidence present. Inventory every populated field/file safely | `disputes.update(disputeId,{submit:true},{idempotencyKey})`; POST /v1/disputes/{dispute}. No extra evidence/metadata update or close | Retrieve same dispute; positive submission_count advancement and compatible provider status (under_review/warning_under_review, confirm pinned semantics); exact charge/amount/currency; no “won” inference |
| accept | Ordinary needs_response, exact disputed amount integer >0, USD, charge TEST identity; do not assume inquiry warnings close with ordinary lost semantics | `disputes.close(disputeId,{}, {idempotencyKey})`; POST /v1/disputes/{dispute}/close | Retrieve exact same TEST dispute, status lost, charge/amount/currency unchanged. No refund, payout, transfer or bank-settlement claim |
| acceptance money | `money()` returns `{amountCents:before.amount,currency:before.currency,direction:'out',targetId:before.id,description:<short safe description>}` | Existing requestMoneyApproval/reservation binds selected account + dispute + tool + exact provider cents; independent owner UI consumes grant | confirm-only → 0 close calls; mismatch/uncertain stays counted; cap and second override unchanged |

Submission preview: field names, text lengths, verified file IDs and Denver deadline, irreversible warning; no private text.
Enumerate provider-staged evidence, not just the eight draft arguments: Dashboard may have added fields. Verify each
referenced evidence file purpose/ID using the selected account. If inventory cannot be safely verified, refuse rather
than omit a field silently. Keep core preview length ≤1024: a too-large inventory must fail closed with useful guidance,
never truncate the list and submit unseen fields. Card must define bounded inventory tests.
Acceptance preview states the exact dollars and permanent loss; amount comes from dispute, which can differ from charge.
Neither operation gets an inverse. Results are compact IDs/status/count/confirmed flags only; privacy checks include audit.

## 5. Ordered implementation and checks

1. Fresh main/PR/CI + draft predecessor evidence; write card with drift table and validator extension decision.
2. Freeze clock in fixtures; start with preflight tests and per-call factories. Denials must make zero update/close calls.
3. Implement submit payload/read-back + actual-handler non-money contract; retain existing draft submit:false regression.
4. Implement narrowly validated dispute money target + real/fake DB tests, then accept's money spec/close/read-back.
   Obtain owner grant only through test helper simulation of independent action; production handler cannot grant it.
5. Register both, metadata/profile/count ripple, guarded direct and stripe_call tests; batch refuses writes.
6. Mock-test each exact SDK payload plus retrieve; finish docs/acceptance/inheritance, self-review and one checked push.

```bash
node scripts/openapi-find.mjs disputes
# Proposed files become runnable only after implementation:
npx --no-install vitest run tests/unit/dispute-finalize.test.js tests/unit/dispute-evidence-draft.test.js
npx --no-install vitest run tests/unit/money-owner-approval.test.js tests/unit/money-reservation.test.js tests/unit/money-inbox.test.js
npx --no-install vitest run tests/unit/registry.test.js tests/unit/profiles.test.js tests/unit/meta.test.js tests/unit/write-contract.test.js
npm run test:mock -- tests/mock/dispute-finalize.test.js tests/mock/dispute-evidence-draft.test.js
npm run test:db -- tests/db/money-owner-approval.test.js tests/db/money-reservation.test.js tests/db/money-inbox.test.js
npm run check
```

## 6. Concrete stateful fixture matrix

Base fake: account `acct_safefixture`, dispute `du_FAKE1234`, charge `ch_FAKE1234`, TEST, amount 8500 USD cents,
status needs_response, due_by frozen-now + 86400, submission_count 0; evidence product_description `PRIVATE_EVIDENCE_SENTINEL`
and receipt `file_FAKE1234`, file purpose dispute_evidence. Charge/customer metadata empty by default.
Use mutable provider state with recorded payload/options and counted **independent** retrieves.

| Variant / action | Expected outcome / forbidden effect |
| --- | --- |
| dryRun or missing confirm, both actions | 0 update/close, no money reserved; safe preview audit allowed, no text sentinel anywhere |
| Confirm submit | Exactly submit:true payload + stable key; state changes to under_review/count 1; independent retrieve confirms, no close call |
| Draft regression | Still exact evidence + submit:false, count 0; no submission/acceptance |
| Submit empty evidence, wrong-purpose file, expired/past_due, already submitted | Refuse, 0 writes; no synthetic receipt or automatic evidence creation |
| Submit returned success but count/status/identity unchanged, or retrieve timeout | confirmed:false; no bank-response/win claim or inverse |
| Confirm accept without owner / AI approval flag | 0 close; request pending exact owner grant. Unknown caller approval fields refused |
| Independent grant for acceptance | 8500 provider cents even if charge.amount=10000; one close + retrieve lost; grant consumed, cap used $85 |
| Grant for different dispute/account/tool/cents; expired/consumed | 0 close; no grant rebinding or amount inferred from caller |
| Above shared cap | Independent first approval still insufficient; distinct authenticated override required; 0 close before it |
| Close success but read-back uncertain | confirmed:false, reservation retained; retry cannot consume again. Terminal lost before call refuses |
| App marker only on charge/customer, LIVE/read_only, direct + stripe_call | 0 writes by default. outsideApp does not bypass money consent; batch write always denied |
| Two handlers concurrently accepting same dispute/key | At most one reservation/close attempt from money ledger; actual PostgreSQL proves concurrency, not fake DB alone |

Stable key: same requestKey/dryRun/confirm transition; new requestKey changes key. Do not “test idempotency” by faking
multiple successful close calls after terminal lost. A closed target is refused and an uncertain reservation remains blocked.
Seven-case helper may need a stateful one-shot adaptation (existing payout-specific oneShotMoneyTarget error check is not
generic). Adapt test harness expectations, never reopen the dispute in production to satisfy generic tests.

## 7. Done / inherited by G-3 and W-6

Card acceptance cites named submit/accept actual-handler contracts, exact mock payloads, parent ownership/indirect-door
denials, privacy sentinels, money-target real SQL/grant/cap/concurrency tests and exact-head green `ci`. Self-review whole
diff against AI-PR-READ-FIRST; no related security gate weakened. PLAN G-2 coverage reconciled with all catalog file tools.
No real provider account smoke claimed: connected TEST account remains separate evidence, LIVE off.
G-3 inherits registration/profile integration, not permission to submit. W-6 inherits verified draft assembly and must
still never submit/accept from its kit workflow. Record exported factories, terminal eligibility and unresolved provider
behavior in successor notes; don't turn this proposed packet into an assertion that G-2d already exists.
