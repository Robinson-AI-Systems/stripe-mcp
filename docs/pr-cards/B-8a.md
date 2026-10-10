# B-8a — Safe owner/server status and dashboard navigation

Status: **MERGED (#28)**; branch `ai/gpt6/b-8a-readonly-owner-tools`.
Design: `docs/designs/BATCH-B.md` §4 B-8, staged slice of Batch B.
Baseline: PR #27 B-7 guard; after merge sync with current main.
Risk: account data isolation. Schema: no new tables.

## Drift check A
| Expected | Current code | Resolution |
| --- | --- | --- |
| Server recent changes | Only `recordChange` exists | Add bounded account/mode-scoped safe history projection |
| Connection listing | OAuth token storage exists; secrets hashed | Select safe metadata columns only, filtered by account |
| Daily money usage | `getMoneyUsage` sums across all connections | Wire actual usage into `stripe_whoami` |
| Dashboard guidance | No data map | Add guided steps for common settings, truthful `changeMade:false` |
| Key re-probe | Key probing exists but server handler lacks secure key-store dependency injection | Defer real `stripe_check_key_permissions` to B-8b; do not claim cached state is a fresh probe |

## Work
- Register read-only `stripe_recent_changes`, `stripe_list_connections` and `stripe_where_is_setting` for all profiles; no new write handler is registered.
- Enforce authenticated selected Stripe account on audit and token metadata. TEST reader defaults to TEST changes; only full profile can request other-mode audit.
- Refuse invalid bounds, return no raw audit before/after, inverse metadata or bearer hashes.
- Report actual daily usage for selected account. No money operations executed.
- Add fake-provider unit and isolated PostgreSQL tests for cross-account privacy and true amounts. Update homepage profile count tests and catalog.
- Keep IN-05 $500 per-account budget and independent owner approval for EVERY AI money-out, above-limit second owner override, and IN-06 LIVE OFF.
- Finish remaining B-8 actions in separately reviewed B-8b/B-8c slices, with real owner-only approval page and documented activation checks.

## Verification
`npx vitest run tests/unit/server-owner-reads.test.js tests/unit/profiles.test.js`, `npm run check` and full exact-head CI.

## Next
Sync with #27 merged main; merge this safe read slice when green and reviewed; proceed B-8b with guarded administrative writes, then B-8c independent authenticated owner money approvals. Do not declare full B-8 complete from this slice.
