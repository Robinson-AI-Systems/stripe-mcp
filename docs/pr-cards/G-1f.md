# G-1f — Verified TEST report file metadata and safe export handoff
Status: as-if-merged (#88); exact-head CI/self-review pending.
Baseline: 2c41a0d (#87). Batch G-1 approved; no migration.

## Drift checklist A
| Prior assumption | Verified Stripe API | Correct behavior |
| --- | --- | --- |
| Completed report provides downloadable URL to MCP | Stripe report run.result is a File; files.retrieve exposes a provider-authenticated contents URL | Never share raw contents URL, generate a public link, or pretend we downloaded CSV |
| A report result file can be read from arbitrary fileId | Unrelated Stripe files contain sensitive data | Accept only report run ID, first verify succeeded TEST run and exact result association |
| Every Stripe file can be treated as a finance report | Files include identity, account and dispute evidence | Require exact finance_report_run purpose and provider ID |
| Test provider end-to-end verified | No Stripe account connected (IN-02/03/04) | Unit and stripe-mock are simulated, no real provider download claim |

## Build
- One read_only canonical tool report_get_result_file in src/tools/report-result-file.js.
- Verify Stripe report run is TEST, succeeded and has exact file ID before
  retrieving Stripe File metadata on the same selected account. Return size,
  filename, type and timestamps only; never links, authentication URL or content.
- Pending/failed runs report unavailable without fetching a file. Cross-purpose,
  mismatched ID, malformed or LIVE inputs fail closed.
- Real handler tests, read-only dispatch test and pinned stripe-mock shapes;
  registry, discovery/counts, catalog, STATUS and G-1 queue reconciled.
- All 5 checks at the exact head before merge.

## Remaining distinction
This is **not** an in-MCP CSV download: provider file contents require Stripe
authentication. Secure owner-only file delivery is a separate G-1g/owner UI
requirement; without an authenticated proxy and one-use retrieval, never put a
report contents link in chat. G-1 stays IN_PROGRESS until that requirement is met.
Next: G-1g owner-only authenticated report download (or approved guided
fallback), then G-1 completion and G-2 dispute/evidence tools.
Sources: https://docs.stripe.com/api/reporting/report_run
https://docs.stripe.com/api/files/retrieve
