# R-4u — owner browser TEST OAuth S256 PKCE to original standalone MCP (#195)

Status: IN REVIEW — exact-head seven CI/review gates required.
Baseline: 7fb18342222b154e1b782e91a2b679a49c9b029f. #194 hosted source OAuth refresh merged.
Design: A-3 public PKCE / original OAuth and existing RTC direct TEST acceptance.
Risk: opt-in owner-interactive standalone OAuth identity proof; no migration,
Stripe payment, key/plaintext provider access, LIVE, relay or shared-core adoption.

## Drift A
| Prior assumption | Actual | Action |
| --- | --- | --- |
| CI #181 local SDK PKCE proves hosted OAuth | Disposable local PostgreSQL, synthetic owner | Owner browser and live-origin acceptance script |
| #193+#194 external bearer/refresh runners prove interactive authorization | Both start from existing protected token | New owner-initiated DCR, localhost code+S256, source exchange and SDK |
| Owner passphrase can be embedded in CLI | Owner password belongs on service's protected origin only | Never handle password in CLI; do not auto-submit owner form |
| Success auto revokes temporary client | No unauthenticated OAuth revocation endpoint | Explicit owner private setup revocation after any DCR attempt |

## Contract
- Exact owner-approved https origin and observed `live` commit attested before registration; no bypass of Vercel SSO.
- Owner-run only: `node scripts/hosted-oauth-pkce.mjs --owner-approved-test-pkce`, on SAME computer as signed-in browser, protected RTC_* env. Local ephemeral URL is displayed in terminal only; never submit it to chat, logs or issues.
- Registers only public `none` client with exact local loopback redirect. Binds random state, S256 verifier, single valid callback on 127.0.0.1, caps lifetime, denies bad callback and duplicate code.
- Owner manually chooses expected TEST account/read_only on original `/api/oauth/authorize` UI and enters passphrase THERE, not in tool/script.
- Uses one-time source token code exchange with resource binding and verifies bearer with official MCP SDK (PR #193). No bearer/refresh or private provider payload returned or saved.
- Must revoke temporary TEST client/connection from private setup even after failure; no live mode/spending.
- Unit fakes plus actual localhost HTTP callback tests; CI does NOT certify real owner browser/OAuth/Stripe read.
- FINITE external acceptance source checks distinct from deployed and genuine owner run. Next: actual owner-run scheduled `live`, signed webhook and Hub direct/relay/Sandbox, G-6 Dashboard; independent evidence.

## CI first-head defect and protected ingress remediation

- First #195 exact-head `unit` failed because a successful DCR with invalid metadata was not flagged as requiring owner cleanup; now mark registered immediately after HTTP 201, before validating returned fields. The test correctly requires cleanup. `check` also found an unused test import, removed.
- Owner can OPTIONALLY provide short-lived `VERCEL_OIDC_TOKEN` from their protected Vercel CLI session for Trusted Sources. The bounded shared HTTP helper enforces exact pinned HTTPS origin, rejects cross-origin/redirects/downgrades and never logs the token. This does NOT modify Vercel deployment protection, add a bypass or authorize development→production Trusted Sources; that owner setting is a separate gate. All four owner-run TEST acceptance scripts share the helper. If SSO remains inaccessible, external acceptance stays blocked.
