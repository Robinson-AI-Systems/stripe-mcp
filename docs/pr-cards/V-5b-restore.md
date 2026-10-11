# V-5b restoration — preserve merged simulation setup after V-5c1
Status: MERGED (#75, as-if-merged; CI/review pending).
Baseline: main e768bfa (#74); restore exact code from #73 merge c4dfc63.

## Drift check A
| Expected state | Main after #74 | Remediation |
| --- | --- | --- |
| V-5b simulation setup and tests are present | PR #74 replaced the Git tree using an outdated base and deleted four files | Restore exact source, test, and card files from #73 |
| Registry includes dev_simulate_subscription and 126 tools | #74 silently reverted index and count tests to #72 | Restore registry and exact count assertions |
| V-5c1 durable cycle ledger remains | #74 created src/dev/simulation-cycle-store.js and SQL tables | Preserve all #74 ledger and regression coverage untouched |

Required exact-head five checks: check/unit/mock/db/ci. Do not merge without all passing. Follow with V-5c2 guarded clock advance; no Stripe/LIVE action in this repair.
