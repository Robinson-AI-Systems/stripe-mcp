# G-6 — Independent owner administration custom MCP TEST smoke (#143)
Status: as-if-merged, exact-head CI/review required. Approved G-6 genuine external acceptance support, not Dashboard acceptance.

## Drift A
The existing owner-local and authenticated browser smoke cover eight G-4/G-5/basic-G-6 readers, but omit key G-6 native overview, masked security assessment and Dashboard guide list. Running an unbounded all-tools probe would waste time and risk slow serverless requests; instead separate a fixed three-tool administration group from unchanged eight-tool core. All are predeclared read-only MCP handlers.

## Implementation and acceptance
- Add opt-in `focus:administration` to private browser and CLI environment; default core remains backward-compatible. Only enumerated registered readOnlyHint handlers can run; TEST account identity preflight remains before reads and no write is introduced.
- Check exact selected account and safe shape for owner overview, security and guided settings. Overview may only state awaiting_owner with dashboardWalkthroughVerified:false and 14 ownerConfirmed:false rows. Security assessment is partial until signed-in review, and guide-only settings are unverified/not_readable.
- Owner browser accepts only exact focus-specific tool set, no extra/duplicate tools, verified TEST identity, dashboardVerified:false and zero writeOperations. Export only tool/status pairs, no keys, raw Stripe records, provider exceptions or private Dashboard snapshots.
- Unit tests cover both focuses, forged Dashboard success refusal, bad focus, redacted browser response and exact auth gate. Full check/unit/mock/db/ci and self-review required. G-6 external Dashboard acceptance, OAuth, webhook smoke still pending. LIVE disabled, H-1 blocked.
