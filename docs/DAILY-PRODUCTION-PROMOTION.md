# Daily production releases and low build cost

Development PRs target main. Only the scheduled daily promotion workflow writes live: 00:01 America/Denver (12:01 a.m. local time, including daylight saving changes; GitHub may start late). It requires the existing six exact-head Actions checks and atomically advances live with a dated Colorado-day tag. Unchanged heads skip; failed/missing checks, divergence and consumed day markers refuse release. No manual dispatch, no force-push fallback.

Owner-directed verification on 2026-10-12: Vercel Production Branch Tracking is live, and Preview Branch Tracking is disabled. vercel.json also disables Git deployments on every branch except live, including slash-named branches. Vercel settings apply to the linked project now; the repository rule protects future configurations. GitHub CI and existing offline/SQL/HTTP checks continue without a paid deployment requirement. Do not run Vercel CLI production deployments, promote previews, or release at a development batch boundary without a separate explicit owner instruction.

The live branch was provisioned from the previously verified deployed commit before the workflow was enabled. If live is deleted, restore the last verified released SHA deliberately rather than silently recreating it from main. Review Actions → Daily live promotion after the next scheduled run; verify the marker and live ref, then the Vercel deployment's source and status. No production build is triggered merely to test this cost change.

This does not enable Stripe LIVE, money movement or production-account access. All existing owner gates and deployment protection remain unchanged. Production requests, subscriptions, storage, database use and retained sandboxes can still incur charges; disabling builds does not erase billed usage.

## Active development and explicit release (owner, 2026-10-13)

Main advances while agents work; live records the released snapshot. Scheduled promotion refreshes remote heads and waits at most ten minutes for pending exact-head checks, retains all six required checks, and refuses failure or divergence. A one-off explicit owner request permits a leased, non-forced fast-forward after CI, followed by exact-SHA Vercel READY and production-alias verification. This does not permit automatic releases at development batch boundaries or enable Stripe LIVE operations.
