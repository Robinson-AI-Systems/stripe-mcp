# G-1g — Owner-authenticated TEST report CSV delivery and G-1 closeout
Status: as-if-merged (#89); exact-head CI/self-review pending.
Baseline inspected: 30c42a2 (#88). Batch G §4 G-1; no migration; one risk area: sensitive financial report downloads.

## Drift checklist A
| Prior assumption | Verified main/provider behavior | Correction/test |
| --- | --- | --- |
| MCP read tool can expose a report result link | G-1f deliberately projects no private provider URL | Preserve MCP omission; separate browser owner-only endpoint |
| Report file URL is a public download | Stripe finance report File URL is credential-protected at files.stripe.com | Strict canonical URL, server-side Bearer TEST key; never return URL or key to AI |
| File ID alone authenticates result | G-1f verifies exact succeeded TEST run, file ID and purpose | Independently revalidate on same owner's exact account for every download |
| Unbounded downloads are safe | Reports may be very large; serverless cannot blindly buffer them | Bound to 5 MiB, validate advertised and actual size, non-redirect, reject partials |
| Connected provider can be verified live | No real TEST account connected | Unit tests against mocks only; keep LIVE disabled, disclose no real download verification |

## Build and acceptance
- `src/stripe/report-download.js`: gated account TEST status and stored TEST key,
  verified provider report run and exact finance_report_run file metadata;
  fixed-host file-content GET with server-side credential only, redirect refusal,
  timeout, bounded incremental buffering, generic errors, fixed sanitized filename.
- `src/stripe/setup-page.js` and `api/stripe/setup.js`: same-origin CSRF and password/lockout
  before initiating download; binary CSV attachment with no-store, nosniff, and CSRF
  invalidation. No extra MCP tool, no public file link, no anonymous endpoint.
- Unit tests: `tests/unit/report-download.test.js`, `tests/unit/setup-page.test.js`
  test cross-account/mode/purpose/provider identity, size, browser auth, no leakage.
  Existing `tests/mock/report-result-file.test.js` validates the unchanged
  Stripe read shapes; no provider TEST connection exists for E2E proof.
- Docs: G-1 status/work index and owner guide, G-2 next.
- Run `npm run check`, `npm test`, `npm run test:mock -- tests/mock/report-result-file.test.js`,
  exact-head five CI gates and self-review prior to merge.

## Out of scope
No unrestricted Stripe Files download tool, no exposure of financial CSV into
AI chat, no LIVE activation or actual money movement. Large report files require
Stripe Dashboard owner download. G-2 next: dispute reads and evidence workflow,
new JIT card from approved Batch G and report-download security patterns.
Sources: https://docs.stripe.com/api/files/retrieve and
https://docs.stripe.com/api/reporting/report_run
