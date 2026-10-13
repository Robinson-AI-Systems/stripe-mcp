# OWNER-TEST-VISIBILITY-200 — make TEST owner report unmissable

Status: proposed substantive UX/reliability defect fix, PR #200 (expected next), owner-reported 2026-10-13.

**Observed:** Real owner used canonical setup form and perceived a blank page reset. The source renders all result/status output after five long forms, below browser's return-to-top after POST. Vercel runtime log has no verified authenticated TEST call conclusion. Do not mark genuine TEST acceptance based on report design or CI.

**Contract:** Render TEST form first. Every owner HTML POST that supplies a safe result string must show an accessible response banner before any form; successful read-only smoke must show its specific allowlisted tool statuses and status counts at top with a clear "NOT certified" statement, and preserve detailed report via optional disclosure. Rejected password and runner failure must show visible rejection, not completion. Initial GET has no misleading response banner. Verify no private key, Stripe provider payload, login secret, identity token, account isolation change, new LIVE/money authority, or dashboard/Webhook/OAuth acceptance claimed. Preserve existing origin/CSRF, one-time bearer secrecy and no-store.

**Acceptance:** Tests assert top-of-page ordering (including smoke action), 3-tool admin readback statuses, no false readiness, no secret leakage, failure and invalid password feedback. Exact-head check/unit/db/mock/rtc-reference/ci/target-main; independent reviewer threads; merged main CI. Scheduled release checks exact live revision; genuine owner form retry with sanitized statuses remains next owner gate.

**Alignment:** #200 ends present numbered batch on a multiple of five; never pad or claim TEST milestone PASS from synthetic proof. No manual release or new spend without authorization.
