# V-1b4f — TEST Connect-gated marketplace seller onboarding

Status: **MERGED (#56 as-if-merged; exact-head CI/review pending)**.
Parent V-1, approved Batch V §§1/4. Baseline main ce0fac78e45c678f6de5f4d4876cd21330eefed6 (#55).

## Drift check A

| Assumption | Current Stripe / repository | Decision and test |
| --- | --- | --- |
| Connect exists on every Stripe account | Selected account may not be a Connect platform | Verify the account ID and TEST mode via accounts.retrieve(); require native accounts.list to succeed before ANY provider mutation |
| Marketplace fixtures can transfer funds without owner approval | All AI money-out, including TEST transfers, requires independently authenticated per-operation owner consent | This slice only creates TEST seller onboarding account, one-time product/price and buyer; no charges, transfers, payouts or fees |
| Test seller is automatically transfer-ready | Express account transfer capability can be pending/inactive until onboarding completes | Record actual returned transfers capability; never claim onboarding, payouts or transfer eligibility |
| Additional object types are automatically tracked | Ledger accepts a known prefix list | Add connected_account/acct and record the exact Stripe ID, metadata rtc_run and immutable per-step idempotency |
| Existing scenarios can change | Older V-1 runs have immutable plan digests | Add separate marketplace-onboarding scenario without modifying earlier scenario plans |

## Scope and safety

- Add read-only TEST dev_connect_readiness: independent Stripe platform account and Connect API listing verification; disclose only access and capability status, not permissions or money readiness.
- Add explicit marketplace-onboarding TEST scenario and safe plain-language selector; dryRun previews exact four real objects per seller. Size 1–5. Connect readiness fail-closed before Stripe objects, no empty/best-effort fake success.
- Creates platform TEST product, one-time USD price, tagged buyer, Express TEST seller with requested transfers capability. All objects require actual provider independent read-back and exact rtc_run ownership; connected account may remain pending onboarding.
- Never create destination charges, payouts, money-out transfers or fees. For those, approved future guarded owner-consent work remains necessary and is not simulated.
- No LIVE access, external Stripe mutations in the session, secrets, databases, additional permission exposure or old toolkit compatibility. Existing independent owner-approved money-out and 500 USD/account Denver-day rules unchanged.
- Tests: real guarded seed fixture, exact ledger, no duplicate replay, denial before writes when Connect unavailable, metadata/foreign account/capability checks, LIVE/read_only refusal; official pinned SDK stripe-mock account create/list/retrieve, registry/profile counts and discovery.
- Final CI: all check/unit/mock/db/ci jobs green on exact PR SHA and required reviews resolved.

## V-1 and V-2 status

V-1 stays IN_PROGRESS: onboarding fixtures do not prove an onboarded marketplace can accept payments, transfer to a seller or settle funds; ACH settlement likewise must not be overstated. The approved V-2 cleanup (including connected accounts/test clock dependency) follows V-1 completion. The new seller account must be removed only via documented cleanup logic, not silently discarded.
