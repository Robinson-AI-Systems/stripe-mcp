### October 14 V-3 — original TEST SetupIntent event lifecycle (SOURCE ONLY)

Three no-charge native TEST workflows now create an audited, run-tagged
SetupIntent and verify the original `setup_intent.created`,
`setup_intent.canceled`, or `setup_intent.succeeded` Event. Cancel/confirm
occurs only after an exact, independently retrieved intent is durably tracked;
completed transitions are not replayed. The original Event must independently
match selected TEST account, exact run, source ID and expected state.
Provider misses leave runs incomplete and recoverable, not falsely accepted.
Incomplete inspection and guarded cleanup handle the new source. Source-only:
mandatory exact-head CI/review, checked daily release and actual custom TEST
provider Event readback remain open. LIVE, money-out, spending, app ownership,
existing original run digests and owner consent are unchanged.

### October 14 V-3 — run-owned PaymentMethod Event lifecycle (SOURCE ONLY)

Source implements three more genuine selected-account TEST event scenarios:
`payment_method.attached`, `payment_method.updated` and
`payment_method.detached`. Unlike an untracked direct attach, a synthetic
TEST card is tagged and durably recorded before attachment, update or
detachment. Original Event state, source ownership and independently retrieved
provider snapshots are required. Existing original ledger and cleanup still
apply. Exact-head CI, checked release and genuine custom TEST provider proof
are separate; provider checks remain pending. No LIVE, money-out, spending,
Hub or owner permissions changed.

### 2026-10-14 V-3 additional native TEST event workflows — SOURCE ONLY

After #233 passed seven exact-head CI gates and merged at
`f71913dafc954545ffd5d3853069126b6d31f9ec`, V-3 implementation
continued toward the approved approximately 30 common developer Events.
This branch adds three genuine original TEST event scenarios:
`payment_intent.created`, `customer.subscription.updated`, and
`invoice.paid`. These are source and automated-regression work, not
Stripe-confirmed provider events. Their real TEST readback needs the
next normal checked main-to-live release plus independent selected-account
custom MCP Event ID/state checks. V-3 remains IN_PROGRESS; the four
original unfinished TEST triggers, G-6 owner Dashboard checks and all
other queued acceptance remain pending. No LIVE, money-out or spending
authority changed.

### October 14 V-3 tracked invoice-failure TEST provider correction — SOURCE ONLY

A verified Stripe invoice-pay contract mismatch in the native `invoice.payment_failed`
trigger required a customer-owned PaymentMethod. New immutable plans record a
separately tagged, independently retrieved TEST card before collection and
expose guarded detach, source inspection and provider-versus-ledger cleanup
readback. Existing incomplete source plans are preserved for read-only
original recovery, never upgraded or auto-retried. Focused unit/Stripe-mock
source regressions accompany this implementation. This branch has not yet
passed all required exact-head CI and review, merged to `main`, reached
checked `live`, or demonstrated a new original Stripe Event. Its queue row
must stay PENDING until real deployment and selected-account custom TEST
provider evidence. No LIVE, money-out, spending, approval or owner-grant change.

### Owner-requested throughput measurement update — October 14, 2026

Focused maintenance: 400–800 changed production lines and 2–5 completely
integrated slices per substantive PR on rolling averages, with evidence-backed
exceptions and no padding. Existing session tooling now reports remaining
coarse roadmap units and IDs without conflating them with PR slices or live
acceptance. Source/CI/deployed/provider evidence remains separate.
No provider operation, release, approval or safety gate is changed.

Verification: all 61 focused session-tool tests passed locally across the five
updated repositories, including real disposable Git ancestry, unchanged queues,
partial/review/blocked/optional/planned counts, duplicate/unknown status rejection
and Google native-ledger parsing. Each actual index/ledger also loaded successfully.
Required exact-head Actions gates and reviews must pass before merge; this note
claims no deployed or genuine external-provider acceptance.

### October 14 additional V-3 recovery workflow source checkpoint

Following merged #228 and the still-checked #229 original Stripe Event reader,
the approved V-3 recovery outcome adds a bounded operator batch (#230) to
inspect the four genuine unfinished native TEST fixtures in one read-only
selected-account call, without accidental writes or false Event completion.
Its separate queue entry is source-only until exact-head CI/reviews, merge,
normal checked live release and actual custom TEST provider readback.
Do not call the release-dependent tasks passed on source or deployment alone.

### October 14 live release readback — next acceptance checkpoint

Vercel deployment `dpl_ro9WeFt46Ub2seeMam6NQuHy5n7V` is independently READY
at the exact current matching `main`/`live` commit
`e505e06b2c59dabf50a3792cad67d4ab0ffdfe96`, with canonical
Production aliases. Authenticated original Stripe Cloud TEST inspection was
attempted, but the conversation's saved adapter refused refresh with an
uncertain outcome. No native provider inspection or Event acceptance was
claimed or repeated; this is a connection-runner checkpoint, not evidence
that the underlying TEST key or owner OAuth grant is revoked. The Hub's
connected public namespace remains metadata-only with no upstream route.
Use the already authorized protected developer runner if accessible, preserve
single-runner refresh state, and keep the original four fixtures pending.
Read-only source work #228 adds finite, PII-free diagnostics for those exact
failure classes; its release/provider acceptance is queued separately.

## October 14 release acceptance ancestry repair

Repinned pending acceptance to independently verified merged implementation commits
from the corresponding reviewed PRs after squash merges removed the original source
pins from main ancestry. All existing procedures, gates, dependencies and PENDING
states remain intact. This makes an applicable release eligible for verification;
it is neither deployed proof nor a provider acceptance pass. Every updated pin is
an ancestor of independently observed current main.

### Workflow maintenance handoff — owner publication approved

New offline session utility: eight behavioral tests passed, including actual Git ancestry, partial releases, unknown/failed deployments, rollback, dependency gating, invalid queues, PR alignment and bounded output. All repository queues validate. Existing source/status evidence is preserved; no provider acceptance or release was performed. Owner explicitly approved publication on October 14; publish the reviewed maintenance branch, require exact-head CI/reviews, and merge only when those gates pass. No extra production release is authorized by this approval. Full broad application suites on the shared runner were interrupted after resource/time-limit failures; do not claim them passed. Existing exact-head remote CI/review gates must pass before any main merge.

### October 14 verified deployed TEST acceptance and unfinished-fixture handoff

Independent READY Production at exact live 46a1675c42d847f42229d1dbe552bd55e1f71323 was checked before native acceptance. Through the **custom connected Stripe MCP**, eight historical immutable Event runs were independently reverified, all eight mutable cleanup reports independently passed after safely reconciling the original missing zero-value draft invoice (no second provider deletion), and the advertised developer run read projection succeeded. Three additional native TEST originals — customer.subscription.created, invoice.updated, invoice.finalized — were provider-verified and their eligible source cleanup confirmed. The total is **11 distinct accepted original Event types**, **not** signed delivery or complete V-3.

Four additional native TEST trigger attempts remain `running` without independently verified original Events: customer.subscription.deleted, payment_intent.payment_failed, charge.dispute.created, invoice.payment_failed. Their exact recorded partial fixtures were processed with guarded preview+confirmation; the native cleanup reported all eligible mutable records resolved after safe same-target replay and retained historical invoice/item records intentionally. Without a provider reader for unfinished runs, independent *current* source-state closure is still pending. V-3 read-only `dev_inspect_incomplete_run` is merged on main at PR #224 but awaits the next checked live release. PR #225 adds an independently audited, explicit `pendingRunId` on an attempted but incomplete native TEST trigger response; no full receipt or provider acceptance is claimed before CI, merge and checked deployment. No LIVE, money-out, automatic provider retry, manual release or owner bypass. The single machine-readable acceptance queue below holds the next checks and owner gates; do not treat limited releases as a project-wide stop.

## Release acceptance queue — workflow optimization 2026-10-14

Owner-authorized guidance/tooling maintenance: consolidated session procedure, focused
checks between meaningful edits, substantial capability grouping, and read-only queued
acceptance/PR-boundary report. This records source/tooling work, not a live/provider pass.
The queue below seeds existing outstanding obligations; reconcile exact scenarios and
already-proven evidence from the unchanged cards/ledger before running. Keep all prior
open obligations, original fixture ownership, approvals and deployment provenance.

<!-- release-acceptance:start -->
```json
[
  {
    "id": "STRIPE-TEST",
    "priority": 1,
    "requiredRevision": "143040662933e3c9158dbc00b69cef1d4af518ad",
    "task": "Finish remaining connected TEST/OAuth/webhook/owner/Hub acceptance boundaries; released subsets are recorded separately",
    "procedure": "docs/acceptance/STRIPE-TEST-MILESTONE.md",
    "gates": "Original selected TEST account, exact deployment provenance and independent owner consent for money-out; LIVE disabled",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 genuine custom Stripe TEST: eight prior original events, eight provider cleanup states and historical invoice reconciliation verified; three additional native Events also verified. Signed webhook, hosted Checkout, owner Dashboard, Hub and OAuth remain separate."
  },
  {
    "id": "STRIPE-V3-EVENT-8",
    "priority": 2,
    "requiredRevision": "46a1675c42d847f42229d1dbe552bd55e1f71323",
    "task": "Confirm eight previously completed original TEST Event runs against immutable Stripe originals",
    "procedure": "docs/acceptance/STRIPE-TEST-MILESTONE.md #219",
    "gates": "Selected TEST; exact stored run ownership and immutable original Event read; no signed webhook inference",
    "dependsOn": [],
    "status": "PASSED",
    "lastEvidence": "2026-10-14 authenticated custom service dev_verify_trigger_runs: requested 8, provider_verified 8, unverified 0; immutable Event retrieval rechecked independently."
  },
  {
    "id": "STRIPE-V2-INVOICE-217",
    "priority": 3,
    "requiredRevision": "46a1675c42d847f42229d1dbe552bd55e1f71323",
    "task": "Reconcile historical zero-value draft-invoice cleanup marker without another deletion",
    "procedure": "docs/pr-cards/V-2.md #217",
    "gates": "Verified original TEST invoice.created Event, exact 404, guarded preview/confirm and durable marker readback",
    "dependsOn": [
      "STRIPE-V3-EVENT-8"
    ],
    "status": "PASSED",
    "lastEvidence": "2026-10-14 custom guarded dev_cleanup returned reconciledFrom=verified_original_event_and_provider_absence for exact historic run; independent dev_get_run and dev_verify_cleanup_run confirm both invoice and customer marked/verified cleaned; original Event retained."
  },
  {
    "id": "STRIPE-V3-CLEANUP-8",
    "priority": 4,
    "requiredRevision": "46a1675c42d847f42229d1dbe552bd55e1f71323",
    "task": "Independently compare mutable Stripe TEST states and cleanup markers for eight historic Event runs",
    "procedure": "docs/acceptance/STRIPE-TEST-MILESTONE.md #220",
    "gates": "Provider reads and exact selected-account ledger; immutable Events retained",
    "dependsOn": [
      "STRIPE-V3-EVENT-8",
      "STRIPE-V2-INVOICE-217"
    ],
    "status": "PASSED",
    "lastEvidence": "2026-10-14 eight independent dev_verify_cleanup_run snapshots: eight allEligibleCleanedAndVerified=true after historical invoice reconciliation; no payment settlement or signed delivery inferred."
  },
  {
    "id": "STRIPE-V3-PROJECTION-218",
    "priority": 5,
    "requiredRevision": "46a1675c42d847f42229d1dbe552bd55e1f71323",
    "task": "Verify native dev_list_runs advertised detail/fields projection actually works",
    "procedure": "docs/acceptance/STRIPE-TEST-MILESTONE.md #218",
    "gates": "Authenticated TEST native meta call and exact projection; read-only",
    "dependsOn": [],
    "status": "PASSED",
    "lastEvidence": "2026-10-14 deployed custom stripe_call dev_list_runs limit=2 detail=full fields=runs.id,runs.status,hasMore returned projected rows and correct hasMore; no strict handler rejection."
  },
  {
    "id": "STRIPE-V3-ADDITIONAL-3",
    "priority": 6,
    "requiredRevision": "46a1675c42d847f42229d1dbe552bd55e1f71323",
    "task": "Verify new genuine TEST customer.subscription.created, invoice.updated and invoice.finalized originals and eligible cleanup",
    "procedure": "docs/pr-cards/V-3.md and docs/acceptance/STRIPE-TEST-MILESTONE.md",
    "gates": "Original actual Stripe Event independent read; guarded TEST-only cleanup, immutable evidence retained",
    "dependsOn": [],
    "status": "PASSED",
    "lastEvidence": "2026-10-14 three fresh custom TEST run originals independently providerVerified=true; guarded cleanup confirmed all eligible resources for each. Trial-created zero-dollar paid invoice retained intentionally; no webhook delivery or money-out."
  },
  {
    "id": "STRIPE-V3-RUN-INSPECTION",
    "priority": 7,
    "requiredRevision": "8848d0cb9aa53a336aa5e84c5f5ccbe7ace4e9d5",
    "task": "Deployed custom read-only unfinished TEST trigger provenance/source-state inspection",
    "procedure": "docs/pr-cards/V-3.md #224 and tests/unit/dev-incomplete-inspection.test.js",
    "gates": "Exact-head CI/review, checked main-to-live, READY deployment, selected TEST; no source mutations",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 independent Vercel production deployment dpl_ro9WeFt46Ub2seeMam6NQuHy5n7V READY at exact live/main e505e06b2c59dabf50a3792cad67d4ab0ffdfe96, so release prerequisite is cleared. Authenticated custom Stripe Cloud inspection was attempted, but the saved Chat adapter reported refresh_uncertain / renewal_outcome_unknown_reconnect_required; no original TEST provider read was performed or passed. Reuse independent protected developer grant without replaying an uncertain mutation."
  },
  {
    "id": "STRIPE-V3-FAILURE-INDICATORS",
    "priority": 8,
    "requiredRevision": "f2af8dde37569eb590eb589db834ed829977838d",
    "task": "Verify deployed read-only failed-event diagnostics for genuine unfinished TEST card, invoice, dispute and subscription fixtures",
    "procedure": "docs/pr-cards/V-3.md #228 and tests/unit/dev-incomplete-inspection.test.js",
    "gates": "Reviewed exact-head CI, normally checked READY source ancestry, selected original TEST account and matching immutable run ledger; no provider mutation, no raw provider error/PII, no original Event claim",
    "dependsOn": [
      "STRIPE-V3-RUN-INSPECTION"
    ],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 source-only enhancement adds finite provider-verified state indicators and five dedicated unit regressions for four incomplete native TEST event families. No CI, checked release or real original-provider invocation is claimed by this new PR."
  },
  {
    "id": "STRIPE-V3-INCOMPLETE-ORIGINAL-EVENT",
    "priority": 8,
    "requiredRevision": "4f270886a5ccee151da351e7fd25a6636312e1a4",
    "task": "Try exact original Stripe Event provider readback on unfinished native TEST triggers with complete source ledger, never equating observation to SQL completion",
    "procedure": "docs/pr-cards/V-3.md #229; tests/unit/dev-incomplete-inspection.test.js",
    "gates": "Exact original selected TEST immutable plan and full run-owned source ledger, provider Event independently retrieved and matched; normal release and READY; no LIVE/money/automatic replay or event absence inference",
    "dependsOn": [
      "STRIPE-V3-RUN-INSPECTION"
    ],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 source-only opt-in inspector validates recorded sources then checks exact original Events with a bounded Stripe list and independent retrieve; tests cover valid, tampered, missing and unreachable cases. No deployed provider proof before checked release."
  },
  {
    "id": "STRIPE-V3-BATCH-RECOVERY",
    "priority": 8,
    "requiredRevision": "b39316837fc857dcf7b3bf7441bbb15defb6ab07",
    "task": "Use one bounded TEST original provider call to inspect up to four exact unfinished native V-3 fixtures, with per-run unverified isolation and no mutations",
    "procedure": "docs/pr-cards/V-3.md #230; tests/unit/dev-incomplete-inspection.test.js",
    "gates": "Exact-head CI and review, checked READY source deployment, native selected TEST account and four original run IDs; independent Stripe reads, no provider write/cleanup, no inference of absent Events",
    "dependsOn": [
      "STRIPE-V3-RUN-INSPECTION",
      "STRIPE-V3-INCOMPLETE-ORIGINAL-EVENT"
    ],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 source-only read batch validates 1-4 distinct original TEST IDs before access, reuses provider-safe single-run inspector, isolates unavailable results and supports optional original Event readback. CI/release/provider evidence separate."
  },
  {
    "id": "STRIPE-V3-UNFINISHED-4",
    "priority": 8,
    "requiredRevision": "8848d0cb9aa53a336aa5e84c5f5ccbe7ace4e9d5",
    "task": "Independently inspect four interrupted TEST event trigger fixtures and reconcile safe cleanup readbacks",
    "procedure": "docs/pr-cards/V-3.md #224; dev_get_run, dev_inspect_incomplete_run",
    "gates": "Exact selected-account running TEST ledger, safe read-only provider status and no inferred Event absence",
    "dependsOn": [
      "STRIPE-V3-RUN-INSPECTION"
    ],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 customer.subscription.deleted, payment_intent.payment_failed, charge.dispute.created and invoice.payment_failed attempted once each but remained RUNNING, no original Event claimed. Guarded exact-run cleanup reported all eligible mutable objects cleaned after safe retries, retaining immutable invoice/item evidence. Independent unfinished-run provider snapshots await new deployed read tool."
  },
  {
    "id": "STRIPE-V3-REMAINING",
    "priority": 9,
    "requiredRevision": "46a1675c42d847f42229d1dbe552bd55e1f71323",
    "task": "Complete real TEST acceptance of remaining supported trigger types, including disputed/failed/paid events and actual hosted Checkout",
    "procedure": "docs/pr-cards/V-3.md and docs/PLAN.md Batch V",
    "gates": "Provider-confirmed immutable events only, same-key retries, owned cleanup, hosted Checkout requires genuine browser participation; no LIVE or money-out",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 eleven distinct types provider verified total. Four additional trigger requests were rejected or inconclusive before verified originals, with their partial fixtures safely handled. Checkout browser and other types not accepted; investigate each precise gap."
  },
  {
    "id": "STRIPE-SIGNED-WEBHOOK",
    "priority": 10,
    "requiredRevision": "46a1675c42d847f42229d1dbe552bd55e1f71323",
    "task": "Deliver and verify genuine signed Stripe TEST webhook at protected hosted receiver with private receipt",
    "procedure": "docs/acceptance/STRIPE-TEST-MILESTONE.md Signed Stripe TEST webhook receipt",
    "gates": "Owner-approved secret provisioning, protected ingress, replay denial; never expose signing secrets",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "Receiver/source and CI fixtures exist; actual remote Stripe-signed TEST delivery and durable receipt not demonstrated in this session."
  },
  {
    "id": "STRIPE-OAUTH-EXTERNAL",
    "priority": 11,
    "requiredRevision": "46a1675c42d847f42229d1dbe552bd55e1f71323",
    "task": "Prove genuine hosted custom OAuth PKCE, refresh, revocation and scoped denial",
    "procedure": "docs/acceptance/STRIPE-TEST-MILESTONE.md Connected custom-MCP OAuth",
    "gates": "Owner browser sign-in/SSO and temporary connection revocation, exact READY origin",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "Source/CI only; original connected custom Stripe Cloud TEST tool activity is not evidence of independent PKCE/refresh/revocation flows."
  },
  {
    "id": "STRIPE-HUB-ROUTES",
    "priority": 12,
    "requiredRevision": "46a1675c42d847f42229d1dbe552bd55e1f71323",
    "task": "Prove distinct Hub D-4 direct/relay/Sandbox TEST read-only routes, isolation and revocation",
    "procedure": "docs/acceptance/STRIPE-TEST-MILESTONE.md Toolkit Hub D-4",
    "gates": "Owner-issued short-lived read_only pass, working upstream Hub and authentic route evidence",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "No genuine direct/relay/Sandbox authenticated Hub route acceptance recorded in this session."
  },
  {
    "id": "STRIPE-G6-OWNER",
    "priority": 13,
    "requiredRevision": "46a1675c42d847f42229d1dbe552bd55e1f71323",
    "task": "Complete owner signed-in Dashboard review of G-6 status and sensitive settings",
    "procedure": "docs/pr-cards/G-6.md and docs/OWNER-INPUTS.md",
    "gates": "Owner-authenticated browser Dashboard observations, TEST identity and no setting inference",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "Connected TEST settings evidence is partial; a signed-in human Dashboard comparison remains unverified and H-1 remains gated."
  },
  {
    "id": "STRIPE-V3-PENDING-RECEIPTS",
    "priority": 7,
    "requiredRevision": "7dedb7c89163eab1aefa5d8e0743321840d5647b",
    "task": "Verify failed confirmed native TEST triggers expose only account-scoped audited unfinished-run IDs and no false success",
    "procedure": "docs/pr-cards/V-3.md #225; tests/unit/dev-pending-receipt.test.js and tests/unit/dev-events.test.js",
    "gates": "Exact-head CI/review and checked READY source revision; original selected TEST account; no LIVE, credentials or automatic mutations",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 PR #225 source: native failed-write adapter adds pendingRunId/pendingRunStatus/recordedSteps only after confirmed attempt, durable immutable run-plan and at least one exact recorded source. Previews, auth denials, no-run cases and completed Events remain unchanged. Deployed native rejection receipt proof awaits checked release."
  },
  {
    "id": "STRIPE-V3-TRACKED-INVOICE-DECLINE",
    "priority": 8,
    "requiredRevision": "dab8d1edd1a8dfa977da3e4d70bd42d11712bcf0",
    "task": "Prove genuinely declined run-owned attached TEST invoice card, original invoice.payment_failed Event, guarded detach and independent cleanup readback",
    "procedure": "docs/pr-cards/V-3.md tracked customer-attached TEST decline repair; tests/unit/dev-invoice-failure-state.test.js; tests/mock/dev-invoice-failure-event.test.js",
    "gates": "Reviewed exact-head CI, checked READY revision, original selected TEST account and guarded preview+confirm; no legacy run replay, LIVE, owner money out, or untracked PM",
    "dependsOn": [
      "STRIPE-V3-RUN-INSPECTION"
    ],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 #233 merged at f71913dafc954545ffd5d3853069126b6d31f9ec after seven exact-head checks passed. Normal checked live promotion and independent actual TEST provider event/cleanup remain PENDING."
  },
  {
    "id": "STRIPE-V3-THREE-NATIVE-EVENTS",
    "priority": 8,
    "requiredRevision": "c1e1618a00786f4421939e469a8ffec5ac1e62c2",
    "task": "Prove original selected TEST payment_intent.created, customer.subscription.updated and invoice.paid Events with exact provider Event retrieve and original durable run source",
    "procedure": "docs/pr-cards/V-3.md three additional genuine TEST event workflows; tests/unit/dev-events.test.js; tests/mock/dev-events.test.js",
    "gates": "Exact-head CI and approved checked live deployment, authenticated selected TEST account, guarded preview/confirm and source Event ID, metadata, and status. Mock, unconfirmed source and provider state are not Event proof.",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 PR #234 merged f6334800bc20568251eb52c9190aaf19658cb2e19 (prefix of actual merge SHA 6334800bc20568251eb52c9190aaf19658cb2e19), all 7 exact-head GitHub checks successful; genuine TEST provider acceptance pending."
  },
  {
    "id": "STRIPE-V3-OWNED-PAYMENT-METHOD-EVENTS",
    "priority": 8,
    "requiredRevision": "d5df7589d270e4d9ee48302689efb0f64327c306",
    "task": "Verify genuine selected-account TEST payment_method.attached, updated, detached original Stripe Events from tagged ledger-created and attached synthetic cards",
    "procedure": "docs/pr-cards/V-3.md PaymentMethod lifecycle actions, tests/unit/dev-payment-method-events.test.js and stripe-mock shapes",
    "gates": "Exact-head CI, checked deployed live, authenticated selected TEST account, guarded preview/confirm and independent Event retrieve. No TEST source or mock treated as actual Event acceptance.",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 source and automated test plan, no actual provider event acceptance."
  },
  {
    "id": "STRIPE-V3-SETUP-INTENT-EVENTS",
    "priority": 8,
    "requiredRevision": "0b85632918e508543ad3f0800c9b312017d52f7b",
    "task": "Independently verify original selected-account TEST setup_intent.created, setup_intent.canceled and setup_intent.succeeded from exact durable run-owned SetupIntents",
    "procedure": "docs/pr-cards/V-3.md SetupIntent lifecycle; tests/unit/dev-setup-intent-events.test.js and tests/mock/dev-setup-intent-events.test.js",
    "gates": "Exact-head required CI/review, approved checked main-to-live, authenticated native custom Stripe TEST account, original run preview/confirmation, exact Events.list and independent Events.retrieve; no money, LIVE, automatic cleanup or inferred acceptance.",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14 source commit 0b85632918e508543ad3f0800c9b312017d52f7b; no validated CI, deployed or provider proof yet."
  }
]
```
<!-- release-acceptance:end -->

<!-- Current repair also records no-change daily receipts: backups cannot publish later same-day development after a successful no-op. -->
## October 14 owner-requested daily release recovery repair — current

Owner request on October 14: investigate and repair missed daily releases across the MCP repositories and Appliance Desk, including the quoted owner-run checked recovery. This supersedes the prior scheduled-only/no-new-trigger restriction for missed-event recovery only. Primary 00:01 Denver remains; retries are 00:17, 01:17 and 05:37 Denver plus 12:43 UTC. Explicit recovery defaults OFF and requires both the original actor and the triggering actor to be christcr2012, main, true recovery input and elapsed midnight. Every path retains successful exact-main CI, ancestry, atomic once-per-Denver-day receipt and independent readback. No production-provider activation, spending, force push or preview build is authorized.

Local release safety tests pass. Merge requires exact-head application CI and review resolution. Source repair is separate from observed schedule execution and Vercel READY/alias proof; inspect actual daily run and receipt, do not equate main/live drift after a release with failure. These infrastructure PRs do not replace the existing substantive implementation batch.

## October 14 checked release trigger investigation and resilience repair (source proposal)

At approximately 05:00 America/Denver, independent GitHub REST inspection showed **zero** scheduled workflow runs, despite .github/workflows/promote-live.yml existing on the default `main` since October 13, with supported timezone-aware 00:01 Denver cron. `live` remained at `3cb4831d85a30950b9ee0e1e5f13488faa83eba5`; actual Vercel READY Production served that same older revision. Exact `main` CI was green. The failure occurred before any release job: this is **not** evidence of a rejected CI gate or a failed deployment. GitHub's documented scheduler may drop cron events under load; the precise GitHub workflow enabled/disabled state was not available via the current connector and remains unverified. This PR re-registers the scheduled release by modifying its cron schedule and adds two later **guarded** same-Denver-day recovery attempts (00:17 and 00:43), retaining the original 00:01 primary time, original sole scheduled workflow, six exact-main CI checks, no manual dispatch or push trigger, atomic once/day tag, fast-forward-only push, and live-only Vercel build tracking. Updated policy validation refuses any extra/changed cron, UTC shift, manual dispatch or weakened contents permission. This is **source and CI repair** until the NEXT genuine GitHub scheduled run plus `live` and READY deployment readbacks. The missed October 14 release was NOT triggered retroactively and no old one-time owner release authorization was reused.

## #220 independent TEST Event cleanup provider inspection — 2026-10-14 (source proposal)

A completed trigger's `dev_get_run` reports durable cleanup flags but does **not** recheck provider state; `dev_verify_trigger_run` proves its original immutable Event only, not the current mutable resource state. New read-only `dev_verify_cleanup_run({runId})` builds a full post-cleanup inspection: first independently verify exact completed TEST run plan, account, immutable original Event and source; then independently retrieve each recorded mutable/retained Stripe resource. Per-step results distinguish `verified_cleaned` (provider state AND exact ledger cleaned marker), `intentionally_retained` (immutable provider evidence), `pending_cleanup`, `ledger_pending`, `ledger_mismatch`, and `provider_unverified`. Exact missing original zero-value draft invoice can be identified via independently verified `invoice.created/updated` source + strict resource_missing; it does not mark ledger itself or claim deletion acknowledgment. The read fails closed if original Event provenance is bad, LIVE/foreign account selected, or ledger unavailable. No provider mutations, debt/refund/payment settlement inferences, automatic repair, or webhook delivery inference. Source CI then checked daily deploy and actual custom-service TEST inspection are independent acceptance gates.

## #219 original TEST event batch acceptance — 2026-10-14 (source proposal)

The approved V-3 trigger workflow had genuine original Stripe TEST events for eight types, but verification required one individual `dev_verify_trigger_run` call at a time and could not isolate the exact failed fixture in a single bounded acceptance run. New read-only `dev_verify_trigger_runs({runIds})` requires 1–10 distinct exact `run_` IDs, selected account TEST, authentic original immutable plan and event ledger for every run, and independently re-fetches each original Stripe Event with unchanged account, source/type and rtc_run provenance. Returns per-run provider_verified or unverified (no claim of non-occurrence); one corrupt/missing Event never grants success to another, and SDK errors/provider secrets never escape. Source cleanup flags remain ledger-only; signed webhook delivery, mutable source state and money settlement are not inferred. No provider writes, LIVE, new credentials or owner privileges. Source/CI only until checked daily release and genuine custom connected acceptance.

## Native MCP read projection contract — #218 (checked source changes; deployment acceptance pending)

Genuine deployed custom Stripe TEST `stripe_describe_tool(dev_list_runs)` advertised `detail:'full'` and generic `fields` for an account-scoped developer run listing, but invoking that documented option returned `Invalid bounded TEST run query`. Root cause: `publicToolInfo` extends all READ ONLY schemas with common presentation options, while `dispatchReadOnlyTool` forwarded them unchanged to strict native handlers that only accept business arguments. The proposed MCP gateway correction independently validates standard detail/field paths once, removes only those two **generic** options before the underlying READ ONLY handler, and applies them to sanitized results as already intended. Native detail/fields contracts, strict unknown business args, frozen connection, profile checks, guarded writes and safe result store remain unchanged. Original `dev_list_runs` is directly covered, along with malformed field/unknown argument denial. Only source and exact-head CI are possible before the normal checked daily release and genuine custom-service acceptance.

## Historical TEST invoice cleanup reconciliation — #217 merged main (deployment acceptance pending)

Actual custom restricted Stripe TEST `invoice.created` fixture `run_2f46ecc21b9581ec23a9ba95` had a real zero-amount draft invoice deleted during earlier cleanup but its ledger row marked uncertain because Stripe's independent retrieve returned `resource_missing`. #216 fixes future delete receipts in merged main, not the old missing invoice; production remains old `live`. Proposed #217 repairs this specific *run-owned* historical reconciliation without another Stripe mutation: only on a completed `invoice.created` TEST run whose full immutable approved plan, scoped ledger, exact original Stripe Event (including original draft/zero-amount source and rtc_run/account provenance) independently pass native `verifyRecordedTriggerRun`, and whose exact invoice GET independently returns 404/resource_missing. Then guarded dev_cleanup may write the exact account-scoped ledger marker, read it back, report `reconciledFrom`, and preserve immutable Event. All failures are denied before any mutable operation; never infer a deleted provider receipt or a signed webhook. This is SOURCE ONLY until full exact-head CI, normal checked release and real replay of original TEST fixture.

## Genuine TEST events and draft-invoice cleanup — #216 merged main (deployment acceptance pending)

Fourth newly verified type: `payment_intent.canceled` run `run_e5e47acda99cb5efbfe66dbf`, independently retrieved Event `evt_3UQKnX46Dan0UEUV1969xHee` with exact source `pi_3UQKnX46Dan0UEUV1dbc6Pbl`. Guarded cleanup independently cleaned its unconfirmed/canceled TEST PaymentIntent and synthetic customer and retained immutable Event. Eight distinct Event types are now genuine provider-observed; this does not certify signed webhook delivery or production #212–#216. These observations are from deployed #211, not newer merged source.


Independent authenticated custom Stripe Cloud TEST has newly confirmed native events `product.updated` (run_8c43a77a7682c53babfe8537), `price.updated` (run_b4e3e5e752e04c85dcdc413b) and `invoice.created` (run_2f46ecc21b9581ec23a9ba95), with separate provider event_list/event_get identifying the exact Stripe Events/sources. Guarded cleanup archived each new product/price; immutable Events were retained. Invoice cleanup removed the TEST customer (independent deleted readback), but the draft invoice outcome remained uncertain; independent invoice_get returned exact Stripe resource_missing, consistent with an actual deletion. Repair the source-only future draft cleanup receipt to accept a strict independently checked deletion 404 ONLY after matching provider deleted:true acknowledgment, reusing the existing V-2b helper. Existing uncertain old-run ledger reconciliation and new-source production/provider acceptance remain OPEN. Final-main is #215, live/READY #211 until normal checked daily release; no LIVE, money-out, manual promotion or false cleanup success.

## #215 native Stripe TEST event independent readback (2026-10-13, proposed)

Authenticated deployed custom Stripe Cloud TEST accepted four real curated events (customer.created, customer.updated, product.created, price.created) and the recorded synthetic resources were safely deleted/archived while immutable Stripe Events were preserved. A separate event_get provider fetch reconfirmed the three creation Events' exact IDs, types and original source IDs after cleanup. #215 adds dev_verify_trigger_run(runId), a read-only selected-account TEST operation rebuilding the approved trigger plan from its complete immutable run ledger, re-fetching the exact original Event from Stripe and verifying its original source, account, event type and rtc_run provenance even after safe source cleanup. Does NOT infer webhook delivery or current mutable source state. V-3 remains IN_PROGRESS for broader actual acceptance. Production #215 acceptance awaits the next normally checked daily release; G-6 Dashboard review remains owner-only. No LIVE, spending, credentials or money permission changes.

## #214 account-scoped developer TEST run readback and verified receipts (2026-10-13, proposed)

The custom service's provider-confirmed V-3 event triggers returned only an idempotency key; operators had to preserve a preview or list runs and guess the matching ID to perform cleanup. `dev_seed` shared this handoff gap. #214 projects the validated `run_` ID as `resourceId` only after the original provider/ledger verification AND final durable audit, never on unconfirmed or rejected writes. The new `dev_get_run({runId})` is a bounded TEST-only read for all existing profiles: exact account-scoped durable run state, named resource IDs and cleaned/remaining counts support deterministic follow-up and reconciliation. It does not independently prove provider state, expose secrets, authorize more writes or change LIVE/money gates. Source CI/hosted #214 acceptance remain separate.

## #213 developer TEST cleanup outcome (2026-10-13, proposed)

Authenticated deployed #211 Stripe TEST acceptance generated a genuine `customer.created` Event through `dev_trigger_event` with its provider event readback. An independent run listing showed exactly one completed run with two objects; `dev_cleanup` independently deleted its customer but retained immutable Event evidence, then incorrectly reported generic readback failure. A separate `customer_get` confirmed `deleted:true`. #213 distinguishes policy-immutable retention from blocked/uncertain cleanup, reports `allEligibleCleaned` separately from `allCleaned`, and marks a confirmed cleanup complete only when every mutable record was independently verified. Retained events remain forever in the scoped ledger, with no auto refund or unsafe deletion; true dependency and audit uncertainty still fail closed. This proposed source fix has no deployed acceptance until normal checked promotion. No money or LIVE.

## #212 customer receipt routing review correction (2026-10-13, proposed)

Fix the actionable unresolved #210 review: `customer_get` accepts `cus_` IDs, but some mutation receipts exposed child `pm_`, `cbtxn_` or `txi_` IDs. Every confirmed and audited customer write now returns the affected `cus_` ID; verified creations still return their new `cus_` ID. Readback verification also binds update/delete, payment-method, tax-ID and discount results to the exact requested resource before claiming success. The nine-write fixture suite covers every receipt, including separately approved TEST balance adjustments, and rejects child-ID leakage. This corrects a source/automated workflow defect; provider behavior at the newly deployed revision remains to be independently tested after scheduled daily promotion. No LIVE, money-out bypass, new keys or manual deployment.

## #210 provider-verified customer write receipts (2026-10-13, proposed)

A real authenticated standalone custom Stripe MCP TEST acceptance run confirmed the selected-account read, created a disposable synthetic customer, independently retrieved exact matching metadata, deleted it using the existing guarded preview/confirm flow, and read back `deleted:true`. No money or LIVE use. The successful write response omitted the verified customer ID, requiring an extra provider search before cleanup. #210 adds an optional, strictly validated ID-only receipt after the original write's independent verification and durable audit; customer writes opt in and unit regressions prove previews/uncertain outcomes never leak IDs. All other money, ownership, isolation and financial approvals remain unchanged. External proof happened against deployed #209 `b7cc291bb88bcd44a9b111281e3ef5f770046748`; #210's source CI and subsequent scheduled production release are separate. Provider identity/resource denial, OAuth revocation, genuine signed webhook, Hub federation and G-6 owner Dashboard remain unverified.

## Review corrections — 2026-10-13

Developer connection retries retain encrypted codes until expiry, concurrent starts use an atomic trusted-IP quota, and backend failures remain retryable. Google consent preserves the requested profile and supports actual native code length. Windows protected credentials fit bounded chunks; cloud refresh locks recover after process exit. Evidence requires every layer and genuine custom-service read/write/denial/readback observations. Production functionality remains intact. Local regression checks passed; exact-head CI, deployed connection, provider, Hub, revocation and cleanup proofs remain separate.

## Reusable developer OAuth and evidence boundary — 2026-10-13

Owner authorized replacing repeated manual pass setup with renewable implementing-agent
connections. Production product capabilities remain unchanged; full developer TEST/preview
profiles retain original server write/financial/resource guards. Native OAuth owner consent
hands authorization back to protected client storage via PKCE plus an encrypted mobile callback.
The rtool developer client reuses/refreshes that connection and invokes the actual custom MCP.
The completion recovery review records catalog/runtime differences, obsolete recipes and
a finite path to finish the intended products without introducing blanket limitations.
Source/automated/deployed/provider/Hub/revocation/cleanup evidence remain separately tracked
in developer-evidence.json. Standard connectors remain development infrastructure aids only.
New handoff/client regressions and mandatory provenance checks are part of this PR; exact-head
CI, reviewed release and real owner consent/provider acceptance remain pending. Managed cloud clients use an explicit private encrypted developer vault; desktops may use
the OS keyring. Never place credentials in a prompt, Git or plaintext credential file. This is an implementation checkpoint, not full real-world acceptance.
See pr-cards/DEVELOPER-CONNECTION.md. No production provider activation or paid resource change.

**#205 original owner TEST workflow HTTP/PostgreSQL integration (2026-10-13, proposed):** Adds an isolated local real HTTP server backed by disposable PostgreSQL to exercise the owner page's actual passphrase lockout, canonical Origin/CSRF, saved account listing, selected TEST verification failure stage, allowlisted report and single-use encrypted reveal over actual network requests. Stripe provider is deliberately stubbed, not an external API acceptance, and no LIVE or real money is involved. This closes a *source-and-CI* end-to-end acceptance gap which unit-only page tests missed; user requested grouping all #201–#205 before a single release, so no intermediate branch was promoted to live. Exact-head CI/review, final-main CI, next checked daily promotion, READY source SHA and owner TEST rerun remain distinct gates.

**#204 original HTTP setup preflight (2026-10-13, proposed):** The server's actual `api/stripe/setup.js` invoked Neon schema bootstrapping before rejecting invalid HTTP methods and did not enforce the hardened original-body `incomingBodyWithinLimit` check. The owner audit now adds fail-closed method, body-size/Content-Length consistency and POST media-type rejection *before* any DB/key work; source tests invoke the genuine entrypoint and confirm 413/415/405 with no exposed credential text. No auth/approval weakening, no isolated deployment. #201–#203 remain on main only; consolidate all changes for one future checked release.

**#203 owner setup warm-instance SQL efficiency (2026-10-13, proposed):** Full audit confirmed `api/stripe/setup.js` ran `db.initSchema()` on *every* page GET, failed password POST, and focused TEST read, invoking numerous repeated additive table/index/ALTER checks in capped Neon. This increases latency, DB work and cold-start cost without providing extra verification when schema is already initialized. Proposed single-flight per-isolate schema init preserves full cold-start migrations, concurrent request readiness and fail-closed rejection/retry; no DB schema migration, zero credential or money changes. Unit tests prove concurrency/repair and initial invocation. Owner-requested consolidated release still pending; `live` stays at #200 while #201/#202 were implementation-only.

**#202 holistic owner setup workflow review (2026-10-13, proposed):** Audited all forms and server branches, including TEST smoke, account IDs/keys, signing secrets, signed receipt lookup, report CSV, one-time passes, connection revocation, emergency LIVE disable, default account, owner money limits and two-stage money approvals. Confirmed existing server-side canonical Origin, CSRF, passphrase lockout, no-store, preflight and typed approvals remain fail-closed. Demonstrated severe UX debt: 8 advanced groups displayed simultaneously; one-time reveal and pending confirmations appear after unrelated forms; owner manually types an exact account ID despite encrypted account enrollment; unbounded untrusted GET intent selectors can trigger DB lookup; normal GET lacks no-referrer header. Proposed #202 adds password-authenticated, bounded, escaped *stored TEST account ID only* directory (not raw keys or live accounts), native collapsed groups, immediate private action panels, strict query selector checks and no-referrer/frame guards. Tests enforce all original action names once and no secret leak; no LIVE/provider setting changes. #201 merged to main but not live; continue a single grouped release policy, no per-fix deployments.

**#201 owner TEST diagnostics + full-page audit (2026-10-13, proposed):** The owner saw TEST G-6 `Private TEST verification ... No acceptance recorded` after #200's checked live release. The catch previously collapsed unknown account selection, key decryption, remote TEST identity failure, missing contracts and report mismatch. Neon metadata shows exactly one encrypted restricted TEST key, earlier permission snapshot and webhook reader check; no secret contents inspected and original owner POST outcome is unknown. #201 adds authenticated only, allowlisted TEST failure stages with regression tests for no exposure of raw provider/credential data, plus initiates a full review of all owner forms and API boundaries; **no production release** until a consolidated candidate. Current verified main=live=Production READY #200 ce84ac2; actual end-to-end Stripe TEST provider, OAuth, webhook and Hub proofs still missing.

**#200 owner TEST evidence visibility (2026-10-13, proposed):** Owner reports submitting G-6 TEST administration from the private setup form but sees a reset and no indication of success or failure. Actual source places the report (including validation/password failures) below five unrelated forms and places the read-only form itself below several other owner workflows; browser POST returns new HTML and restarts at the page top. Vercel runtime output includes GET deprecation warnings, not authenticated TEST per-tool evidence; no conclusion about that submission is justified. Proposed #200 puts the TEST form first and an accessible, no-store owner response banner before every form, with only previously allowlisted sanitized per-tool statuses and counts. A returned report explicitly remains readiness INCOMPLETE, and errors or password denial are unmistakable without exposing provider secrets. Do not claim historical smoke success. Main/live/READY Vercel reached #199 `8c67e0f0c4d36e4f739ecca8e71e499b1d23ba14` independently; deploying #200 and owner rechecking are separate gates.

**#199 observed owner setup alias origin failure (2026-10-13, as-if merged; exact-head review required):** Owner's POST from `https://stripe-mcp-psi.vercel.app/api/stripe/setup` was refused with `Origin check failed`. Read-only Vercel configuration confirms canonical `PUBLIC_BASE_URL=https://stripe-mcp-chris-projects-de6cd1bf.vercel.app` while `psi` is a valid alternate deployment alias. This PR makes noncanonical owner setup GETs redirect to the fixed configured origin before issuing any CSRF cookie. POST still strictly requires the canonical Origin, existing cookie/CSRF and passphrase. Tests cover alternative alias, query-selector nonreflection and no-referrer redirection; a production release is not implied. GitHub main/live and Vercel READY had independently reached `2d748a8ba24c7a0870cccea22daf9bd1f7499d0c` through separately merged #198; its production revision, actual TEST provider/OAuth/webhook/Hub evidence and scheduled promotion remain distinct.

**#197 release-policy regression merged (2026-10-13):** The merged #196 review identified a YAML key-order bypass in the daily release guard; the validator now validates the entire single-item schedule and has timezone-first/duplicate-CRON regressions. All seven exact PR-head checks passed; #196 review was answered and resolved, and six final-main jobs passed. Current confirmed baseline main/live 1ded9276a4dc3310802360221ca21d195e197b64; protected Production and genuine Stripe TEST OAuth/provider/webhook/Hub acceptance are distinct. Session policy now aligns to the next higher PR-number multiple of five and pauses in the same conversation for genuinely owner-only prerequisites rather than issuing an early continuation prompt.

**Setup checkpoint — 2026-10-13:** Stage-aware setup verified: one checked encrypted TEST key, zero LIVE keys/enabled accounts or MCP sessions. Existing hosting/Secrets support next TEST OAuth/native receiver acceptance; Vercel protection and every independent money-out/LIVE gate preserved. All six release workflows target 00:01 America/Denver, Vercel tracks live, Basic queued builds and disabled automatic previews verified. No scheduled release event observed yet; owner authorized one manual release after green checks. Saved configuration, deployed exact revision and authentic connected acceptance remain separate.

**Owner release timing update — 2026-10-13:** Daily checked main-to-live release now targets 00:01 America/Denver using GitHub native timezone support, so both daylight and standard time remain 12:01 a.m. All exact-head CI, atomic daily-marker, fast-forward, preview/build-cost and independent live/provider approval gates remain unchanged. Owner separately approved one manual release after this setup work completes; schedule syntax/CI, actual deployment and connected acceptance remain distinct evidence. GitHub scheduling can be delayed; no guaranteed start time is claimed.

# STATUS — current work, blockers and next action

## Current gateway recovery disposition — 2026-10-12

Owner requested cross-repository architecture/planning correction. Prioritize independently usable provider tools
and existing approved RTC/isolation acceptance; do not wait for K-3 publication or force internal code adoption.
Hub agent owns fixed broker surface, registry, routing, grant mapping, cache, forwarding audit and scale testing.
This service agent owns authenticated RTC/mode/resource isolation, original direct-MCP parity and safe deployed
read/denial/revocation evidence. A public manifest, reference conformance or private-core rehearsal is not proof
of actual hosted acceptance. Full provider roadmap and existing external gates remain; no card is closed here.
Next: reconcile current implementation/concurrency and existing RTC acceptance gaps, obtain exact deployed
revision and authorized short-lived read_only non-production pass securely, and run the supported harmless read
and denials through Hub when available. Never alias preview to TEST without real isolation or expose credentials.

Updated 2026-10-11. Repository created by Chris; plan written by Claude (Opus 5.5) in the Appliance Desk planning system.
**Batch A implemented (#9–#17):** tested foundation, durable OAuth, pinned Stripe API reference, encrypted keys, secure setup code and owner's deployment guide. The custom server is deployed to Vercel, the separate Neon database has initialized all 24 expected application tables, and one owner-enrolled Stripe TEST key is encrypted and recorded as verified. **Real custom-MCP OAuth/connected provider smoke and signed-in Stripe Dashboard acceptance are NOT verified. LIVE is disabled.**

## Deployment cost policy — owner update 2026-10-12

The daily release implementation from #166 is merged. Production Branch Tracking was changed to live and Preview Branch Tracking disabled through the Vercel dashboard and independently read back. The follow-up cost-policy PR adds live-only Git configuration for all branches, pinned release actions and a main-only PR target check. No forced production deployment is used for acceptance; the first scheduled promotion remains to be observed. Stripe LIVE remains disabled. See DAILY-PRODUCTION-PROMOTION.md.

## Next

- **#195 first-head CI repair and protected ingress:** Correct real DCR-response ambiguity: after server 201, owner cleanup/revocation required even if client metadata is malformed. Removed lint error. All four owner-invoked hosted TEST runners now support an optional owner-supplied short-lived Vercel Trusted Sources OIDC header to the exact pinned HTTPS service origin only; no redirects or cross-host sending, no SSO setting change. Authorized development→production Trusted Sources configuration and any actual hosted TEST/OAuth evidence remain separately gated.


- **#195 owner browser interactive TEST OAuth PKCE acceptance (CI pending):** Source-only opt-in harness pins actual `live` SHA, registers public OAuth DCR client, launches owner browser with S256 PKCE and ephemeral loopback state-bound code callback, exchanges code only once on original Stripe OAuth host and verifies TEST/read_only account using original MCP SDK. Never sees the owner's login passphrase or returns bearer/refresh. Temporary connection MUST be owner-revoked through private page. Genuine owner-executed remote OAuth/Stripe provider/Webhook/Hub acceptance stays UNVERIFIED until real evidence. Following batch next normal five PRs only for eligible substantial approved work, no filler; LIVE off and scheduled-only deploy.


- **#194 standalone hosted OAuth refresh acceptance (CI pending):** Owner opt-in protected runner builds on #193 SDK: exact live attestation, pre-refresh scoped TEST/read_only SDK check, one no-retry real custom OAuth token refresh, new SDK scope parity, prior access 401. New remote token is never printed or saved and owner must revoke TEST connection via the protected page. This is only local source/fixture proof until independently operated; interactive PKCE, provider TEST, webhook, Hub routes UNVERIFIED. LIVE remains off, no deployments, purchases or money permissions.


- **#193 standalone custom-MCP SDK hosted TEST probe (CI pending):** Owner opt-in tool attests exact pinned live SHA before passing a connector bearer through the official MCP SDK to only the same-origin `/api/mcp` endpoint; checks TEST account/profile, read-only catalog and safe local whoami, plus a separate exact revoked-token 401 check. Fake-fetch unit tests are NOT external custom-MCP OAuth/PCKE or Stripe API acceptance. External pass/owner flow still unverified, production live remains behind, no manual deployment or LIVE/spend.


- **#192 hosted G-4 receiver route preflight (CI pending):** New owner opt-in, credential-free HTTPS GET-only tool first attests the exact observed `live` deployment SHA, then requires the TEST webhook route's local 405 JSON. It refuses SSO HTML, stale main/preview SHA, invalid selectors and unexpected responses, without sending a pass, secret, provider event or write. This is only ingress readiness, NOT genuine signed Stripe delivery or a verified database receipt. Production `live` was still 8068f52 at the start; normal scheduled promotion and protected owner execution are required. No Stripe LIVE, spending, force deploy or shared-core adoption.


- **#190 (as-if merged, final exact-head CI and review required):** Original Stripe MCP dispatch now rejects inherited executable handler names and getter-supplied request fields without invoking them, captures and freezes authenticated tenant identity before asynchronous dispatch, and refuses nested `runRead` write escalation. The checksum-pinned private K-3 core dispatcher is temporarily invoked through original Stripe OAuth/MCP HTTP SDK with original PostgreSQL, redaction, area/profile and scoped result policies. Standalone Stripe remains default. This reaches the desired PR-number multiple-of-five checkpoint only when seven exact-head checks, merge and six final-main checks pass. Continue independent Hub publication and actual protected owner TEST/D-4 evidence in next session without using unavailable dependency. No LIVE, forced deployment or real money.
 

- **#189 K-3 authentic owner-money guarded write adapter:** Privately installed portable core write temporarily executes original Stripe source `src/tools/write.js` money/ownership/idempotency/approval lifecycle, with the original owner consent and above-$500 override tested against actual disposable PostgreSQL and synthetic provider. Keep standalone core write active at runtime. Next remaining K-3 Stripe adapted boundary is guarded MCP dispatch (#190); Hub release/deploy/TEST external acceptance remain separate and unverified. All existing money authority is preserved.
 

- **#188 K-3 source OAuth-protocol private adaptation:** The real original Stripe registered client, owner login, account/profile TEST selection and database are authoritative. Private core token handler is temporarily exercised with a strict source-owned grant/refresh adapter against original OAuth units and genuine localhost SDK/isolated SQL; no imported package at runtime. Fix any CI drift before completing #188. #189 protected money write adapter and #190 authenticated dispatch remain next independently eligible implementations; remote Hub release and protected deployed D-4 remain distinct unverified external gates.
 

- **#187 continuation checkpoint / owner blocker correction:** PR #187 branch `ai/gpt6/k3-bearer-service-adapter-187` succeeded at code head `d145d5c31853428160a6417cb120bb7012eafbdc` in seven exact-head GitHub checks after fixing an invented overly strict account-ID regex. The current PR includes the permanent new rule: diagnose, repair, isolate only the blocked operation, inspect all independent approved roadmap work, auto-requeue when cleared; no premature session handoff. This instruction-only edit is included in the same substantive bearer implementation PR, not a docs-only PR. **The next final PR head must pass seven checks anew and reviews before authorized merge. Work index now contains a separate K-3 source-adoption phase/evidence/re-entry ledger without falsely changing legacy R-3 full RTC status.** No production/live promotion or remote acceptance claimed.

- **#187 (as-if merged; exact-head CI required): Stripe-owned staged K-3 portable MCP bearer boundary.** Private candidate `mcp-auth` with source `getAccessToken`, owner-selected TEST account/profile and RFC case-insensitive bearer translation after validating duplicate/raw/headersDistinct evidence. Before release, re-run original 4 OAuth/HTTP unit and 6 durable PostgreSQL suites after temporary original `requireMcpToken` adapter overlay; restore standalone source after. Preserve invalid pass, expiration/revocation, refresh isolation, SQL fault sanitized 503 and money-owner approval. This is private proof, NOT a committed dependency or published release; Hub's remaining `oauth-protocol`, `write`, `mcp-dispatch`, full safety matrix and remote asset remain separate OPEN. D-4 external protected deployed SHA and owner TEST evidence unverified; latest observed live `8068f52`. See `docs/acceptance/K3-STRIPE-SOURCE-HANDOFF.md` for Hub handoff/reentry. LIVE off, no money, no forced deployment.
 

- **#186 (as-if MERGED, CI required): private K-3 profiles source-boundary acceptance.** Stripe CI temporarily re-exports five generic profile primitives from verified private Hub core but retains source-owned guarded TEST write eligibility and compact/catalog account/profile listing policy. Real source unit (6) and PostgreSQL HTTP/RTC/OAuth owner money-limit (5) suites must pass during temporary overlay, restored after. No runtime private dependency, no money activity, no LIVE or remote release. Other adapted exports bearer OAuth, OAuth protocol, guarded write, MCP dispatch still require independent assessment; original K-3 one-time-secret adapted SQL proof persists.
 

- **#185 (as-if MERGED, acceptance requires CI): service-owned one-time-secret adapted K-3 proof.** Existing #184 checksum-verifiable private-core replay now ALSO tests Hub's adapted `one-time-secrets` export through source Stripe DB schema with two independent PostgreSQL sessions. Bidirectional original/portable ciphertext AAD interoperability, atomic one-use race, tampered account/mode fail closed and SQL expiry must pass. Mapping source is standalone/dependency-free; no runtime core adoption, published release, owner credential, remote provider or money. Remaining adapted exports OAuth bearer, profile, OAuth protocol, write and MCP dispatch require independent review; every money-out still needs separately authenticated transaction owner approval and distinct above-$500 override.
 

- **#184 (as-if merged, CI must independently pass) K-3 private-candidate Stripe-owned acceptance:** The source's existing db CI job now checks out Hub at immutable `08f4189`, checksum-verifies the exact *unpublished* private archive digest independently logged in Hub #122, compares four source-verbatim modules, temporarily installs them as imports in throwaway CI (never runtime package dependencies), executes seven original Stripe unit and nine original PostgreSQL suites including actual HTTP, dual connection, owner money consent and daily limit, restores source after. Fails on archive/source SHA drift or non-local SQL, no remote Release; service-adapted exports and real owner/Hub/deployed acceptance remain separate. Seven original CI gates and reviews are mandatory; LIVE off.
 

- **#183 K-3 Stripe-owned HTTP security parity (implementation, awaiting exact-head CI):** Reject executable getters, toJSON functions, exotic/cyclic/sparse structured request bodies via descriptor-only detached inert JSON before OAuth owner actions or RTC TEST batch rate/dispatch. Maintain original 16 KiB wire/raw Content-Length limits. Test original OAuth and RTC handler denial with zero accessor/DB/provider invocation; source code and local CI evidence are separate from deployed source. Hub K-3 private candidate is NOT published or adopted and all six adapted interfaces, financial consent and remote D-4 acceptance still require independent proof. No LIVE/spending/forced deployment.


- **#182 (as-if MERGED, gates required): real Stripe-service RTC subset conformance in CI.** The pinned upstream Hub `runConformance` now runs against actual Stripe registry HTTP + isolated PostgreSQL, separate from the existing upstream fake-server job. Named manifest, OpenAPI, catalog, pass invalid/expiry/revoke and compact budget probes must PASS; upstream safety (requires full writable fixtures) stays OUT_OF_SUBSET, with independent absent-tool 404/write 403 proof. Upstream write/full profile tests remain explicit OUT_OF_SUBSET failures, and OAuth refresh/two distinct process checks remain independently SKIPPED; no full RTC certification. Fixed actual RTC POST unknown tool to 404 `not_found` while preserving present-but-forbidden finance/write as 403. Corrected owner's acceptance runner to probe an actually registered `stripe_payment_cancel` write instead of nonexistent `stripe_payment_intent_create`, ensuring the refusal check can verify the real guard. This is source/local proof, not a deployed `live` service, authenticated Stripe TEST API or Hub D-4 route. All seven exact-head CI checks, zero unresolved threads, authorized merge then final main CI mandatory. Keep the primary milestone useful secure TEST integration; external blockers/eligibility in the finite TEST ledger.


- **#181 (as-if MERGED pending real checks): end-to-end local OAuth→MCP SDK wire acceptance.** Added a genuine loopback HTTP + disposable PostgreSQL integration test of public S256 registration, owner-selected TEST/read_only account, authorization code, official MCP SDK tool read, atomic refresh and revocation across separate connectors. This is **not** a real third-party authenticated OAuth connection or external Stripe account evidence. Required: all seven exact-head GitHub checks, self-review/thread audit, expected-head merge and final main CI. Owner's permanent outcome-driven workflow is now embedded in existing AGENTS/SESSION-START/DEVELOPMENT-EFFICIENCY docs, not another documentation-only PR. **Milestone:** secure usable Stripe TEST. **Hosted blocker:** live still 8068f52 despite main 4fedb344; next scheduled checked promotion followed by exact live/READY/protected origin verification. **External blocker:** owner-protected ingress plus TEST client/pass/Stripe webhook artifacts, with Hub relay's separately approved private binding; rerun gates immediately once evidence exists, never infer from local test. H-1 still waits for real owner G-6 walkthrough. Next eligible action after #181: investigate CI/reviews first, then actual deployed evidence or a specific independent approved G-4/G-5/G-6 missing acceptance, not filler.


- **#180 (as-if MERGED) exact deployed source provenance required for owner TEST acceptance:** public RTC contract optionally exposes only validated Vercel runtime commit SHA, Git ref and environment, not credentials or guessed GitHub main. The owner-pinned external TEST/read and revoked-pass scripts now require separately observed `RTC_EXPECTED_DEPLOYED_SHA` and verify exact SHA, `live` ref and `production` environment from public contract BEFORE sending any temporary bearer pass. Old historical `main` READY, missing Vercel metadata/SSO HTML, wrong git SHA or preview cannot claim external success. Unit regressions cover fail closed; no runtime configuration switch, force deployment, cost change, LIVE, Stripe provider write, or extra credential. Seven exact-head GitHub checks and review audit mandatory. After #180 merge, record final main CI and permanent handoff and restart in #181–#185; next priority true deployed OAuth, safe Stripe TEST account read, Stripe-signed receipt and Hub D-4 direct/relay/Sandbox with separate owner gates, never fabricated PASS.\n\n
- **#179 (as-if MERGED) truthful RTC native read projection and Stripe TEST proof:** preflight respects each registered read tool's native allowed fields-array enum and detail enum; generic read selectors still accept dotted strings and arrays. The native G-5 account_get previously rejected RTC-normalized field strings, making safe HTTPS account projection unusable; direct/batch guarded tests exercise real registered handler with harmless fake SDK and reject invalid later batch entries before any Stripe call. The owner-pinned external TEST acceptance runner now requires three real provider-verified boolean indicators, not just an ID that permission-denied responses can echo. Fake-provider unit assertions and CI are **not** genuine external TEST reads, OAuth, signed webhooks, full RTC 1 or Hub D-4. Seven final-head CI and review gates required. Stripe LIVE off; no manual deploy/spending.\n\n
- **#178 (as-if MERGED) custom MCP OAuth bearer HTTP interoperability:** standards-compatible case-insensitive HTTP Bearer scheme on the connector door while token bytes, kind=connector, TEST scope, account/profile/listing and owner revocation remain exact. New real isolated PostgreSQL + loopback HTTP authenticated connector boundary test covers RTC pass isolation, forged bearer, atomic refresh and old/revoked credential refusal. This is NOT an actual third-party connected MCP client OAuth end-to-end (MCP SDK bridge is outside this test), not Stripe provider access and not deployed production proof. Seven exact-head checks plus reviews required; no LIVE, financial write, manual Production or spend. Next inspect genuinely eligible external TEST/G-4/G-5/G-6 work; status evidence at docs/acceptance/STRIPE-TEST-MILESTONE.md.\n\n
- **#177 (as-if MERGED) pinned hosted RTC TEST acceptance tool:** authenticated HTTPS whoami reports the selected exact Stripe account ID, enabling remote account-isolation comparison. New protected-env, explicit opt-in `scripts/rtc-service-check.mjs` checks pinned origin, public read_only-only manifest, scoped identity, safe catalog, actual direct read and one batch, denial of a money/write tool; separate optional projected genuine Stripe TEST account GET and independently verified revoked-pass 401. Runner redacts raw body, credential, account and provider response. Unit fixture regression and real PostgreSQL/HTTP whoami assertion; seven exact-head CI + review required. This is **not** external certification: real owner pass, first scheduled live→Production deployment, Stripe TEST API read, custom-MCP OAuth, genuine signed webhook and Hub D-4 routes remain separate BLOCKED/UNVERIFIED until owner environment proves them. See docs/acceptance/STRIPE-TEST-MILESTONE.md; LIVE off and no paid/manual deployment.\n\n
- **#176 (as-if MERGED) RTC HTTPS manifest/OpenAPI truth:** top-level public contract now counts only actually reachable TEST read_only tools (0 HTTPS money/writes) and supported areas/profile, not the unrelated fuller /api/mcp registry. Tool descriptions likewise use read_only-only and legacy unscoped pass whoami no longer misleadingly reports zero area grants. OpenAPI now describes pass-only auth, public endpoints and bounded read-only routes. Fake-DB unit and genuine isolated PostgreSQL/loopback HTTP catalog parity regressions; seven exact-head CI and review-thread gate must pass. See docs/acceptance/STRIPE-TEST-MILESTONE.md for the **finite** independent external acceptance matrix. Production live still 8068f52, behind 43b44fb main; no scheduled promotion, authenticated external OAuth/provider signed webhook/Hub D-4 accepted. Stripe LIVE off. Next PR only for independently demonstrated security or roadmap work, never PR padding.\n\n
- **#175 (as-if MERGED) RTC legacy pass indirect dispatch closure:** reject MCP meta-dispatch tools on all TEST-only HTTPS passes, including older NULL area grants, while keeping native catalog/describe/direct read/batch and standalone `/api/mcp` unchanged. Unit and disposable real PostgreSQL/HTTP tests verify no meta handler and ordinary TEST reads. Dated security decision recorded. Seven exact-head checks, review audit and protected-main merge required; end exactly at #175, no LIVE or manual Production. Genuine Stripe/Hub D-4 three-route, signed webhook, connected OAuth and daily live deployment observation remain separate evidence gates.

- **#174 (as-if MERGED) strict RTC query pagination:** limit/offset/result page accept only bounded decimal integers (or safe native integer in direct tests), refusing coercion of arrays/null/hex/exponent/whitespace/empty values; catalog search handles uppercase consistently. Test catalog, result endpoints and ordinary pagination. Seven exact-head checks and review required; no provider access widening, LIVE or deployment. Next #175.

- **#173 (as-if MERGED) RTC Bearer interoperability and pass identity integrity:** HTTP scheme matching now respects case-insensitive Bearer without accepting altered token bytes; all expired/revoked/unknown valid-format passes issue a sanitized invalid_token challenge. Corrupt pass result_scope/client identity is denied before Stripe TEST execution to protect scoped results. Auth + integrity regressions, seven exact-head CI and review gate required. LIVE off; next #174.

- **#172 (as-if MERGED) RTC pre-parsed body size boundary:** enforce the 16 KiB cap on normalized structured POST bodies even if a dishonest Content-Length is present and raw bytes are unavailable; reject cycles/unserializable structures. TEST RTC integration regression verifies no provider handler runs on oversized parsed payload. Preserves unchanged size limit, rate/owner/LIVE-off gates and checked-only daily Production. Seven exact-head checks and reviews required. Next #173.

- **#171 (as-if MERGED) RTC batch rate units:** reserve all 1–10 read units against the shared PostgreSQL 120/minute TEST pass bucket before any handler execution, not one HTTP unit per ten reads. Fake DB, HTTP and independently connected DB regression tests. No new authority or deployment; seven exact-head checks and unresolved-review audit required. Genuine owner-enrolled Stripe/Hub D-4 acceptance, signed webhooks and OAuth remain unverified; Stripe LIVE OFF. Next #172.

- **#170 RTC multi-call preflight / release batch boundary (IN REVIEW):** all batch READ arguments (including detail, field arrays, dotted projection constraints) now pass identical validation before invoking the FIRST Stripe handler, preventing wasted TEST requests or stored handles when a later operation is known to be invalid. Tests prove zero handler calls for malformed late entries and full execution/field privacy for two valid calls. Existing #168 hosting cost policy/CI guard and #169 corrupted TEST pass checks preserved. After seven exact-head checks, thread-free merge and post-main CI, stop at multiple-of-five #170 and hand off next #171–#175; daily live promotion remains scheduled only, not manually triggered. Do not claim real Toolkit D-4 direct/relay/Sandbox, Stripe signed webhook delivery, G-4/5/6, or authenticated external OAuth acceptance without evidence; LIVE disabled.


- **#169 RTC pass claim corruption isolation (proposed, CI and review required):** HTTPS TEST reader now refuses malformed or far-future expiry values, and requires native integer/boolean pass limits rather than coercing null, false or strings into false-zero money authority or valid rate. Four new adversarial unit tests. No stronger operational authority, money-out, Stripe LIVE, webhooks or live deployment. Actual Toolkit Hub D-4/authenticated provider tests remain pending. Next #170 substantive RTC/service acceptance and verify checked daily release observations only when they genuinely occur.


- **#168 owner hosting policy + executable release guard (IN REVIEW):** incorporates docs/HOSTING-COST-POLICY.md and AGENTS.md pointer prepared on ai/codex/hosting-cost-handoff-2026-10-12. CI now exercises a fail-closed static release-policy verifier against Vercel live-only builds, scheduled main→live writer, pinned actions and enforced main-target PR workflow, plus regression tests. Protected-main requires both `ci` and `target-main` exact head; historical five other CI jobs remain. Vercel Production tracks `live`, previews disabled (saved settings); project Basic queued build, Neon 0.25 CU 300s idle and owner spending gates remain. First scheduled promotion, real Stripe TEST/HUB and Basic-build runtime behavior remain UNOBSERVED. Stripe LIVE disabled. Next #169 and #170 implementation PRs after #168 green merge; do not manually deploy.


- **#166 Daily Production release gate (proposed; six CI checks and Vercel branch verification required):** GitHub `live` branch created from verified Production-ready `8068f52`; new scheduled 10:00 UTC CI-gated, fast-forward-only, atomic `live`+Colorado-day tag update accepts only six successful main checks and never more than one promotion per Denver calendar date. Current Vercel Production Branch Tracking must be switched from `main` to `live` and independently verified before claiming fully operational; branch selection is outside connector's documented update fields. No Stripe LIVE activation, provider writes, money approvals or SSO weakening. See docs/DAILY-PRODUCTION-PROMOTION.md. Expected next roadmap development PR count: #166 as implementation slot 1, remaining four to multiple-of-five #170.


- **#165 RTC real dual-HTTP/PostgreSQL read-only acceptance (as-if-merged; six exact-head checks required):** two independent Node HTTP listeners and actual Stripe registry instances share a disposable PostgreSQL schema, issue 150 overlapping authenticated TEST read requests, require exactly 120 successes and 30 database-enforced 429s, verify real harmless metadata calls through both listeners, and owner-intent revocation denies both immediately. This is true application HTTP/SQL integration, NOT two OS processes, a deployed authenticated route, real Stripe TEST provider acceptance or Toolkit Hub direct/GitHub relay/Vercel Sandbox D-4 certification. Continue external approval-gated tests, OAuth and G-4/G-5/G-6; LIVE OFF.

- **#164 RTC accurate HTTP field schema and validation (proposed; six checks required):** describe advertises both supported field string and array selectors, independently validates safe dotted selectors/detail before executing handlers, returns invalid_args instead of provider error, and preserves MCP schema. No API writes, permissions or LIVE changes. External Hub D-4 still unverified.

- **#163 Owner-selectable one-hour RTC TEST passes (proposed, six CI gates required):** exact 1-hour option for approved D-4 temporary owner-issued area-scoped TEST/read_only passes alongside existing 24-hour default. Same owner passphrase, CSRF, one-time secret, hashed storage and revocation. No LIVE, money or write widening; real D-4 remains pending.

- **#162 RTC money metadata truth and fail-closed discovery (proposed; CI/review required):** counts.money derives from actual guarded provider money specs (`moneySpec`/safety), not only an absent boolean; read-only HTTPS rejects misclassified money-capable handlers. Unit adversarial and actual registry/Postgres HTTP manifest tests. No writes, LIVE or real-provider acceptance claimed. Next #163 service-level conformance and authenticated D-4 routes.

- **#161 RTC HTTP failure classification (proposed; exact-head CI/review required):** real provider/read failures must produce service_error/503, malformed batch projections invalid_args/400, rather than spurious 403s; no access widening, Stripe writes, LIVE or credential changes. Genuine Toolkit D-4 and full RTC conformance remain pending. Next inspect exact-head CI and then remaining RTC read-only acceptance.

- **#160 Owner-private signed TEST webhook receipt readback (as-if-merged; six CI checks required):** account+endpoint+event exact lookup of metadata-only durable signed TEST receipts is now accessible on the same passphrase, origin and CSRF protected owner setup page, with strict returned event identity/type/time validation. Unavailable and unknown receipts fail closed; tests prove no lookup before auth. External Stripe delivery, Vercel ingress, full G-4 acceptance and Toolkit D-4 all remain unverified; LIVE OFF, no provider writes/money. Session ends #160; next #161–#165 after deployed exact-head verification.


- **#159 RTC real-service safe-wire acceptance (as-if-merged; exact-head CI required):** new disposable real-Postgres HTTP service integration tests run the actual Stripe registry and RTC guard through loopback requests, exercising public manifest, TEST-only pass whoami, scoped tool metadata/read, financial write refusal, cross-pass result ownership, revocation/expiration. This is real server code in CI, not hub reference fake tests; external owner D-4 direct/relay/Sandbox and full-role conformance remain unverified. No live mode.


- **#158 Owner-selected scoped RTC passes (as-if-merged; six CI gates required):** owner-only CSRF/password TEST pass form now selects at most six verified read-only areas, defaults to server-only, persists exact TEXT[] grant atomically, and the HTTPS boundary enforces it. Adversarial issuer, owner form and real Postgres round-trip tests; 24h TEST, $0 money, no writes/LIVE unchanged. Next #159 real server safe HTTPS conformance and D-4 authentic route setup.


- **#157 RTC paged discovery and projection compatibility (as-if-merged; CI required):** GET /api/tools now accepts bounded offset/limit, truthful next, and audience filtering; HTTP reads accept validated array field selectors translated for the existing safe core projection. Regression tests cover disjoint pages and invalid selectors. Next: service conformance harness and D-4 route evidence, not yet accepted. TEST/read_only and LIVE OFF.


- **#156 RTC scoped-pass least privilege (as-if-merged; CI required):** RTC HTTPS discovery, describe, direct calls and batch now intersect any persisted area grant; fail closed on malformed grants, refuse money/destructive-labelled reads and prevent scoped meta-dispatch tunneling. Read-only TEST with zero money remains mandatory. Dedicated unit regressions validate denial. Next: conformance against genuine service and pagination/scope issuance, then D-4 route evidence; no owner LIVE activation.

- **#155 RTC 1 HTTPS TEST read-only compatibility (as-if-merged, exact-head CI required):** public manifest/OpenAPI and pass-only GET discovery/whoami/results plus guarded read POST/batch, owner-intent revocation of both pass/connector identities, per-pass atomic PostgreSQL rate limiting, prefix-normalized HTTP names without breaking `/api/mcp`. All HTTP execution remains TEST/read_only; zero writes/money. Hub pinned reference conformance selftests run in CI but are **not** service conformance: real Stripe URL/full-role runner, genuine direct/relay/sandbox D-4 paths, owner pass issuance/revocation evidence and external OAuth still pending. Public manifest carries `conformanceStatus:pending_full_approval_and_provider_acceptance`; no LIVE/H-1 advancement. End batch #155 and next #156–#160.

- **#154 RTC read-only TEST pass issuance (as-if-merged; CI required):** owner-only passphrase/CSRF creates cryptographic 24-hour Bearer, stored only hashed, TEST/read_only, no writes/money, 120/min intended shared limit. Existing one-time secret page handoff, existing owner connection revocation; pass HTTPS validation and shared atomic rate limit remain next work. No hub route acceptance claimed. Preserve standalone MCP and LIVE OFF.

- **#153 Sandbox-only signed webhook receiver (as-if-merged; exact-head CI required):** dedicated raw-body POST route under `/api/stripe/test-webhooks/[account]/[endpoint]`; scoped encrypted TEST signing secret, 300-second HMAC tolerance, verified explicit TEST/non-Connect event, atomic receipt replay ledger, no event body/PII storage. Unit/real throwaway Postgres evidence only. Genuine Stripe delivery, external route accessibility through Vercel protection, endpoint registration and owner receipt lookup remain PENDING. No Stripe writes, LIVE, or spending; H-1 still gated.

- **#152 TEST Setup & Readiness Report (as-if-merged; CI/review gates required):** owner-private TEST custom MCP smoke now generates a strictly allowlisted, exception-focused readiness assessment. An observed native read is not owner-intended configuration; partial/unreadable/error are differentiated and none imply a required Stripe setting change. Webhook delivery/signature, external OAuth and full Dashboard comparison remain unverified, G-6 IN_PROGRESS, H-1 gated, LIVE disabled. Next approved slice: isolated TEST webhook receiver and genuine signed delivery evidence; do not register a nonreceiver.

- **October 12 owner handoff:** owner-reported connected TEST smoke after #151: G-5 account_get not_readable, capabilities partial, payment methods/domains observed; G-4 events/webhook listing observed; G-6 overview/security partial, guided settings and requirements not_readable, payment setting readback observed. This is owner-reported custom MCP evidence, not independent agent replay. Matching signed-in Sandbox Dashboard showed phone/no tasks, Cards and newly enabled ACH Direct Debit, authenticator 2FA, sole member, zero invites, visible standard keys, no visible webhook/domain, portal offering setup; Successful payments email inactive, Receipt active separately (no inference of sending). Most other Sandbox settings unchanged from their defaults unless directed here, **but uninspected defaults remain unknown**. Do not ask owner for blanket setting walkthroughs. No webhook delivery, external OAuth or full G-6 Dashboard acceptance recorded.

- **#151 G-6 owner TEST smoke bounded overview (as-if-merged; exact-head CI required):** owner-reported connected TEST administration smoke `stripe_admin_overview:error`, `admin_review_security:partial`, `admin_list_guided_settings:not_readable`; owner-smoke dispatch has no scoped result store while full owner overview is larger than 8 KB. An explicit status-only overview for smoke preserves actual native TEST readbacks, 14 unchecked Dashboard items, and the existing full view for scoped MCP connections. Adversarial and real dispatcher tests cover size, partial/unreadable state, and invalid arguments. Owner rerun and signed-in Dashboard acceptance pending; H-1 gated and LIVE disabled.


- **#150 owner TEST verification compatibility (merged as-if; all five exact-head CI checks required):** Stripe Account objects omit `livemode`; require independently matching authenticated Account ID and a same-client, read-only Balance object with explicit `livemode:false` when absent. Denied Balance read fails closed (owner may need to grant Balance: Read for the enrolled restricted TEST key). Apply across TEST key enrollment/reprobe, G-5 native account readers/writes, G-6 owner readers and custom owner smoke. No decrypted keys, LIVE, approvals or money operations. Real connected TEST and Dashboard acceptance remain PENDING. Official Stripe API: https://docs.stripe.com/api/accounts/object and https://docs.stripe.com/api/balance/balance_object.

- **#149 merged** at `7c9e981b75806e7fbfdbfdc84622ed11ca2185a2`, all five final main CI checks passed; late P2 findings resolved. The historical #149 pending paragraph below is superseded.

- **#149 pending CI (ai/gpt6/oauth-security-review-149):** Three late P2 OAuth/HTTP findings from #144/#146 addressed in code and regression tests: case-insensitive Basic, RFC 6749 challenge on HTTP auth rejection and early original transport-byte checks before DB initialization. Resolve historical review threads only after exact-head tests pass. External custom MCP TEST, SSO OAuth and signed-in Dashboard evidence pending; H-1 gated, LIVE disabled.


- **#148 OAuth DCR standards default (proposed; five exact-head CI jobs and review required):** Newly registered confidential OAuth clients without an explicit method use HTTP Basic; existing persisted POST clients and explicitly registered POST/public clients remain unchanged. Code exchange, refresh and rejection paths have regression tests. Owner Dashboard walkthrough, external Vercel-protected OAuth and connected custom MCP TEST provider evidence remain pending; H-1 gated and LIVE disabled.

- **#147 isolated owner TEST smoke groups (proposed; CI/review required):** Split existing custom read-only MCP owner verification into G-5 account (4), G-4 events/webhooks (2) and G-6 readiness (2), keeping core (8) and administration (3). Protected owner page validates exact group/tool projections; true TEST account preflight remains mandatory. No real provider or Dashboard acceptance, no LIVE, money or Vercel policy change.

- **#146 bounded OAuth client registration (proposed; verify exact-head CI):** Public registration now rejects oversized redirect URIs, unprintable/overlong names, and mismatched OAuth response/grant declarations before client creation. Shared HTTP body limits also cover pre-parsed objects. No key, money, LIVE, owner-permission or Vercel protection change. External OAuth/TEST evidence still pending.

- **#145 browser OAuth/MCP CORS compatibility (proposed; exact-head CI required):** Credentialless browser clients can preflight token, registration, OAuth discovery and bearer-protected MCP endpoints; owner authorization and setup remain non-CORS. CORS never grants an MCP bearer or private owner credentials. External Vercel SSO/OAuth smoke is still pending; LIVE disabled.

- **#144 OAuth confidential-client compatibility (proposed; verify CI before merge):** Explicitly registered `client_secret_basic` clients can exchange authorization codes and rotate refresh credentials using HTTP Basic without mixing body secrets. Existing confidential POST and public PKCE methods retain their defaults. Security and protocol regression tests run through CI. External live browser/custom connector OAuth and provider TEST acceptance still pending; Vercel protection and LIVE policy unchanged.


- **#143 G-6 custom-MCP owner administration smoke (as-if-merged; exact-head CI and review required):** owner-private TEST acceptance now has separately bounded core and G-6 administration groups (native owner overview, security, guided settings). Authenticated owner POST can choose either; both use actual repository read-only MCP dispatch, strict TEST identity, a fixed tool allowlist and redacted status-only browser projection. Critical safety: admin overview can only be **partial** until a genuine signed-in Dashboard walkthrough; guided-only settings are **not_readable**. No real provider smoke, Dashboard comparison or external OAuth test has been executed by CI. H-1 gated, LIVE off.


- **#142 secure enrolled TEST key identity (merged; five exact-head CI checks passed):** Initial owner setup now requires genuine provider account object and explicit `livemode:false` before encrypting an enrolled TEST key. The server-only permission reprobe also requires a fresh exact-account provider TEST identity before any permission calls or permission metadata updates. Provider errors, absent modes and foreign accounts fail closed; existing enrolled TEST key is not read/exposed or changed by this implementation. G-4/G-5/G-6 external authenticated smoke, owner Dashboard and OAuth compatibility remain PENDING.


- **#141 owner-private custom MCP TEST evidence path (merged; five exact-head CI checks passed):** The protected same-origin, CSRF-bound and independently passphrase-authenticated setup page can trigger eight read-only native custom MCP handler readbacks for an explicitly selected enrolled TEST account using the server's normal encrypted credential loader; only allowlisted statuses reach the browser. **No raw key, ciphertext, webhook secret, Stripe payload or SDK exception is returned.** This is owner-initiated TEST verification capability, NOT evidence that an owner executed it; G-4/G-5 smoke and G-6 Dashboard walkthrough remain PENDING until actual results are obtained. Vercel SSO is unchanged.


- **#140 OAuth public-client interoperability (merged; five exact-head CI checks passed):** Support explicitly registered PKCE-only public MCP clients alongside existing confidential clients without issuing shared secrets; keep S256, TEST-only scoped grants, owner passphrase, secretless database records, and replay-resistant refresh. This is automated protocol compatibility, **not** connected custom MCP OAuth acceptance; Vercel SSO and Dashboard/TEST smoke still require independent verification.


- **Current infrastructure/TEST checkpoint, verified 2026-10-11 Colorado:** Vercel `Robinson AI Systems / stripe-mcp` Production latest build READY on branch `main` (verified at `24b2bfd830bf701689a1aaef1264f15b0c32b162` before this docs-only handoff). All four Production environment-variable **names and Sensitive/plain classifications** verified without decrypting values: `DATABASE_URL` (Sensitive), `ADMIN_PASSPHRASE` (Sensitive), `TOKEN_ENCRYPTION_KEY` (Sensitive), `PUBLIC_BASE_URL` (plain). Dedicated Neon Launch `stripe-mcp` / `stripe_mcp` (0.25 CU maximum, five-minute auto-suspend) has exactly all 24 expected application tables. Read-only Neon aggregate: **1 Stripe TEST account row, 1 encrypted TEST key, 1 recorded key verification, 0 stored LIVE keys, 0 LIVE-enabled accounts**. No key contents, ciphertext, credentials, account ID or owner password retrieved. Vercel Authentication remains enabled; confirm external custom MCP OAuth compatibility before adjusting deployment protection. **G-4/G-5 authentic selected-TEST-account provider smoke, G-6 authenticated Dashboard owner walkthrough, and refresh/revocation remain PENDING**; a DB key-verification record is not acceptance of any of these. Run the repo's guarded custom MCP smoke harness only with independently owner-authorized credentials delivered privately, never by decrypting the DB key or using the standard Stripe connector.

- **One-time next development-session PR count:** The previous code-development session merged **#131–#135** (five) and its owner-requested **extra sixth implementation PR #136** (strict TEST-provider identity, merged as `0e4ae2c873713e56de50d97af8e550d698eca0fe`). **Credit #136 as slot 1 of 5 in the NEXT development session; complete exactly four MORE qualifying, substantial approved implementation PRs as slots 2–5, not five new ones.** Infrastructure/documentation PRs #137–#139 (including this docs-only handoff) do **not** consume those four slots. Count only genuinely merged qualifying development PRs; don't invent fillers or count blocked acceptance as completed. After the next session, return to the ordinary five-PR-per-chat cadence. Verify current main/reviews/CI before applying this one-time carried credit.

- **Historical IN-02 checkpoint (#138):** Owner approved Neon Launch metered provisioning without subscription upgrade; the isolated `stripe_mcp` database and sensitive Vercel `DATABASE_URL` were created. At #138 the owner secrets and TEST key were not yet installed. **Superseded by the verified current infrastructure/TEST checkpoint above.**

- **#136 G-5/G-6 strict TEST provider identity (as-if-merged; exact-head CI required):** one shared provider-account validator requires explicit `livemode:false`, not merely the absence of `true`, before G-5 native readers/writes, G-6 native administration, and owner-local custom MCP smoke. Missing, null or string modes fail closed without downstream TEST calls. Genuine external TEST smoke and Dashboard owner walkthrough remain PENDING; G-6 IN_PROGRESS, H-1 gated, LIVE disabled.

- **#135 G-6 owner security probe identity gate (as-if-merged; exact-head CI required):** fresh TEST key-permission reprobe and webhook checks require independent selected-account identity evidence. Stored masked local metadata remains explicitly unverified by the provider. Regression tests assert zero permission/webhook calls after refusal or foreign identity. G-4/G-5/G-6 genuine custom TEST smoke and signed-in owner Dashboard walkthrough still PENDING. H-1 remains blocked, LIVE disabled.

- **#134 G-6 truthful partial owner readback (as-if-merged; exact-head CI required):** bounded capabilities page now differentiates partial observations from unreadable permissions; readiness reports seven native categories as complete/partial/unreadable, separate from unverified Dashboard owner comparison. No Stripe mutation or real TEST connected acceptance; G-6 IN_PROGRESS, H-1 gated, LIVE disabled.

- **#133 custom-MCP TEST smoke evidence classification (as-if-merged; exact-head CI required):** each of the eight G-4/G-5/G-6 smoke readbacks must match an expected tool-specific and account-bound safe projection. Arbitrary JSON, wrong account, missing read shape and errors are not success. CI tests are mocked; authentic owner TEST run and G-6 Dashboard walkthrough remain pending. LIVE disabled.

- **#132 opt-in custom-MCP TEST smoke runner (as-if-merged; exact-head CI required):** read-only server-side script exercises the registered G-4/G-5/G-6 handlers through this repository's own MCP dispatch with an independently verified selected TEST Stripe account. No borrowed generic Stripe connector, provider credentials in source, data mutation, or Dashboard-completion claim. CI tests use mocked SDK and prove the runner's no-write/refusal/redaction contracts. Genuine owner-run results remain PENDING until executed against a securely configured TEST account.

- **#131 G-6 owner identity evidence hardening (as-if-merged; exact-head CI required):** require genuine safe account boolean fields with matching account identity before native owner overview/security/guided aggregation; incomplete projections cannot trigger downstream account reads. Regression tests added. This does not constitute connected TEST smoke or authenticated Dashboard acceptance. G-6 remains IN_PROGRESS and H-1 stays gated; LIVE disabled.

- **#130 G-6 expanded structured Dashboard guide coverage (as-if-merged; exact-head CI pending):** eleven additional owner-account payment, invoicing, reporting, security, tax and developer settings have safe procedural guides and honest not_readable native status. Guarded G-6 tests validate no hidden API calls or owner verification claims. Remaining G-6 actual signed-in TEST Dashboard walkthrough and G-4/G-5 connected smoke cannot be completed without independently authenticated owner/test-account access. H-1 remains gated by G-6, no LIVE.

- **#129 G-6 TEST fee reconciliation (as-if-merged; exact-head CI pending):** bounded fee ledger now safely exposes signed gross/fee/net minor-unit samples by currency and reporting category, independently checks accounting equality and fee-detail sums, and retains partial/statement-unverified disclosures. Unit tests include USD negative adjustment and multi-currency sampling. G-6/G-4/G-5 owner-connected TEST evidence and Dashboard walkthrough remain pending; LIVE disabled. Next remaining G-6 Dashboard map evidence/acceptance work.

- **#128 G-6 owner walkthrough checklist (as-if-merged; CI pending):** TEST admin_overview now surfaces a bounded, prioritized Dashboard owner-review checklist plus explicit unverified native-vs-owner evidence totals. All 14 high-impact settings stay ownerConfirmed:false; even native 'observed' is not external owner acceptance. Unit tests cover observed/refused and PII. G-6 cannot be complete without owner TEST walkthrough; G-4/G-5 smoke pending. Next G-6 fee-ledger reconciliation and remaining map completeness.

- **#127 G-6 TEST provider provenance (as-if-merged, exact-head CI required):** independent own-account TEST identity is now mandatory before overview reads capabilities or native settings, security review reports observed webhooks, or guided account verification reports success; provider refusal leaves sections not_readable and prevents downstream native requests. Added unit isolation/permission tests. External account TEST smoke and Dashboard walkthrough remain pending; do not mark G-6 complete or start dependent H-1 acceptance yet.

- **#126 engineering efficiency (as-if-merged; CI pending):** shared strict TEST owner administration transport across four handlers, fail-closed regression tests, npm cache in all four existing verification jobs while preserving the fifth aggregate gate, canonical startup and JIT guidance. No Stripe API, credentials, money, LIVE or owner authorization changes. Next: owner-connected G-6 acceptance and G-4/G-5 smoke still unverified; follow approved H-1 JIT implementation without claiming TEST acceptance.

- **G-6f guarded native guided-settings observation (#125 as-if-merged; exact-head CI pending):** selected TEST account identity and existing independently scoped native bank/schedule/payment/domain/webhook/portal readbacks, explicit incomplete/not_readable, never equate observed with owner-intended configuration. G-6 automated tools implemented, **G-6 remains IN_PROGRESS** pending an actual authenticated owner TEST account walkthrough and Stripe Dashboard map validation; G-4/G-5 connected smoke still pending. No LIVE or money.

- **G-6e native owner overview evidence (#124 as-if-merged; CI pending):** aggregate registered TEST readers for masked bank, payout schedule, payment configuration/domain, webhook endpoints and portal; each section observed/partial/not_readable separately, with all mapped guided states. No Stripe mutation/secret/PII. Next G-6f guided setting readback and full acceptance reconciliation. G-4/G-5 actual owner-connected smoke still pending.

- **G-6d bounded TEST fees and billing (#123 as-if-merged; CI pending):** independently scoped TEST balance-transaction ledger scan, fee breakdowns by currency/type, reconciled totals and explicitly partial paging. Stripe Billing/Tax/Radar invoices and pricing remain unverified; owner guided statement checks. Next G-6e expand verified owner overview, then final dashboard map/acceptance. LIVE off; real G-4/G-5 TEST smoke pending.

- **G-6c owner TEST security review (#122 as-if-merged; CI pending):** masked key metadata, read-only permission probe presence, account-scoped connection counts, sanitized TEST webhook status and explicit Dashboard-only gaps (two-step, roles, invitations, apps and key rotation). No secret, pass or LIVE. Next G-6d bounded TEST fees/billing. G-4/G-5 connected Stripe smoke pending.

- **G-6b TEST owner overview and requirements (#121 as-if-merged; CI pending):** safe category counts, Colorado deadline, dashboard guidance, partial observed account/capability overview, explicit unreadable sections and no private requirements. Next G-6c security review, G-6d fees/billing and remaining guided verification. G-4/G-5 connected TEST smoke pending, LIVE off.

- **G-6a guided Dashboard administration (#120 as-if-merged; exact-head CI pending):** structured TEST-only owner Dashboard settings catalog and independent account-verification observation, 12 extended setting groups and contract-style URL/expected/verifyWith. Unreadable is never reported healthy; no Dashboard mutation, secret or LIVE. Next G-6b admin overview and requirements, then security and fees. G-5 native implementation complete, real own-account TEST key smoke for G-4/G-5 still pending.

- **G-5d2 TEST domain registration (#119 as-if-merged; exact-head CI pending):** guarded payment-method domain creation with selected TEST account, exact public hostname, duplicate prevention, idempotency, and independent provider registration readback; no guarantee of activated Apple Pay. Next G-5 automated acceptance/owner TEST smoke gap then G-6 administration. LIVE disabled.

- **G-5d1 native TEST Apple Pay payment-domain reads (#118 as-if-merged, CI pending):** bounded Stripe paymentMethodDomains list with exact TEST identity, safe domain/status projection and honest permission fallback. Stripe's modern payment_method_domains replaces stale Apple Pay-only API terminology. Next guarded add-domain G-5d2; no connected TEST smoke or LIVE.

- **G-5c2 guarded TEST payment-method preference update (#117 as-if-merged, CI pending):** strict direct configuration, preview/confirm/retry, independently re-read selected method, Dashboard fallback on provider refusal. No real own-account Stripe TEST smoke, LIVE disabled. Next G-5d Apple Pay domain reads then guarded addition; G-5 IN_PROGRESS.

- **G-5c1 payment-method configuration reader (#116 as-if-merged; CI pending):** read-only native TEST per-configuration method status with owner identity, pagination, safe projection and honest permission-denied fallback. No connected TEST credential smoke; do not infer Checkout enablement. Next guarded G-5c2 update with independent provider re-read; G-5 IN_PROGRESS, LIVE OFF.

- **G-5b native account_list_capabilities (#115 as-if-merged, CI pending):** TEST-only verified own-account capability statuses, bounded safe paging and permission-denied guidance; no inferred ACH/Checkout enablement, no raw requirements, no LIVE. Next G-5c own-account payment-method settings read and controlled trial; G-5 remains IN_PROGRESS. Connected Stripe TEST provider smoke is still pending.

- **G-5a native account_get (#114 as-if-merged; exact-head CI pending):** selected TEST own-account safe read of payment readiness, requirement counts and Denver deadline with no unfiltered provider object. Restricted-key permission denial reports not-readable; LIVE and foreign account refused. Next G-5b capability safe reads, then settings trial and guided operations. Connected TEST smoke pending; LIVE OFF.

- **G-4 automated acceptance and G-5 handoff (#113 as-if-merged, exact-head CI pending):** event and native webhook tool scope from #103–#105 and #108–#112 reconciled with unit, mock, DB and guarded-write checks. G-4 implementation complete with **real connected TEST-account smoke NOT VERIFIED**; the external G-4 test evidence remains unchecked. Next G-5a safe TEST account profile reader, then capability and payment-method settings. LIVE disabled and every independent money-out approval unchanged.

- **G-4e2 credential lifecycle (#112 as-if-merged, CI pending):** private authenticated owner removal of stored TEST signing credentials, fail-closed verification after removal, and tested encrypted rotation. Next: G-4 final automated acceptance, then G-5 code work. Connected TEST smoke remains pending; LIVE OFF.

- **G-4e2 signature checking (#111 as-if-merged, CI pending):** owner-password and CSRF authenticated TEST endpoint secret provisioning; encrypted account+endpoint-bound storage; server-only signature validation, no event payload/secret echoes. Connected TEST-account smoke remains pending; next G-4 acceptance reconciliation, then G-5. LIVE OFF.

- **G-4e1 guarded native webhook update/delete (#110 as-if-merged; exact-head CI pending):** TEST-only native destination/description changes and endpoint deletion use independent provider reads, stale-plan and app/Connect ownership refusal, selected-account idempotency, and deletion 404 tombstone verification. No signing secret is revealed. **Next G-4e2:** owner-configured server-only signature check and remaining batch acceptance. G-4 stays IN_PROGRESS; connected TEST smoke pending; LIVE disabled.

- **G-4d2 native webhook create (#109 as-if-merged; exact-head CI pending):** TEST-only full-profile guarded native Stripe webhook creation is backed by G-4d1's durable exact retry ledger. Owner password/CSRF setup page alone reveals the ten-minute single-use signing secret; MCP exposes only the setup path. No LIVE, money-out or connected TEST smoke. **Next G-4e:** guarded endpoint update/delete and signature verification, then G-4 closure.

- **G-4d1 webhook creation retry ledger (#108 as-if-merged; exact-head CI pending):** additive per-account immutable request-key/configuration reservation and verified endpoint-ID completion. No signing secrets are stored in this ledger and no native webhook create is exposed yet. **Next G-4d2** guarded native create and owner-only single-use signing-secret handoff. Connected TEST smoke pending; LIVE disabled.

- **G-4c (#105 as-if-merged; exact-head CI pending):** distinct guarded TEST webhook event-subscription add/remove. Provider list is fully read, exact union/difference applied with Stripe-native idempotency and verified readback; wildcard, empty subscription, app/Connect ownership, stale plans and secret-bearing audit are refused. **Next G-4d:** secure owner-only one-time signing secret handoff for guarded webhook create. G-4 remains IN_PROGRESS. No connected Stripe TEST account smoke; LIVE disabled and owner money-out policy unchanged.


- **G-4b (#104 as-if-merged, exact-head CI pending):** native TEST webhook endpoint list/get, bounded event names/count and HTTPS origin-only destination. Raw URL path/query, metadata and one-time signing secret are never exposed. **Next G-4c guarded add/remove enabled event subscriptions**, preserving all unrelated event types and app ownership. LIVE stays off; connected TEST smoke pending.


- **G-4a (#103 as-if-merged; CI pending):** native TEST Event list/get/undelivered, only whitelisted event summary and safe reference IDs. delivery_success=false is a provider filter, not app processing proof. Next G-4b webhook metadata reads, then guarded event subscriptions and private owner-only signing secret handoff. No connected TEST smoke, LIVE or money-out.


- **G-3 Radar/Identity acceptance closed (#102 as-if-merged, CI pending):** #97–#101 merged, 16 native TEST Radar/Identity tools (11 Radar and five Identity). Registry, privacy, guarded-write, profile, app protection, native stripe-mock, DB and exact-head CI evidence reviewed in the batch closure note. **Next: G-4a safe event list/get/undelivered**, then G-4 webhook reads and guarded endpoint administration. Provider-connected TEST smoke for G-3 and earlier V/G remains pending, not passed. LIVE stays OFF; owner-approved money-out policy unchanged.


- **G-3e (#101 as-if-merged; exact-head CI/review pending):** distinct guarded TEST Identity cancellation and irreversible redaction request, with provider state preflights, idempotency, private data withheld and independently re-read outcome. Stripe redaction may remain processing up to four days; no premature completed-erasure claim. **Next:** G-3 batch closure (DRIFT C), then G-4 events/webhooks JIT. LIVE disabled; genuine Stripe TEST smoke remains pending.


- **G-3d private TEST Identity reads/creation (#100 as-if-merged; exact-head CI pending):** two full-only safe Identity session readers and guarded TEST session creation, explicit confirm/idempotency, provider identity/status/URL read-back, only Stripe verified hosted URL returned; no client_secret, reports or document data in MCP/audit. Next **G-3e** cancel/redact session and G-3 acceptance closure. No LIVE or real TEST account smoke. Session limit: 6 merged this chat only, then resume recurring five-PR handoffs.


- **G-3c TEST Radar list lifecycle (#99 as-if-merged; exact-head CI pending):** full-only guarded empty-list deletion, item add and item removal with selected-account TEST preflight, private item value redaction, stable idempotency and deletion tombstones. No silent deletion of nonempty lists. Next **G-3d Identity session reads and guarded creation**, then cancel/redact. No LIVE.


- **G-3b first guarded Radar mutations (#98 as-if-merged; exact-head CI pending):** full-profile TEST review approval and new value-list creation now use distinct defineWrite preview/confirm/idempotency/independent read-back, app-owned payment guard and safe alias preflight. Next **G-3c** list/item lifecycle deletions/additions; then Identity. No LIVE.


- **G-3a Radar safe TEST reads (#97 as-if-merged; exact-head CI pending):** warning/review/status and value-list/item IDs now use six SDK read paths with strict TEST identity/pagination and no IP, email, card, secret or sensitive list values in results. Radar rule endpoint remains intentionally absent. Next **G-3b** guarded Radar review and value-list mutations, then Identity. No LIVE.


- **G-2d2 acceptance (#96 as-if-merged; exact-head CI pending):** ordinary USD TEST dispute acceptance now requires independently authenticated owner money-out consent bound to exact du_ dispute and provider-derived cents, shared $500/account/Denver-day cap and distinct owner override above it. Uses irreversible disputes.close, no refund, with lost read-back; unapproved, uncertain or app-owned targets fail closed. G-2 code-complete pending real Stripe TEST evidence; **next G-3 Radar and Identity**. LIVE remains OFF.


- **G-2d1 submission (#95 as-if-merged, exact-head CI pending):** independently confirmed TEST-only irreversible staged evidence submission uses a complete field inventory, verifies file purpose and dispute deadline, protects app-owned charge/customer, and re-reads provider submission count/status. No private evidence enters previews/results/audit. Next **G-2d2** separately owner-approved dispute acceptance with dispute-ID money-target validation, shared $500/day cap and independent above-cap override. No LIVE or real TEST account smoke.


- **Verified planning checkpoint (2026-10-11):** main `2a71f8a03845ad3bf8c8de9de4207a72596ace78`, #93 merged,
  no open PRs at inspection. Next implementation is **G-2d** (separate irreversible submission/owner-approved acceptance).
  [Implementation guides](implementation-guides/README.md) now provide inspected helper recipes, remaining-scope routes
  and a proposed G-2d packet, including the missing `du_` money-target validator integration. No product code, owner
  permissions or CI gates changed. Older as-if-merged entries below are historical checkpoints, not pending PR claims.

- **G-2c secure TEST dispute evidence drafts (#93 as-if-merged, exact-head CI pending):** dispute_save_evidence stages validated draft fields with explicit submit:false; verifies same-account evidence files, protects app-owned charges and deadlines, then confirms exact provider read-back with no customer text leaked into the result. Next G-2d distinct irreversible submit_evidence and dispute_accept tools; dispute acceptance is money-out and must use independent owner approval, $500/day shared cap, and second override above cap. G-2b2 evidence import #92 merged green. No LIVE or actual money moved.

- **G-2b2 secure public-source TEST dispute evidence import (#92 as-if-merged; exact-head CI pending):** file_upload_evidence uses the write preview/confirm/audit contract, pinned public IPv4 DNS, HTTPS only, verified redirects, 10 MiB cap and content signature. It creates only a verified Stripe dispute_evidence file; never attaches or submits evidence. G-2c guarded draft evidence save is next, G-2d explicit submit/accept after that. G-2b1 file metadata/link #91 merged green. LIVE and independent money-out approval unchanged.

- **G-2b1 guarded TEST file metadata and public-brand links (#91 as-if-merged, exact-head CI pending):** file_list/get return purpose-allowlisted metadata with no provider URLs; file_create_link is full-only guarded, expiring, and restricted to brand icons/logos (never dispute evidence). G-2b2 remote evidence import next, followed by drafting and submitting evidence. G-2a dispute reads #90 merged green; G-1 closed #89. LIVE and owner money-out policy unchanged.

- **G-2a TEST dispute list/get (#90 as-if-merged, exact-head CI pending):** New read_only summaries of validated disputes, money in minor units, Colorado evidence deadlines and days left, submission count, safe status; no raw evidence or cardholder details. New G-2 index/card and downstream G-2b secure evidence handling next. G-1g secure browser CSV merged #89 (five checks green). LIVE remains off; owner approval/limit unchanged.

- **G-1g owner-authenticated TEST CSV export (#89 as-if-merged; exact-head CI pending):** The private setup page now requires owner passphrase, origin/CSRF and a valid connected TEST account before streaming a strictly verified report CSV (5 MiB limit) directly to the browser. MCP never sees contents, provider URLs or keys. G-1 is implementation-complete pending required CI and owner-connected TEST verification. **Next G-2 dispute read tools and separate evidence handling.** No LIVE or actual account activity. Session limit: 5 merged PRs then recursive handoff.


- **G-1e TEST payout schedule setter with guided refusal (#87 as-if-merged, CI pending):** full-only guarded attempt for own account, pending/denied results include TEST dashboard steps; no claims without read-back. Weekly/monthly anchors validated. Next G-1f report export evidence and G-1 completion, then G-2 disputes.

- **G-1d2 guarded TEST report-run creation (#86 as-if-merged, CI pending):** full-only preview/confirm/audit/idempotency, provider type-availability/interval validation, asynchronous create/read-back and exact job ID/status, no fabricated completed report or CSV URL. Next G-1e payout schedule setter; then report export and G-1 completion/G-2.

- **G-1d1 TEST report types and runs (#85 as-if-merged; CI pending):** read-only provider report catalog (bounded sorted cursor), run history/status and exact result file ID; explicitly no fictitious signed download URL. Next G-1d2 guarded report generation and download guidance, then G-1 completion/G-2.

- **G-1c4 TEST synthetic-bank top-up create/pending cancel (#84 as-if-merged; CI pending):** no default/unverified real bank; fixed Stripe `btok_us_verified` TEST token, independently authenticated owner approval for bank-debit nature, shared daily cap and separate override, idempotent native SDK and read-back. Any non-synthetic source remains unavailable until separate design and owner authorization. Next G-1d reports.

- **G-1c3 independently owner-approved TEST payout reversal (#83 as-if-merged, CI pending):** eligible paid manual US bank payout reverse only, exact bank-target and Stripe amount from provider, B-8 owner grant, shared $500/day cap/second override, idempotency, independently verified reverse and original payout records. Bank debit, not equivalent to cancel; no LIVE or actual banking. Next G-1c4 top-up lifecycle, G-1d reports.

- **G-1c2 TEST owner-approved manual payout creation (#82 as-if-merged; CI pending):** exact account and verified bank identity, checked USD source-type balance, full-only guarded write, independent authenticated owner grant, shared $500/day limit and override, idempotency and post-write payout read-back. No live payout or bank debit. Next G-1c3 bank-debit reversal, G-1c4 top-ups and G-1d reports.

- **G-1c1 payout metadata and pending manual cancellation (#81 as-if-merged, exact-head CI pending):** TEST-only full-profile writes with defineWrite, confirmation, idempotency, app protection and provider read-back. No payout created, bank debited or money-out made. Next G-1c2 independent owner-approved payout creation/reversal, then G-1c3 top-ups and G-1d reports.

- **G-1b bank-account masking and payout schedule reads PR #80 (as-if-merged; exact-head CI pending):** two new TEST-only safe account-scoped readers. Stripe's external account endpoint is Connect-oriented; if own account lacks API access, report unavailable and point to dashboard rather than inventing empty bank results. Last4-only bank outputs, no routing/account numbers. **After #80 merge: stop for new chat as owner requested. Next G-1c** owner-approved payout/topup money-out writes; preserve independent owner intent for every amount and shared $500/day threshold/override.

- **G-1a account financial read-only tools PR #79 (as-if-merged; exact-head CI/review pending):** eight TEST-only tools provide provider-verified balance, balance transactions, payouts, automatic payout reconciliation, and top-ups, no raw bank data. Current main e5a22828 is V-5 complete. **Next G-1b** payout bank account safe listing and payout schedule reads, then G-1c owner-approved money writes and G-1d reporting. No money-out attempted.

- **V-5 automated three-month acceptance PR #78 (as-if-merged; exact-head CI/review pending):** one stateful fake Stripe provider runs 3 monthly clock advances, 3 independently retrieved paid invoices/PI and original Events, validates exact timelines, at-most-once retries and delayed/declined branches. Prior V-5a–V-5c code #72–#77 remains. **Next G-1:** balance, payouts and financial reports, subject to mandatory independent owner consent for any money out.
- **External evidence still pending (not coding blockers):** real Stripe TEST-hosted Checkout (#V-3) and public signed webhook target (#V-4), and actual provider three-month renewal. No genuine account smoke results have been invented; LIVE stays OFF.

- **V-5c3 TEST monthly billing reconciliation PR #77 (as-if-merged; exact-head CI pending):** guarded dev_simulate_subscription action=observe verifies exact TEST clock, recurring price/subscription, unique paid/open invoice, invoice-payment allocation, linked PaymentIntent and independently retrieved original Event. Only complete evidence makes the month observed, allowing the next month; missing evidence stays uncertain. Next: V-5 sequential three-month acceptance and Batch V documentation.
- **External TEST smoke still pending:** no enrolled Stripe TEST account or owned public HTTPS webhook target for real provider-to-app demonstration. No LIVE or money-out requested.

- **V-5c2 guarded TEST clock advance PR #76 (as-if-merged; exact-head CI pending):** dev_simulate_subscription supports action=advance/inspect for one monthly cycle with exact selected-account provider readback and SQL at-most-once protection. No invoice/paid claim from clock state. **Next V-5c3** monthly invoice/payment and event reconciliation so cycle 2/3 can be unlocked.

- **V-5b restoration correction #75 (as-if-merged; exact-head CI pending):** PR #74's tree accidentally omitted the previously merged #73 simulation setup implementation, tests, and catalog. Restoring those exact reviewed #73 files and registry/count expectations. The V-5c1 monthly ledger remains untouched. Next V-5c2 guarded advance, after exact-head CI. No provider/money action.
- **V-5c1 durable month advancement intent PR #74 (as-if-merged; CI pending):** additive selected-account dev_simulation_cycles table reserves only sequential 1–3 monthly intents for completed TEST simulation runs, records 'uncertain' before any future Stripe clock advance, and accepts only precise provider-ready clock/invoice/PI evidence to mark observed. Same key cannot authorize a second clock movement. **V-5c2 next:** connect this ledger to guarded dev_simulate_subscription phase actions and independently inspect actual invoices/payments/events.
- **Pending external TEST acceptance:** real hosted Checkout and owned HTTPS webhook require enrollment; neither claimed.

- **V-5b clocked TEST subscription setup PR #73 (as-if-merged, exact-head CI pending):** dev_simulate_subscription now creates only isolated synthetic TEST clock, product, recurring price, clocked customer and free-trial subscription, each independently verified and durably run-tracked for V-2 cleanup. 1–3 months, amount and synthetic card explicitly selected. No actual invoice charge/renewal claimed. **Next V-5c:** advance one month at a time, verify READY state and exact invoices, payment and event timeline.
- **Still pending external acceptance evidence:** hosted real TEST Checkout completion and genuine target HTTP smoke require TEST enrollment. Neither has been claimed completed.

- **V-5a TEST fixture catalog #72 (as-if-merged, exact-head CI pending):** read-only dev_test_cards exposes current Stripe-published TEST PaymentMethod IDs for success, card declines, 3DS and ACH scenarios, no PAN, no SDK writes, no LIVE. Existing native testclock tools #53 are reused. **Next V-5b:** guarded 3-month synthetic TEST subscription simulation.
- **Acceptance evidence pending, NOT a coding blocker:** V-4 automated validation passed in PRs #67–#71, but no enrolled Stripe TEST account and owned HTTPS endpoint have been provided for a real provider-to-webhook smoke. V-3 genuine hosted Checkout completion also awaits TEST browser action. Do not claim either was demonstrated. docs/pr-cards/V-4-acceptance.md.

## Historical implementation checkpoints (not the current queue)

- **V-4c2 durable guarded original TEST event replay (PR #71 as-if-merged; CI pending):** adds account-scoped atomic replay and per-event reservation tables. dev_forward_events requires preview, confirm and exact retry key, only TEST originals and active selected-account forwarder, TLS/DNS checks on EACH POST, no redirects, and durable per-event accepted/rejected/uncertain receipts. A retry of an attempted requestKey cannot resend; application processing is never inferred from HTTP receipt. Next V-4 acceptance mapping, then V-5. No LIVE, money-out, app-owned provider mutation or spend.

- **V-4c1 genuine TEST Event replay primitives (as-if-merged; exact-head CI/review pending):** original Stripe v1 Events selected by explicit event IDs or bounded since/type cursor; independently retrieve and verify exact TEST Event, account, type and timestamp. Each outbound HTTPS request freshly verifies all DNS answers are globally public, pins the chosen address in TLS while keeping original hostname/SNI, signs exact bytes with Stripe HMAC and never follows redirects. HTTP 2xx means target accepted, NOT that its app processed it. No public MCP delivery tool yet: V-4c2 adds guarded dev_forward_events and durable replay receipts. LIVE and money-out stay OFF.

- **V-4b2 TEST forwarding management PR #69 (as-if-merged, CI/review pending):** guarded create/delete and account-scoped read-only list tools use V-4b1 encrypted forwarder storage and V-4a public-DNS preflight. Secret handoff is a ten-minute one-time URL, revealed ONLY after owner password/CSRF/origin checks on existing private setup page, never in MCP/audit. Replays retain original secret and cannot reissue the setup link. Next **V-4c**: real TEST Event retrieval and pinned TLS delivery, no redirects. LIVE remains OFF; no money out or production connections used.

- **V-4b1 encrypted TEST forwarder store (as-if-merged):** additive dev_forwarders Postgres table, per-account encrypted-only signing-secret envelope, immutable retry key/config digest, safe list/get projections without secrets and soft deletion so removed targets cannot deliver. One migration only; no public tool or actual outbound request in this slice. V-4b2 next: guarded TEST registration/list/deletion plus owner-authenticated setup-page one-time secret; V-4c: actual original Stripe Event forwarding over pinned TLS with no redirects. V-3 Checkout manual TEST completion remains acceptance evidence to collect; no LIVE/money-out changes.

- **V-4a forwarding security (as-if-merged):** bounded TEST-only Stripe webhook signing helper uses raw original event JSON bytes, timestamped HMAC-SHA256 verified by official Stripe SDK; outbound target preflight rejects non-HTTPS, private/loopback/metadata, query/auth/fragment, untrusted ports and DNS with **any** non-global IPv4/IPv6; resolves once to a pinned TLS destination. No network requests, persistence, tools, LIVE or money-out changes in this slice. Next V-4b durable account-scoped encrypted forwarder CRUD and owner-authenticated one-time setup-page signing secret, then V-4c bounded actual signed delivery with no redirects or DNS re-resolution.

- **V-3c3d actual Stripe-hosted TEST Checkout (as-if-merged):** real checkout.session.completed now uses a synthetic TEST $36 one-time price and customer plus native Checkout Session. Stripe has no Session.complete endpoint: dev_get_checkout_test_url returns the exact run-owned TEST hosted URL, a human/test browser submits a test card, and dev_trigger_event retry verifies Stripe's paid/complete session, original succeeded fully paid PI and independently listed/retrieved original Event before completion. Until real hosted checkout action, run is pending. Cleanup may expire only open run-owned sessions. V-3 feature coverage checkpoint requires genuine TEST manual checkout demonstration; V-4 next after review. LIVE and money-out unchanged.

- **V-3c3c genuinely failed TEST invoice (as-if-merged):** invoice.payment_failed uses a run-owned synthetic customer, non-auto-advancing charge_automatically draft and one independently read/recorded 3600-cent USD invoice item. After native no-auto finalization it attempts one payment via pm_card_chargeCustomerFail; only retrieved open/attempted unpaid $36 invoice and independently observed/retrieved Stripe Event can complete, delayed events remain running. Item/failure evidence retained by V-2 cleanup. Next V-3c3d genuine Checkout completion lifecycle then V-4. No LIVE/money-out changes.

- **V-3c3b real TEST dispute event (as-if-merged):** charge.dispute.created from a genuine pm_card_createDispute TEST $36 payment. Exact run-owned customer/PaymentIntent and provider-linked charge independently verified; async dispute discovered only through Stripe disputes.list filtered by charge and disputes.retrieve, retained in scoped ledger with immutable charge/evidence. Independently list/retrieve matching Event with real du_ object, charge/PI, amount, TEST and account. Missing dispute/event stays running, no fake success; next V-3c3c real invoice.payment_failed and Checkout completion. No LIVE or money-out controls changed.

- **V-3c3a genuine declined TEST payment intent event (as-if-merged):** guarded native payment_intent.payment_failed performs an idempotent synthetic TEST decline only after creating, independently reading and durably recording the exact unconfirmed $36 PaymentIntent. A Stripe decline error alone never proves failure; requires_payment_method, card_declined, zero received amount, customer/account/run provenance and matching list/retrieve Event evidence must be independently observed. Next V-3c3b real failed invoices/disputes and genuine Checkout completion path; V-3 remains in progress. No LIVE, money-out or owner-policy changes.

- **V-3c2 real zero-value TEST invoice event PR #62 (as-if-merged; exact-head CI/review pending):** invoice.created, invoice.updated and invoice.finalized are emitted by real current-native TEST invoice creation, safe description edit and non-auto-advancing finalization. Tracked customer and 0 USD invoice must be independently verified and metadata owned; Event list and retrieve must confirm exact type, ID, run, selected account, 0 amount and valid status. No card/bank collection, no emails, no payout/refund. V-3c3 genuine failed billing/dispute/Checkout next; LIVE off and owner financial controls unchanged.


- **V-3c1 native TEST subscription lifecycle events PR #61 (as-if-merged; exact-head CI/review pending):** Real customer.subscription.created and customer.subscription.deleted events from 7-day trial subscriptions using verified recurring TEST price/customer and durably tagged provider-generated zero-dollar invoice. Only independently observed Stripe Event with matching subscription/account/run/customer/price and correct trialing/canceled state completes. Cancellation creates no final invoice, charge, refund or payout. V-3c2 billing/dispute/Checkout events remain; V-4 follows V-3. LIVE OFF, $500/day and independent owner money-out approval unchanged.


- **V-3b genuine TEST update/cancel event PR #60 (as-if-merged; exact-head CI/review pending):** Added customer.updated, product.updated, price.updated and payment_intent.canceled by actual native Stripe TEST mutations on tagged, run-owned source objects. Mutations are idempotent and independently read back, and emitted Events must match actual post-mutation attributes, selected account, rtc_run and exact provider IDs. Unconfirmed synthetic TEST PI cancellation never cancels processing or paid intents. V-3c harder subscription/billing/dispute/Checkout event flows remain; V-3 stays IN_PROGRESS. LIVE OFF, independent money-out approvals unchanged.


- **V-3a genuine TEST event triggers PR #59 (as-if-merged, exact-head CI/review pending):** Native dev_list_triggers and guarded dev_trigger_event expose only four implemented real Stripe event actions: customer.created, product.created, price.created and payment_intent.succeeded. Each source object is created and independently read, tagged and durably run-tracked; Stripe Event must be independently listed and retrieved with matching TEST account/object/run/amount before marking completed. Delayed event means an incomplete resumable run, never fake success. V-2 cleanup recognizes immutable event ledger IDs and retains them. V-3b additional genuine billing/dispute/Checkout events follows; V-4 only after V-3 completion. LIVE OFF; money-out controls unchanged.


- **V-2b safe TEST seller/clock cleanup #58 (as-if-merged, CI/review pending):** TEST Express seller deletion requires verified inactive charges/payouts, incomplete onboarding and zero connected-account balances. TEST clock deletion requires all run-owned customer/subscription rows cleaned plus no attached customers on Stripe. A delete receipt is not enough; require independent tombstone or exact 404 resource_missing before marking ledger cleaned. V-2 closure pending; V-3 event triggers next. LIVE off; owner-approved money-out limit unchanged.


- **V-2a TEST cleanup PR #57 (as-if-merged; exact-head CI/review outstanding):** dev_cleanup uses only account-scoped ledger IDs, verifies every TEST provider object and run provenance before mutation, then independently verifies eligible cancellation/void/archive/delete actions and marks only exact DB rows cleaned. Per-object retained/uncertain results protect paid invoices, refunds, succeeded payments, TEST clocks and Connect sellers. dev_reset_test_data supplies owner-guided Stripe Dashboard steps, not a false reset. V-2b dependency-aware cleanup follows; LIVE off and independent owner approval rules untouched.


- **V-1b4f TEST Connect onboarding PR #56 (as-if-merged, exact-head CI/review outstanding):** Native TEST-only dev_connect_readiness independently probes selected platform identity and Connect account listing. New marketplace-onboarding seed creates real tagged TEST buyer/catalog and Express seller account records only when Connect is available, verifies all objects/transfer capability state, tracks every provider ID for future cleanup, and creates no charges, transfers, payouts or application fees. Seller onboarding is NOT declared complete; money-out still requires independent owner authorization. Next: V-1 acceptance/remaining gaps, then V-2 cleanup, V-3/V-4/V-5.


- **V-1b4e guarded synthetic ACH confirmation PR #55 (as-if-merged; exact-head CI/review pending):** Added TEST-only dev_confirm_seed_ach for precisely run-owned unconfirmed bank intents, with audited preview/confirm, Stripe-native idempotent confirmation, independent status/cents/customer checks, and bounded exact payment_intent.succeeded event matching in dev_verify_outcomes. No bank settlement claimed, no LIVE, owner-approved money-out rules unchanged. V-1 remaining: capability-gated TEST Connect marketplace, then acceptance/cleanup.


- **V-1b4d real TEST past-due subscription seed PR #54 (as-if-merged, exact-head CI/review pending):** New resumable clocked 7-day trial and failing-card renewal scenario. An advancing clock or merely chosen decline card NEVER completes a run; it finishes only after true provider past_due and attempted unpaid latest invoice, tagged and durably recorded. Exact RTC DEV RUN clock names replace unavailable TestClock metadata; all other objects use rtc_run. Still required before V-1 acceptance: real controlled ACH transition evidence and Connect capability-gated marketplace. V-1 IN_PROGRESS, LIVE OFF.


- **V-1b4c TEST clock prerequisite PR #53 (as-if-merged; exact-head CI/review pending):** TEST-only testclock_list/create/advance now use actual Stripe clock API; a clock advance is NOT declared completed until independent provider read-back says ready at the exact target. Guarded writes, RTC DEV clock provenance and a bounded read showing advancing target are included. This brings only a required V-5 dependency forward, not full V-5 completion. Next V-1b4d real subscription past_due renewal, ACH progression and Connect-gated marketplace; V-1 remains IN_PROGRESS, LIVE OFF.


- **V-1b4b1 paid active TEST subscription PR #52 (as-if-merged, exact-head CI/review pending):** dev_seed adds tagged monthly paid active subscriptions with synthetic saved TEST Visa and a real, independently provider-verified first paid invoice, recorded by ID in the account-scoped ledger. Stripe's initial-payment failure does not prove past_due; V-1b4b2 still needs actual later failed renewals via supported TEST clocks, ACH progression and Connect-gated marketplace. V-1 remains **IN_PROGRESS**; LIVE OFF; no real payments.


- **V-1b4a outcome verification PR #51 (as-if-merged; exact-head CI and review pending):** New TEST-only read `dev_verify_outcomes` independently compares account-bound recorded dispute/ACH payments with Stripe intents/charges and, for disputes, matching actual TEST event records. It cannot claim a missing event never occurred or a PaymentIntent success proves bank settlement/webhook delivery. V-1b4b still requires real active/past-due subscriptions and supported ACH/clock/event progression, plus Connect-gated marketplace. V-1 remains **IN_PROGRESS**; do not start V-2 as completed V-1. LIVE OFF, financial approval/limits unchanged.

- **V-1b3 dispute/ACH test fixtures PR #50 (as-if-merged; exact-head CI pending):** `dev_seed` can create a documented dispute-triggering TEST card payment and an unconfirmed ACH-capable test intent, each tagged `rtc_run`, provider-checked and saved by account. An asynchronous dispute event or bank settlement is explicitly **NOT** declared complete; V-1b4 requires verification and realistic active/past-due subscription flows before V-1 acceptance. LIVE remains OFF.

- **V-1b2 TEST store refund companion PR #49 merged (exact-head green c9bb77a; merge 0986362):** new `dev_seed_refund` resolves a completed synthetic store run's exact charge and remaining cents from Stripe; never refunds automatically. Every refund requires independently authenticated one-use owner approval even below $500, shared per-account Colorado-day cap, extra owner override if over limit, idempotent native refund, and independently verified run ledger entry. Remaining V-1b3: dispute, ACH, active/past-due subscription scenarios. LIVE OFF, no real account activity.

- **V-1b1 TEST scenario expansion PR #48 merged (exact-head green 3eabdf9; merge 83d5a80):** tracked `basic-store` TEST one-time USD payment intents and two free-trial subscription outcomes (trialing/canceled). Exact type/customer/amount/status/rtc_run provider read-back and account-scoped ID ledger; descriptions limited to safe named plans; no automatic refunds or LIVE use. Existing V-1a catalog plan hash preserved. Next V-1b2 handles remaining refunds (separate owner money-out approval), dispute, ACH and past-due simulations. V-1 is **not** yet complete.

- **V-1a tracked TEST seed runs PR #47 merged (exact-head green 60aa96d; merge 53fddc7):** `dev_seed` TEST `catalog-starter` creates tagged products, USD recurring prices, and synthetic customers; every Stripe object receives an independent read-back and durable `dev_run_objects` ledger entry. `dev_list_runs` is account-scoped, with two additive DB tables and stable idempotency. V-1b must finish payment/refund/subscription/dispute/ACH scenarios before V-1 is complete; later V-2 cleanup will only use recorded IDs. LIVE remains OFF. No remote account used.

- **D-5c credit notes PR #46 merged (exact-head green bcd22f8; merge 4aecc99):** native TEST credit note list/get/preview, guarded create and void, exact preview allocation and invoice/customer verification, authenticated single-use owner approval for EVERY credit note issuance (including customer-balance credits and unpaid-invoice reductions), account-shared $500/Denver-day limit and independent over-limit override. The tool refuses unverified refunds and voiding refunded notes. Next **Batch V: V-1 developer TEST seeding and tracked runs** after #46 green and merged. IN-06 LIVE stays OFF.

- **D-5b invoice lifecycle PR #45 merged (exact-head green 979ca48; merge db4b7b2):** seven TEST native lifecycle writes (delete draft, finalize, send test event, charge open invoice, mark paid outside Stripe, void, mark uncollectible). Each uses verified Stripe state/balances, guarded preview/confirm, stable idempotency, app ownership restriction and independent read-back; incoming charges use a money-in spec and cannot spend the owner's outgoing allowance. TEST invoice.sent does not deliver real email. Next **D-5c** credit notes. LIVE remains OFF; no real account is deployed.

- **D-5a #43 merged (exact-head green c893d78; merge 90a49c0):** five native TEST invoice reads and five guarded manual draft workflows; all five have real-handler seven-case contract tests, pinned SDK stripe-mock, and conservative draft accounting gates. Next: **D-5b** invoice lifecycle, then **D-5c** credit notes. LIVE remains OFF.

- **D-4 merged in implementation PRs #40 and #42:** all 21 current-native TEST subscription, item and schedule tools. Seven D-4b guarded writes now have real-handler contract tests, pinned Stripe SDK mock coverage, current-phase preservation, app ownership enforcement and per-transaction owner consent for credit outcomes. **Next: D-5** invoices/credit notes after green #42 merge. LIVE remains OFF.

- **D-4b PR #42:** all seven guarded item/schedule writes validated, with exact-head CI, app ownership and owner-consent regression evidence, and a self-review. Next D-5 invoices and credit notes.


- **Owner decision (IN-12 answered):** old toolkits are *only* historical feature-completeness references. Build the full current native Stripe MCP, **without** legacy names, aliases, adapters, old-agent integration or retirement/relay work. X-3 and the legacy name-map deliverable are removed from Batch X, the plan and work index; decision is recorded in `docs/DECISIONS.md`. No reduction to current feature coverage.

- **Batch C / C-1 + C-2 (#36 merged):** compact Stripe-object summaries, safe dotted fields (including list items), stable refresh-safe private 24-hour result handles, 8 KB output cap, actual tokenizer-based listing/schema budgets, progressive tool search/describe/call, read-only batch execution, and compact/catalog profiles. Unit, isolated PostgreSQL, mock and full CI passed at prior head 35c4275; exact-head checks required for final docs/pagination commit. No Stripe provider writes or LIVE activation.

- **B-8c2 merged (#35):** carries B-8c1 (#34 merged), adds private two-stage owner consent for each exact TEST transaction and a separate password-authenticated owner over-limit override. New one-use decision intents bind Stripe-derived request identity. No LIVE money-moving tool is exposed; TEST refunds are guarded by the owner grant and account-wide limit. Unit, disposable PostgreSQL, mock and repository CI passed at reviewed head 27fd5de; owner-authenticated transaction consent is now code-complete, but provider money tools and LIVE remain OFF.
- **Last merged:** #39 D-3 hosted Checkout and portal, #38 D-2 TEST payments/refunds, #37 D-1 native TEST customer tools, #36 complete Batch C, #35 independent TEST owner consent, #34 provider-bound private money inbox (`d7df84f`), #33 owner money cap, #32 default
  account, #31 OFF-only LIVE disable, #30 revoke, #29 TEST permission
  re-probe, #28 scoped reads; B-1–B-7 completed.
- **D-1 merged (#37):** 17 current-native TEST customer tools, approved and tested, with no old-toolkit compatibility.
- **D-2 merged (#38):** 19 TEST-native payment/refund/setup tools; money approval and full CI verified.
- **D-3 merged (#39):** 16 native TEST hosted Checkout/payment-link/portal tools (7 safe reads, 9 guarded writes), server-approved redirects, no client secrets; nine-write contract suite, mock and full exact-head CI passed. Portal create verified through returned session and read-back of portal configuration. **Next D-4 subscriptions and schedules.**
- **IN-05:** $500 USD/account/Colorado day shared across AI connections,
  all money-out separately owner-approved, above limit a second override.
  **IN-06 remains OFF.** 27 guarded TEST-only customer/payment/hosted write tools exist in code, including exact-owner-approved refund operations. No LIVE credentials, real provider money movement, paid infrastructure or operational deployment.
- **Ordered batches:** A → B → C → D → V → G → H → P → W → U → R → E → X.

## Superseded historical branches

- `ai/gpt6/b-8c2a-owner-money-consent` at `6c5d868` is an unmerged duplicate of the older owner-consent implementation (no PR). It was compared to merged B-8c2 #35: **do not merge**; #35 implements a stronger per-request grant plus separate over-cap confirmation. GitHub branch deletion is still pending because the connected GitHub tools do not expose delete-ref. The branch is not a prerequisite for D-1.

## Environment

- Repo: `Robinson-AI-Systems/stripe-mcp`, default branch `main`. CI validates docs, secrets, tests with throwaway PostgreSQL and stripe-mock (PR #9). The first commit (this plan) went straight to `main`
  because the repository was empty; every later change goes through an `ai/*` branch and a PR.
- Vercel project, Neon database and Stripe test keys: not created yet (IN-02, IN-03, IN-04).

## Recent merges (newest first)

**2026-10-10 — CI cadence (docs + CI config PR, by Claude):** SESSION-START §6 rule "one complete CI run per fix batch"
(never push while the PR's run is in progress); CI now cancels an obsolete PR run when a newer push arrives. Next action
unchanged.

**2026-10-10 — #30 B-8b2a private connection revoke:** protected owner
preview and final consent, expiring one-time intent, atomic account/client
token revocation and audit. Does not expose a public AI write operation.



**2026-10-10 — B-8b1 TEST-only permission re-probe (PR #29, pending final merge):**
 server-owned lazy encrypted TEST-key use, safe Stripe read list probes, stored
 verified permission results; no credential disclosure or LIVE access.

**2026-10-10 — B-8a read-only account tools (#28):** scoped audit and
 connection summaries, daily shared budget status and Dashboard guidance;
 8 KB response ceiling and paged result tests verified.

**2026-10-10 — B-7 write declarations (#27):** CI checks explicit read/write
 classification, confirmations and provider-derived money-spec metadata.

**2026-10-10 — B-6 profiles (#26):** filtered discovery and direct-call
 authorization; read_only and all current exposed tools remain non-writable.

**2026-10-10 — B-5 result shaping (#25):** additive dollar/currency formatting,
 Denver-local timestamps, redaction and explicit LIVE labeling.

**2026-10-10 — B-4 readable errors (#24):** safe Stripe SDK error explanations.

**2026-10-10 — B-3 app record guard (#23):** metadata ownership, missing parent
 records fail closed, refund exception does not bypass monetary owner approval.

**2026-10-10 — B-2b/B-2a LIVE guard (#22/#21):** default-deny LIVE boundary,
 expiring owner intent, protected setup form, atomic audit; live mode remains OFF.


**2026-10-10 — B-1b2 owner-approved policy and guarded write foundation (PR #20):** internal seven-case write contract and Stripe-derived USD preview; account-wide, cross-connection $500 cap; owner-approved one-use request required for every money-out; separate auditable over-limit owner action; atomic PostgreSQL reservation; rejected-versus-uncertain outcomes. Exact-head CI verified; no money-moving tool exposed. Owner browser approval B-8 and live enable IN-06 remain off.

**2026-10-10 — B-1b1 money reservation ledger (PR #19):** one additive table and database-serialized account lock for per-connection money-out reservation in America/Denver days. Conservative uncertain/confirmed statuses count against usage; no money operations exposed. B-1b2 follows.

**2026-10-10 — B-1a guarded write engine (PR #18):** internal-only, TEST-mode preview/confirm/idempotency/read-back audit, denial for missing audit or unsafe connection. No money write allowed. B-1b still needs concurrency-safe money rule and IN-05.

**2026-10-10 — A-6 deployment guide (PR #17):** docs/DEPLOY.md explains private Vercel/Neon setup, personal credential handling, restricted key templates, test-only setup page, OAuth connection and verification. No environment or Stripe account modified.

**2026-10-10 — A-5b owner setup (PR #16):** protected key-entry page, 15-minute login lockout, CSRF and origin checks, Stripe permission probes, single-view secret page and first two guarded read-only MCP account tools. No real key has been entered or live mode enabled.

**2026-10-10 — A-5a encrypted credential primitives (PR #15):** AES-256-GCM encryption with no plaintext fallback, verified test-key persistence and atomically single-use secret records, with fake and real isolated Postgres tests. The authenticated setup page is still A-5b; nothing deployed.

**2026-10-10 — A-4b OpenAPI source (PR #14):** byte-exact Stripe v2556 SDK OpenAPI, pinned and verified against published Git blob SHA-1, bounded operation lookup and unit tests; stored as 23 immutable parts due provider API upload size. Next A-5.

**2026-10-10 — A-4a Stripe client (PR #13):** official SDK at API 2026-09-30.endive, stable scoped idempotency, bounded paging and preview live-key refusal. A-4b still owns vendored operation description.

**2026-10-10 — A-3b OAuth connector (PR #12):** personal persistent refresh, authorization page, MCP endpoint and metadata; full login behavior tested in unit and PostgreSQL. No live Stripe credentials configured.

**2026-10-10 — A-3b connector (PR #12):** auth page, OAuth registration/code/refresh, metadata, MCP bearer guard, personal persistent refresh authorization. No live keys, no money movement. Next A-4.

**2026-10-10 — A-3a primitives (PR #11):** core token-hashing, PKCE, IP/login lockout and hashed OAuth database methods, real-PG rotation tests. The connector endpoints are deliberately A-3b; do not claim A-3 complete.

**2026-10-10 — A-2 database schema (PR #10):** seven foundation tables and six indexes defined additively in code, tested only on throwaway PostgreSQL; no Neon database created and no Stripe records touched. Next A-3.

**2026-10-10 — A-1 foundation (PR #9):** Node ESM registry, test-only Stripe fake, disposable Postgres adapter, secret scan, docs and budget checks, four CI gates and single `ci` merger. No Stripe requests against real accounts.

**2026-10-10 — Review fixes (docs PR #8):** two gaps found by an automated review of the Workspace server's plan,
applied here: a login refresh keeps account, mode, profile and listing (A-3); the per-pass rate limit is stored per pass
and counted in a shared Postgres table with an atomic update, tested with overlapping requests across two instances
(R-2). Next action unchanged: A-1.

**2026-10-10 — For account owners too (docs PR):** G-6 owner and administration; every dashboard setting covered as a
real tool or a guided setting; audience tags.

**2026-10-10 — General development tool (docs PR):** Batch V developer tools added; test clocks moved from E; project
profiles made optional and general; Appliance Desk framed as an example and completeness check.

**2026-10-10 — Hub architecture (docs PR):** Batch R now provides only the Robinson Tool Contract doors (passes, HTTPS
API, manifest, conformance); CLI, relay and recipes moved to Robinson's Toolkit. Contract-generic code goes in `src/core/`.

**2026-10-10 — Owner answers recorded (docs PR):** IN-00 approved, IN-01 public / no automated review; designs
marked APPROVED; A-1 READY; review rule changed to self-review in AGENTS and PLAYBOOK.

**2026-10-10 — Plan written (initial commit):** AGENTS, START-HERE, SESSION-START, PLAYBOOK, drift protocol, PLAN,
MASTER-ROADMAP, 12 batch designs, TOOL-CATALOG (283 hand-built tools + 4 universal), Appliance Desk project profile,
owner inputs, go-live checklist, decisions, roadmap, work index with validator, first card A-1. The earlier plan version
is archived in `docs/archive/plan-v1/`.

## Blocked

IN-02 infrastructure and owner entry of IN-03/IN-04 are complete to the verified limits stated above. External owner-authorized custom MCP TEST provider smoke (G-4/G-5), signed-in owner Stripe Dashboard reconciliation (G-6), and remote OAuth/connectivity acceptance remain outstanding. No authenticated provider acceptance may be inferred from an encrypted database key or mocked CI. H-1 depends on genuine G-6 acceptance. Live activation IN-06 is NOT approved, and IN-05 money policy never grants AI-initiated money-out approval. Other owner inputs remain scheduled.
