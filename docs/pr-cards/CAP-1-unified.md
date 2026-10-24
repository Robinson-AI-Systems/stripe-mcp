# CAP-1 continuation — unified Stripe API v1/v2 source evidence

Status: original CAP-1 remains IN_PROGRESS; this is an implementation packet within the SAME ID, not another countable subsection. Parent indexed card: [CAP-1](CAP-1.md).
Verified base main `517dc3f12996515d5fd7f4ac9f47b3660f1459c9`. Last CAP-1 PR #284 merged; new official evidence [Stripe's unified OpenAPI](https://github.com/stripe/openapi/blob/master/latest/README.md) explicitly says legacy `openapi/` is v1-only while `latest/` includes v1 and v2. Source pin for this packet: upstream commit `af2d19d63ea42049abecf784482898c654ab42d5`, public spec `latest/openapi.spec3.json` Git blob `9da296dc459321ad8cd04c68c41d32af8ca436dd` (GitHub source metadata; actual byte verification must occur in code/runner). Maintain Stripe's pinned SDK version and original production contracts; never silently substitute latest public docs as an executable SDK schema.

## Drift check and reusable seams
- Original vendored v1 SDK source: `scripts/stripe-openapi.mjs`, `src/stripe/openapi-index.js`.
- Current source-aware operation inventory/registry: `src/stripe/capability-inventory.js`.
- Existing money safety and account authorization: `src/stripe/money-operations.js`, `src/core/profiles.js`. Do not change them.
- Public official unified source may differ from SDK-only/deprecated v1 routes. Surface differences, never overwrite their operation IDs or claim provider acceptance.
- Scripts require HTTPS and exact commit/blobs only; bounded network/response size and no credentials. API keys and Stripe clients never reach the source loader.

## Offline, no-provider acceptance
- One operation row for every pinned official method/path in both v1 and v2; preserve provenance, Stripe API version and official name if present.
- Reject wrong blob, wrong version, malformed JSON, duplicate method-path, unbounded source and unexpected authority fields before reporting.
- Show registration source mapping as a candidate only, all credential kinds and product roles as UNKNOWN until official reviewed operation evidence; source vs deployed provider always separate.
- Report family counts, newly documented/v1 missing methods, official-v2 inventory, operations still unmapped to tested native handlers, and never invent a percentage.
- Vitest synthetic tests and mandatory repo CI. Networked audit execution remains a separate explicit pass/fail and does not touch Stripe accounts.

<!-- bundle-plan:start -->
```json
{
  "baseRevision": "517dc3f12996515d5fd7f4ac9f47b3660f1459c9",
  "workKind": "ENGINEERING",
  "outcome": "Extend the original unfinished CAP-1 capability inventory using an immutable official unified Stripe OpenAPI snapshot containing both v1 and v2, without granting provider authority.",
  "integrationBoundary": "External provider schema is downloaded only on explicitly invoked offline audit CLI and SHA1 blob-verified before parsing; current MCP provider credential and money code remain unchanged.",
  "newEngineering": "Add an immutable official Stripe unified API source loader with bounded HTTPS access and no secrets; validate source blob and enumerate v1/v2, reconcile pinned-v1/source-native mappings, and produce human/actionable family gaps with synthetic rejection tests.",
  "estimatedProductionLines": 420,
  "relatedWorkDecision": "This is continuation engineering within the EXISTING CAP-1 subsection and does not count as a newly created unit, completion, or PR credit. CAP-2/3/4/5 remain dependency gated; no Stripe account needs testing.",
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
        "Enumerate reviewed official unified v1/v2 method-path operations from a commit/blob pinned upstream contract without remote execution rights.",
        "Reconcile old vendored SDK v1 operation names, native registered tool mappings and new unified v2 methods while preserving version boundaries.",
        "Provide robust bounded download, checksum/shape failure handling, reproducible deterministic family gap and credential unknown reporting.",
        "Add positive and negative synthetic source/hash/version/duplicate/denial tests, source documentation and CI proof. Unreviewed authorization matrices and real-account acceptance remain open."
      ]
    }
  ]
}
```
<!-- bundle-plan:end -->

## Successor
After this stage, finish CAP-1 credible operation-specific account/org/Stripe App authorization evidence, then advance original CAP-2 and CAP-3 on their dependency path. Do not call the original CAP-1 unit complete merely because source enumeration succeeds.

## Owner 2026-10-23 branding/hostname checkpoint

[Corporate branding and custom-domain contract](../designs/STRIPE-BRAND-DOMAIN.md)
is approved adjacent CAP-3 connection work, not a completed or additional CAP-1
subsection. Its Vercel domain is NOT attached and source `PUBLIC_BASE_URL`
must remain unchanged until independent deployment and OAuth origin tests.
