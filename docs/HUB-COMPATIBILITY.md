# Robinson Toolkit Hub compatibility reference

**Owner decision, 2026-10-19:** This independent MCP server is a Hub-compatible provider, not a Hub client. The **Hub initiates** discovery, authorization and selected tool calls. The coding agent sees **one Hub MCP connection and a fixed, small set of gateway tools**, even as thousands of provider tools become searchable. The human and coding agent do their own planning. **Never create a server-to-Hub callback, brand-specific Hub adapter, unconditional eager `tools/list` expansion or provider-side automated planning.**

## Governing shared specification

- [Frozen RTC 1 contract](https://github.com/Robinson-AI-Systems/robinsons-toolkit-hub/blob/43eed4658527f32c9fca9666b0d31ecf8894b22d/docs/CONTRACT.md) is the cross-repository baseline.
- [Hub connection compatibility specification and per-server checklist](https://github.com/Robinson-AI-Systems/robinsons-toolkit-hub/blob/main/docs/HUB-CONNECTION-SPEC.md) explains optional standards-based OAuth, independently delegated identity, bounded RTC meta-tool search/describe/call, pagination and result/refusal rules.
- The immutable baseline above is pinned to Hub commit `43eed4658527f32c9fca9666b0d31ecf8894b22d`. Update the pin only by a separately reviewed protocol compatibility change. Work from the **latest reviewed Hub main implementation guidance**; record the exact Hub commit and the selected provider's exact source and deployed commits whenever demonstrating compatibility. Treat a future breaking contract change as a separate versioned design decision, **never** a silent per-server wire-protocol tweak.

## Required integration boundaries

1. **Stay standalone.** Existing direct MCP clients and original provider credentials must continue working without Hub, and an authorized user may exercise the provider's full legitimate capabilities. Development-team spending, TEST and no-production safeguards are not permanent end-user product policy.
2. **Advertise, don't push.** Serve truthful public RTC 1 `/api/contract` metadata, stable tool prefix, areas, modes, profiles and authorization availability. Do not connect outward to Hub.
3. **Lazy, bounded tool access.** Serve the standard RTC meta-tool search/describe/call family under the *provider's own* authorization and risk checks. A Hub query returns a **small bounded search page** and fetches an individual schema only on demand. Preserve actual page/offset/cursor fields and exact denial codes. No eager full catalog into the agent context.
4. **Provider-owned consent.** Support the provider's independent RTC credential verification and, where implemented, standard OAuth protected-resource/issuer discovery, S256 PKCE, resource-bound consent, token refresh and revocation. The Hub never creates or widens provider scopes. A protected whoami identity that does not attest complete mode/profile/area grants is only enough for the Hub's **read-only** fallback; source must not claim full/write authorization from a successful OAuth callback.
5. **Accurate results.** Keep outputs bounded, protect large pages and handles from cross-account/caller reuse, and reject expired, revoked or narrowed permissions. Unexpected provider POST results must not be retried without a safety guarantee.
6. **Proof separate from code.** Before marking this server Hub-compatible for production, check the actual deployed RTC manifest, a genuinely authorized read via Hub, denied access, revoked/expired grant, credential renewal if provided, provider audit and direct standalone access. Historical TEST fixtures are not current LIVE acceptance.

## Current adoption status

This is a **documentation/implementation reference**, not a deployment, a new token, a registry enrollment or a successful live connection. Existing source and hosted service remain unchanged. Inspect the actual source and real issuer before claiming any checklist row passed.

When implementing a future tool or modifying authorization, include this contract compatibility check in the existing repository roadmap/card and tests, rather than duplicating the Hub's provider-independent router here.

## 2026-10-19 — R-3 provider-side Hub compatibility correction, not a new subsection

Status: PLAN FROZEN, source and review pending. Owner removed external Hub discovery/connection as a Stripe completion gate; Hub still owns its route tests. Verified before code: original R-1/R-2/R-3 are already source MERGED, observed Stripe `stripe_search_tools` has only first-page `hasMore` with no continuation, current live=main and READY Vercel `f38dfac2deed9fac204a619afaf0facc58726908`, Hub reference main `3cc7f4ad4332155d639125b23e8a5c4c13804a3d`. No valid deployed-auth Stripe LIVE/new provider test claim; historical protected queue 43 total / 13 PASSED / 30 PENDING. This correction is not a new countable bundle.

<!-- bundle-plan:start -->
```json
{
  "workKind": "ENGINEERING",
  "baseRevision": "f38dfac2deed9fac204a619afaf0facc58726908",
  "outcome": "Conform standalone Stripe MCP lazy tool search to the reviewed Hub connection compatibility specification, without making successful Hub-side onboarding a Stripe completion prerequisite.",
  "integrationBoundary": "RTC1 standalone /api/contract and original MCP meta dispatch remain Stripe-owned; no outbound Hub calls, no bespoke adapter, no auth widening, no LIVE/provider writes. Preserve historical Hub route acceptance as explicit nonblocking Hub-owned observation.",
  "newEngineering": "Add deterministic bounded offset/nextOffset search pagination under original profile/area/write/deny guards; enforce and test first/next/last/invalid/foreign permissions and budget. Make historic Hub D-4 route acceptance optional in authoritative release planner while requiring real standalone provider conformance.",
  "estimatedProductionLines": 75,
  "relatedWorkDecision": "This is one targeted R-3 compatibility remediation and owner-approved acceptance-boundary correction, NOT a newly counted engineering subsection/bundle. R-1/R-2/R-3 original source is already MERGED; retain frozen original scope and exact original acceptance words. Small correction is required by the owner decision and the latest spec; do not pad code or add unapproved features.",
  "subsections": [
    {
      "id": "R-3",
      "acceptance": [
        "Hub's published RTC 1 conformance package executes locally against original Stripe MCP TEST fake-provider fixture and two isolated server instances with shared throwaway DB, required probes run and failures gate CI.",
        "Manifest and published prefix/route/tool counts are contract-conformant, original native write preview/readback and private pass results verify; no Hub connection is needed for standalone server.",
        "CI conformance outcome, actual skipped probes and external only acceptance are recorded honestly; no unverified Hub Sandbox or revoked owner pass is falsely marked accepted."
      ],
      "remainingEngineering": [
        "Give authenticated Stripe MCP meta-tool search a deterministic nextOffset continuation without exposing hidden tools or widening profile/area/mode authorization.",
        "Classify Hub-led direct/relay/Sandbox tests as retained historical PENDING but explicit nonblocking Hub-owned acceptance; preserve source/standalone requirements, add positive and adverse tests to planner and tool meta."
      ]
    }
  ]
}
```
<!-- bundle-plan:end -->

