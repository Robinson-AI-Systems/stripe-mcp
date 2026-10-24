# CAP-1 continuation — reviewed Stripe credentials and context evidence

Status: **IN PROGRESS within the one original CAP-1 subsection**. This is not a new roadmap unit or counted completed bundle. Main source at planning time `287828640659d738801141b44fea5668c627d11f`.

## Drift check
Current `src/stripe/capability-inventory.js` defines five provider credential-kind placeholders, all unknown. `src/stripe/unified-capability.js` projects GA v1/v2 method-path rows but does not convey the crucial Stripe-Context vs Stripe-Account distinction. Existing `src/keys.js` supports only owner-enrolled TEST/LIVE `sk_`/`rk_` keys; the `src/stripe/provider.js` runtime must not use any optional new credential until CAP-3 isolated tenant-owned grants, identity and live financial controls are independently implemented. No new identity provider or Stripe App exists yet. Reuse existing pinned v1/v2 data and reports; do not redefine the source snapshot or mutate production Stripe keys.

## Reviewed official source (as of 2026-10-23)
- Stripe API keys and organization-key required headers: https://docs.stripe.com/keys
- Stripe account/connected API authorization: https://docs.stripe.com/api/authentication
- Stripe Apps default platform, OAuth and restricted-key variants: https://docs.stripe.com/stripe-apps/api-authentication
- Connect OAuth's distinct purpose, user grant and platform context: https://docs.stripe.com/connect/oauth-reference
- API v2: https://docs.stripe.com/api-v2-overview

Documentation of a credential **type** is never a proven permission/role for an operation or a verified principal.

## Acceptance (original criteria, no narrowing)
<!-- bundle-plan:start -->
```json
{
  "baseRevision": "287828640659d738801141b44fea5668c627d11f",
  "workKind": "ENGINEERING",
  "outcome": "Establish evidence-linked Stripe credential-kind and exact account/Connect/organization context requirements for every official operation while refusing to infer user/provider authorization.",
  "integrationBoundary": "Offline CAP-1 inventory/report and pure data validation only; no credential decryption, Stripe calls, OAuth changes, provider writes, live deployment, new tenant or change to money policy.",
  "newEngineering": "Implement shared provider-documented credential contract and fail-closed context classification; attach per-operation required context and confidence/source to pinned v1/v2 reconciled reports; add explicit negative/positive tests and deterministic CI validation.",
  "estimatedProductionLines": 450,
  "relatedWorkDecision": "Full CAP-1 remains a single original subsection with additional operation-specific provider permission and independent real-account acceptance outstanding. CAP-2/3/4/5 remain uncounted. This stage is a substantial source-evidence increment without inventing an implementation unit.",
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
        "Collect provider-reviewed credential type and context requirements without granting operation-specific scopes absent evidence.",
        "Emit per-operation credential assessment with explicit unknown and account/connected/org requirements, human identity independence, preview and published API differences.",
        "Protect output from unproven grants, fabricated supported dispositions and cross-account/tenant context mixing.",
        "Preserve tests/CI and honest remaining scope for API per-permission mapping, user roles, code execution and real live provider evidence."
      ]
    }
  ]
}
```
<!-- bundle-plan:end -->

## Security boundaries
This implementation remains read-only offline cataloging. It neither issues nor selects a provider credential, and never executes or recommends an unverified privileged request. No account switching under a global secret, no silent escalation from the normal Stripe App OAuth grant, no LIVE enablement, and no change to independent owner money-out approval or the shared $500/account/day limit. Browser-mediated Stripe App installation and the multi-user database remain CAP-3 source engineering, not proven by this stage.

## Delivery checkpoint (CI not yet verified)

The existing original CAP-1 unit remains **IN_PROGRESS**. New
`src/stripe/credential-context.js` exports documentation-linked
per-operation credential requirements (all permission dispositions remain
unknown) and a non-executable preflight with explicit
`context-candidate-only` or `denied-context`, always `canExecute:false`.
`src/stripe/capability-inventory.js` and
`src/stripe/unified-capability.js` now show these facts per method/path.
Synthetic Vitest covers wrong tenant, person, role revision, mode,
account, host, expiry, raw credential metadata, Connect relationship and
organization Stripe-Context. No grant or provider execution occurred.
Full operation-specific scopes, entitlement and independent provider
acceptance remain original CAP-1 obligations.

## Corrections included in this same work packet

The official Connect OAuth reference describes legacy OAuth access tokens
as deprecated; this inventory records the modern platform-key
`Stripe-Account` delegation requirement. Source coverage additionally
requires actual runtime function registration, not tool-name coincidence.
Full source/provider proof and independent remote-client acceptance still
remain outstanding and no provider credential is selected.

## CI correction checkpoint

At intermediate head `63a48e7e`, check and two focused unit
assertions failed solely due to unbound `handlers` in
`validateCapabilityInventory`; 1,794 other unit tests passed.
Validator now declares the same default registry handler parameter as
builder and passes it into drift regeneration. Full exact-head CI
required before any merge; do not misreport the intermediate run.
