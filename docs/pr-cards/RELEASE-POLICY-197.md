# RELEASE-POLICY-197 — close #196 daily schedule review bypass

**Outcome:** Prevent a timezone-first second daily promotion trigger from passing the release-policy checker while allowing a valid single Denver schedule. Resolve the actionable merged #196 review with evidence.

**Implementation:** Inspect the entire canonical schedule entry instead of only `- cron` lines; reject duplicates, inline or extra items. Add unit tests for a timezone-first injected cron, reordered valid item, duplicate keys and inline-map schedule form. Preserve sole scheduled entry, pinned actions, branch guards and checked promotion. Amend existing AGENTS/SESSION-START to retain automatic five-number alignment and same-chat owner intervention.

**Safety:** No deployment action, credentials, provider calls, scope widening, money flow, LIVE, Hub edit or manual release. Review GitHub Actions CI and unresolved threads on exact head before merging. Independent genuine hosted acceptance remains pending.

**Resume/acceptance:** Draft PR; run seven exact-head checks (`check`, `unit`, `db`, `mock`, `rtc-reference`, `ci`, `target-main`), address reviews, self-review changed files, merge expected SHA, verify main, reply to/resolve the original #196 thread. If CI cannot run, leave the PR open with precise blocker rather than bypassing policy.
