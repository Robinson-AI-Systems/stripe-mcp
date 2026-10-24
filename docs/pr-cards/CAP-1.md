# CAP-1 — Operation and credential coverage inventory

Status: IN PROGRESS — source enumeration and truth-in-reporting; independent provider acceptance remains separate.
Authority: [MAXIMUM-AUTHORITY](../designs/MAXIMUM-AUTHORITY.md) CAP-1. Baseline main `cc5be1c3d41ed1dbca68b4ed05d435ec70b26c71`.
This is **one original predefined subsection**, not multiple invented mini-cards. CAP-2/3/4/5 remain dependency-gated. This card's plan precedes any code changes.

## Drift check — inspected source and reuse
- Existing `scripts/stripe-openapi.mjs` verifies the pinned 2026-09-30.endive OpenAPI's byte checksums; `src/stripe/openapi-index.js` constructs unique canonical operations.
- `src/tools/index.js` is the actual native registry; `src/tools/universal.js` supports a guarded **subset**, not blanket universal coverage.
- `docs/pr-cards/X-2.md` inventories protected TEST reads, **not** all Stripe operations or live provider passes.
- The pinned SDK OpenAPI is not a complete account/organization/API-v2 inventory. Unknown operations and credential availability must be shown rather than presumed available.
- Never present a named native tool as proof that every method/path is implemented. No money-out, LIVE, owner-grant or production operation is authorized by this inventory.

## Proposed implementation and tests
- Add a deterministic offline CLI/JSON reporting layer over the existing checksum-verified pinned schema. One row per canonical method/path/version; handle duplicate IDs and drift; include method, path, family, summaries, credential kinds/known unknowns, effects, source paths, test evidence and separate source/live evidence status.
- Reconcile native tool names with guarded universal dispatch conservatively: schema-discoverable is not the same as verified callable, and no unconditional mapping from a native tool name to an API operation.
- Produce reproducible family gaps and machine-readable aggregate statuses, retaining explicit out-of-schema API v2/org and credential verification gaps.
- Add synthetic fixture regressions for duplicate/orphan/incomplete rows, drift detection, honest unknown statuses and stable ordering. Run mandated check, unit, Postgres/mock/RTC via exact-head CI if local GitHub checkout is unavailable.
- Update living docs/roadmap/owner guide/README to link the generated inventory and accurately distinguish original engineering complete from CAP engineering pending and independent TEST/production acceptance.

## Frozen bundle scope

<!-- bundle-plan:start -->
```json
{
  "baseRevision": "cc5be1c3d41ed1dbca68b4ed05d435ec70b26c71",
  "workKind": "ENGINEERING",
  "outcome": "Provide reproducible, conservative operation-by-operation coverage evidence and correct living documentation against current Stripe MCP code.",
  "integrationBoundary": "Offline pinned Stripe schema plus native tool registry and CI drift checks; no deployed auth change, live account, or provider money effect.",
  "newEngineering": "Build deterministic provider-operation inventory, credibility classifications, credential uncertainty, drift validator, gap report and independent regression tests.",
  "estimatedProductionLines": 450,
  "relatedWorkDecision": "CAP-1 is the sole eligible new indexed subsection; CAP-2 through CAP-5 depend on this inventory and remain uncounted. Docs fixes share the same code and CI change.",
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
        "Implement versioned canonical operation inventory generation using checksum-verified schema and registry.",
        "Implement strict offline validation and reproducible per-family capability-gap reporting with explicit unknown credentials.",
        "Add focused regressions for unique coverage, drift, conservative classification and output stability.",
        "Reconcile current documents, owner guide, roadmap and execution evidence with actual merged source and independently verified deployment."
      ]
    }
  ]
}
```
<!-- bundle-plan:end -->

## Delivery and independent acceptance
Planning commit SHA: to be filled by exact GitHub readback, without modifying the frozen JSON.
Do not close this subsection or claim a substantial bundle until its entire acceptance above is verified. The code and CI may be complete even when real provider/live coverage remains unverified; keep that evidence separate. Follow the existing independent release route and actual reviewer rules.

## Implementation checkpoint — 2026-10-23

Plan was committed first at `b79b4c47961f1d22ea79df8f9dd534a2b97c4494`. The same full CAP-1 frozen criteria
remain in force. This PR adds offline source truth checks and the approved
next-CAP connection architecture; **no** credential permissions, deployed
provider execution, Stripe App registration, tenant migrations, LIVE activation,
financial operations or acceptance passes are presumed. Next engineering:
finish first-class reviewed credential requirement evidence for provider API
v1/v2/organization operations, confirm all mapping claims and validate
normal CI, regression and reviewer results before marking CAP-1 fully complete.
