# CAP-2 — standard fullest authorization and source-policy recovery

Status: IN PROGRESS, **original existing CAP-2 only**. Main baseline `9b737f62d4bb28ce2af0a7d2b0db3e37531d94f7`, parent [maximum authority plan](../designs/MAXIMUM-AUTHORITY.md).

## Drift check and reuse
- `src/core/profiles.js` is the enforced policy on direct and indirect tool calls; do not invent a parallel runtime policy.
- `src/tools/meta.js` and `src/core/mcp-server.js` execute the same guarded source metadata. New diagnostics must use those existing checks.
- `src/core/mcp-auth.js` and `src/db.js` provide server-derived profile/mode/account and owner activation; never trust arguments that request broader access.
- `src/tools/server.js` has a verified `stripe_whoami` and existing tools. New read-only explanation will use the same registry/connection and minimal safe projections.
- Corporate identity, Stripe App installation, independent OIDC tenant and optional God Mode keys remain CAP-3; no Stripe App or public sign-in is currently provisioned.
- No developer-only TEST/$0 restrictions may become permanent product limits, but LIVE and independent money-out constraints are still mandatory.
- Key provider permission/entitlement remains UNKNOWN even if source tool is visible. Never infer from `sk_` prefix.

## Complete original acceptance (frozen)
<!-- bundle-plan:start -->
```json
{
  "baseRevision": "9b737f62d4bb28ce2af0a7d2b0db3e37531d94f7",
  "workKind": "ENGINEERING",
  "outcome": "Expose an accurate direct-MCP effective-access explanation and profile-comparison feature grounded in registered tools and current verified connection, without silently escalating provider rights.",
  "integrationBoundary": "Existing registered MCP tool dispatch and native meta-tools; read-only source policy diagnostics only, no provider credential read/decryption, OAuth registration updates, LIVE/money changes or production mutation.",
  "newEngineering": "Implement strictly bounded effective-access and same-session Full/read-only/Everyday comparison, explicit recovery guide, source/provider-policy distinction, a registered read-only MCP tool, source and through-dispatch test coverage.",
  "estimatedProductionLines": 440,
  "relatedWorkDecision": "This is substantial new original CAP-2 engineering within the already approved single CAP-2 subsection, not CAP-2 completed: customer multi-user identity, real owner grant migration and provider/client authorization acceptance are still required. CAP-3 Stripe App/OIDC and God Mode remain separate.",
  "subsections": [
    {
      "id": "CAP-2",
      "acceptance": [
        "Full ordinary authorization must expose every provider-supported action permitted by the verified connected account and the end user's chosen policy; optional God Mode must not gate ordinary rights.",
        "Explain account credential, role/entitlement, selected profile, actual TEST/LIVE owner activation, user policy and missing implementation as distinct effective-access layers with accurate repair steps.",
        "Read-only never writes; Full/Everyday changes require the existing guarded write contract through direct MCP, indirect stripe_call and HTTPS doors without profile or key fallback bypass.",
        "All profile/consent changes are explicit user-controlled actions: preserve current account, mode, client/session, unrelated grants, refresh/revocation and no silent widening or privileged token fallback.",
        "Preserve independent owner-approved money-out and account-wide $500/Denver-day, LIVE activation, tenant and provider boundaries; positive/negative synthetic and real database authorization tests, with separate deployed acceptance."
      ],
      "remainingEngineering": [
        "Build safe true-to-runtime per-tool source visibility and operation eligibility diagnostics using selected server-verified OAuth connection and real registered handler metadata.",
        "Expose read-only MCP inspection tool with missing account/profile/independently activated LIVE/money/grant distinctions, unverified provider permission labels and no automatic privilege changes.",
        "Test profile differences, ordinary Full recovery, cross-account no selection, revoked/foreign grant diagnostic refusal, direct and indirect guarded dispatch and bounded result properties.",
        "Reconcile profile/store transition and real independent provider grants after CAP-3 multi-user/OIDC migration; preserve unchanged original owner-approval and money-out guard."
      ]
    }
  ]
}
```
<!-- bundle-plan:end -->

## Implementation
Use a trust-preserving pure `src/core/effective-access.js` based on the **existing** profile and guard predicates. Add a read-only registered native `stripe_explain_access` tool on the verified current connection, plus optional same-connection profile comparisons that DO NOT apply changes. No account, tenant, mode, provider credential or LIVE activation selected from arguments. Return concise independently actionable recovery guidance (reconnect/choose Full, owner-only LIVE, legitimate Stripe Dashboard permission grant, missing-code follow-up), never keys, URLs with embedded states or promises of real provider success.

## Finish boundary
Complete CAP-2 only when full original criteria have real source/database/indirect-door proof and ordinary authorized provider acceptance, including safe user-selected profile persistence and non-disruptive upgrade; neither green source CI nor this isolated feature can be credited as full CAP-2. Document actual remaining engineering separately.
