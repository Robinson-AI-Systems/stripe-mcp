# CAP-1 final inventory/evidence completion packet

**Original CAP-1 remains IN_PROGRESS until every acceptance line is met.**
Current base main `95eabecc00defadc93e94a2f9270e1641cdbfd85`. This is continuation within existing CAP-1,
not an additional roadmap unit, and it does not grant real provider authority.

## Drift check

Reuse exact source from PR #284 (pinned SDK `src/stripe/capability-inventory.js`),
PR #285 (644 official GA v1/v2 methods and normalized `src/stripe/unified-capability.js`)
and PR #286 (documented credential type + tenant/account/Connect/org context
`src/stripe/credential-context.js`). The current merged main and live are
different; production READY was last independently observed at
`cc5be1c3d41ed1dbca68b4ed05d435ec70b26c71`, not new HEAD.
Do not reimplement the OAuth server or redirect public clients yet.

Current gaps: operation-level financial effect, explicit owner unit, source
handler/test, human/tenant context, required scope/role/product entitlement and
separate provider acceptance dispositions are too coarse. Static native
name mappings are candidates only; actual registered functions are verified.
Org API keys need `Stripe-Context` plus `Stripe-Version`; Connect OAuth
tokens are deprecated; do not fabricate a super-token or supported
provider permission to "close" the inventory.

## Frozen original acceptance
<!-- bundle-plan:start -->
```json
{
  "baseRevision": "95eabecc00defadc93e94a2f9270e1641cdbfd85",
  "workKind": "ENGINEERING",
  "outcome": "Finalize a conservative, per-operation current Stripe GA v1/v2 authority, effects, source, credential, test and independent-live-evidence ledger so CAP-1 can be assessed against all original acceptance lines without inventing API parity.",
  "integrationBoundary": "Pinned official GA source, existing real tool registry and existing provider documentation only; produces read-only reports, no credentials, external writes, runtime auth, money or release changes.",
  "newEngineering": "Expand per-operation source/live evidence fields, conservative financial effect classification, exact credential context, permission/entitlement uncertainty, first-class version+family gap prioritization and mutation-proof schema/source validator and tests.",
  "estimatedProductionLines": 450,
  "relatedWorkDecision": "Single original CAP-1 unit continuation; full criteria must be met before index status can change. Actual remote provider execution remains separate acceptance, and CAP-2/3 cannot be credited as completed by an inventory.",
  "subsections": [
    {
      "id": "CAP-1",
      "acceptance": [
        "Reproducibly enumerate official pinned Stripe methods and paths with stable operation IDs, version and source identity, without duplicate or orphan rows.",
        "Expose every operation's supported, unsupported or unknown credential-kind disposition, required scope, product entitlement and effect with explicit uncertainties.",
        "Distinguish verified source handlers and guarded universal execution from discovery only, with per-operation test and independent live evidence recorded separately.",
        "Generate deterministic family and version coverage gaps including API v2 and organization gaps, without an invented source or live parity percentage.",
        "Fail validation on source/schema drift and malformed or missing inventory records; preserve every actual financial, LIVE, tenant and owner-approval guard."
      ],
      "remainingEngineering": [
        "Link each official GA method/path/version row to exact source handler evidence or missing implementation, credential kind and context, required provider scope/role/entitlement and financial effect with unknowns clearly marked.",
        "Track per-operation source test proof and independent deployed provider acceptance separately, including missing/unverified states; no invented provider passes.",
        "Generate deterministic family/version gaps with explicit actionable engineering owner/priority and no invented parity percentage.",
        "Reject source/operation/credential/effect/evidence drift; add both positive and negative regressions and update current documentation/index only when original CAP-1 criteria are independently met."
      ]
    }
  ]
}
```
<!-- bundle-plan:end -->

## Go/no-go for original CAP-1 completion

Only count CAP-1 if provider GA rows are complete, all permission/role/
entitlement unknowns explicitly sourced and marked, all unimplemented
methods and evidence gaps are shown by deterministic family/version reports,
and report validators reject fabricated source/real-provider proofs.
Source inventory acceptance does **not** turn independent Stripe TEST/live
client evidence into PASSED and does not claim functionality for any
missing API operation. Changes here are offline and read-only.

## Full original delivery candidate — separate implementation from acceptance

[CAP-1.delivery.json](CAP-1.delivery.json) records all five frozen
criteria. A deterministic 644-row GA source report now has explicit
published operation IDs, versions, credential kinds and documentation
sources, unknown required permission/role/product entitlement,
financial/read/unknown effect, real registered source handler candidate
or missing code, per-operation UNLINKED exact tests and separate
UNJOINED independent deployed provider evidence. Family and version
gaps are reproducible; validator rejects misstatements, duplication,
missing source and fabricated provider PASS. The report does not claim
functional/provider parity, return credentials or authorize an operation.
The original **CAP-1 source inventory** is presented for MERGED status
only if protected exact-head CI and self-review pass; all independent
provider/account/authorization acceptance remains pending. CAP-2/3/4/5
are the next actual product engineering.
