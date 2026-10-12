# Daily Vercel Production branch — deployment release gate

Production source is the GitHub `live` branch; development and PRs continue on
`main`. The `.github/workflows/promote-live.yml` job runs once per UTC day
at 10:00 UTC (04:00 Colorado MDT / 03:00 MST; GitHub scheduling can be late).
It promotes only a clean fast-forward main snapshot whose **six** exact-commit
GitHub Actions checks succeeded: check, unit, db, mock, rtc-reference and ci.
One atomic Git push updates `live` and an immutable once-per-Colorado-day tag
`live-promotion/YYYY-MM-DD`. A rerun cannot promote twice on the same day;
if GitHub does not support the atomic operation or GitHub Actions lacks rights,
the job fails safely without an unsafe fallback. If checks fail, the code is
divergent, or main changes during verification, it does not deploy.

Vercel setting required: Project `stripe-mcp` → Settings → Environments →
Production → Branch Tracking → `live` → Save. **Verify in Vercel** rather
than assuming it changed. The Ignored Build Step may additionally be set
to a strict `live`-only filter; that does not replace Branch Tracking.

CI on main is unaffected; Vercel can build Preview deployments for other
branches unless preview builds are explicitly disabled. The workflow has no
manual trigger and does not invoke the Stripe API, turn on Stripe LIVE mode,
remove deployment protection, move money, install secrets, or change the
existing Vercel, Neon and owner-gated acceptance flows.

Rollback/recovery: stop scheduled promotions before editing or retargeting
`live`; inspect its ref and daily marker and require owner authorization
for an emergency promotion. Never force-push `live` or delete the promotion
marker as an automated repair. Vercel's rollback and connected branch should
be independently inspected. If the Vercel branch setting cannot be changed
with available authorized tools, record that as an explicit uncompleted
configuration step; do not mark the transition done.
