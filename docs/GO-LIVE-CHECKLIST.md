# Go-live checklist — everything that must be switched on before real money moves

Written for Chris (not a developer). Rule: everything is built and tested in **test mode**; anything that touches real
money is off until you complete the step here. Tick a box only after the "how you know it worked" check is done. Every PR
that adds a switch adds a line here.

Legend: **Owner** = only Chris · **Agent** = Claude can do it once you say go.

Follow the owner-friendly [DEPLOY.md](DEPLOY.md) for each setup step. The checklist below remains unchecked until each step is actually verified.

## Hosted page launch gates (D-3 — not yet satisfied)

- [ ] Configure and verify three nonsecret TEST-mode HTTPS redirect URLs
  on the same owner-controlled origin, as described in `DEPLOY.md`.
- [ ] Confirm card and US bank credentials are collected only by Stripe's
  hosted pages and no tool or chat returns a client secret.
- [ ] Review TEST portal cancellation/plan-change policies before allowing
  policy mutation; owner-full profile and confirm are required.

## 1. The server itself

| Done | Item | Where / how | Today | How you know it worked |
|---|---|---|---|---|
| [ ] | `DATABASE_URL` configured for this server's own Neon database (IN-02) | Vercel → Environment Variables (Agent after approval) | Not set; `PUBLIC_BASE_URL` configured on Production, but redeploy pending | Server initializes its fourteen additive tables without touching any other project |
| [ ] | Vercel project and Neon database created (IN-02) | Vercel and Neon connectors (Agent, after you say go) | Vercel project created and GitHub-linked; initial production build READY; independent Neon project not yet created (Neon Launch metered plan) | The server's home page shows its tool counts |
| [ ] | `ADMIN_PASSPHRASE` and `TOKEN_ENCRYPTION_KEY` set (IN-03) | Vercel → Environment Variables (Owner) | Not set | The setup page asks for the passphrase and accepts a key |
| [ ] | Test-mode restricted keys added (IN-04) | Stripe dashboard → Developers → API keys, then the server's setup page (Owner) | None | `stripe_whoami` shows the account, TEST, key type and last 4 |
| [ ] | Connector added in Claude, test mode (Owner) | claude.ai → Settings → Connectors | Not added | Claude answers "who am I connected as?" correctly |
| [ ] | $500 standard daily policy applied (IN-05) | Owner approved $500 USD per Stripe account/Colorado day; private page permits independently approved per-account changes | Approved policy, no deployment | Once deployed, `stripe_whoami` verifies exact persisted account cap; every outgoing AI transaction STILL requires independent approval |

**Developer safeguard (A-4a):** Any preview, staging or local deployment refuses live Stripe keys at the client constructor. This safeguard does not itself enable live use; Batch B's two-step owner approval is still required.

**Encryption storage reminder (A-5a):** The base64-encoded 32-byte `TOKEN_ENCRYPTION_KEY` must remain stable across deployments. Replacing it without migrating previously encrypted keys would require reconnecting the affected accounts. No key value is stored in the repository.

## 2. Live mode, per Stripe account

| Done | Item | Where / how | Today | How you know it worked |
|---|---|---|---|---|
| [ ] | Live restricted key added for the account | Stripe dashboard + setup page (Owner) | None | `stripe_whoami` on a live connection shows LIVE |
| [ ] | Live mode enabled for that account (IN-06): ask Claude, then re-enter your passphrase on the setup page | Owner | Off | A new connection offers "live" for that account |
| [ ] | A $1 test charge and refund in live mode, done with you watching | Owner + Agent | Not done | Both show in Stripe and in `stripe_recent_changes` |

## 3. Projects (one section per profiled project)

### Appliance Desk

Run `workflow_app_readiness` for Appliance Desk in test mode, then live mode, and work through what it lists. The full
list with explanations is `docs/APP-NEEDS-APPLIANCE-DESK.md`; the app's own checklist (`appliance-desk/docs/GO-LIVE-CHECKLIST.md`
§1 Money) stays the authority for turning the app's live payments on.

| Done | Item | Today |
|---|---|---|
| [ ] | Test webhook has all seven events (two are missing today) | 5 of 7 |
| [ ] | Branding, public details, statement name, receipt emails | Not set |
| [ ] | Revenue recovery decision applied (IN-08) | Not checked |
| [ ] | Customer email choices applied (IN-09) | Not decided |
| [ ] | Portal: update payment method + invoices only (IN-10) | Unknown |
| [ ] | ACH on for Checkout and invoices | Unknown |
| [ ] | Live webhook + its secret in the app's Vercel (Owner pastes) | n/a |
| [ ] | App's live restricted key created with the printed permission list and put in the app's Vercel (Owner) | n/a |
| [ ] | Stripe confirms phone payments are allowed (Owner, Stripe support) | Not asked |

## Money-out owner authorization gate (IN-05, 2026-10-10)

B-8c2 implements two independently password-authenticated TEST-only owner confirmation actions on the private setup page. Verify all following items on the eventual authorized deployment before ticking them; the feature is NOT deployed, and AI provider money tools remain off.

- [ ] Owner-only authenticated browser page lists exact account, tool, Stripe-derived
      amount, target/destination and request key for pending money-out operations.
- [ ] Owner must affirm each transaction individually, even for $0.01.
- [ ] When the account-wide Colorado-day total would exceed $500 USD, require
      a **separate explicit override affirmation** for that same transaction.
- [ ] Approval cannot be generated, forged, reused, stretched to a different target
      or amount, or approved by any AI tool or agent argument.
- [ ] PostgreSQL consumes owner grant atomically with the money reservation.
- [ ] Verify cross-connection concurrency, expiry, uncertain provider outcomes,
      confirmed rejections, one-use grants, and replay resistance.
- [ ] Live money movement remains DISABLED until IN-06 is separately approved.

## Live enable two-step gate (B-2b, IN-06)

- [ ] Obtain separate, explicit IN-06 approval before using any live Stripe key
      or setting `LIVE_MODE_OWNER_APPROVED=true`.
- [ ] Confirm the account has a verified, encrypted LIVE restricted key through
      the future owner-only key entry flow (not provided by current setup).
- [ ] Request a one-time live-enable intent as a FULL-profile confirmed action;
      it expires in ten minutes and cannot activate the account by itself.
- [ ] In the owner setup page re-enter the admin passphrase and affirm the exact
      Stripe account, behind origin, CSRF and rate-limit protections.
- [ ] Verify the intent was consumed once and live mode was audited; never infer
      authorization solely from a tool argument or a successful HTTP response.

## Owner-only connection administration (B-8b2a)

- [ ] When deployed, verify a private owner can preview a specific account/client
      connection without revoking it, then confirm via passphrase, CSRF and explicit
      acknowledgement; one-use intent expires after ten minutes.
- [ ] Verify the revoked connection's access and refresh credentials stop working,
      with one audit record and no effect on other accounts or clients.
- [ ] Never treat an AI `confirm` as owner authorization. No AI-callable account
      write is enabled by this private page, and IN-06 LIVE remains OFF.

## Emergency LIVE access disable (B-8b2b1)

- [ ] After a separately approved server deployment, verify the protected
      setup page's OFF-only intent shows the exact account before confirmation.
- [ ] Confirm separately with owner passphrase, same-origin CSRF and explicit
      checkbox. Verify the account's `live_enabled` flag becomes FALSE and
      one security audit record appears; unrelated accounts remain unchanged.
- [ ] IN-06 still controls **enabling** LIVE mode and remains unapproved.
      Emergency disable cannot authorize any LIVE payment or money movement.

## Owner-selected default account (B-8b2b2)

- [ ] When separately approved for deployment, verify the owner can preview
      the selected Stripe TEST account and previous default, confirm using
      the protected two-step owner setup page, and read back exactly one default.
- [ ] Existing AI connections retain their original Stripe account;
      conflicting/stale/expired requests fail, with one change-log entry.
- [ ] This does not change the approved $500 account-wide money policy,
      enable LIVE, or give any agent approval authority.

## Owner-adjustable daily AI money-out cap (B-8b2b3)

- [ ] After separately approved deployment, verify the private owner page
      previews the exact account, current/desired dollar cap and current
      Colorado-day shared money-out usage.
- [ ] Confirm the second protected owner step (passphrase, origin, CSRF,
      explicit checkbox) is single-use, expires, refuses stale changes and
      records old/new cents without moving money.
- [ ] **Do not enable money-out** until B-8c owner transaction approval UI is
      verified. Each AI refund, payout or transfer needs a distinct owner
      approval even below the account cap, and crossing the cap requires a
      separate owner override for that same request. IN-06 LIVE stays OFF.

## Money-out pending request review only (B-8c1)

- [ ] Owner can independently authenticate through the private POST to inspect
      a selected TEST Stripe account's target-bound pending requests and
      current dollar cap/usage, without revealing any information on GET.
- [ ] Legacy requests without a verified provider target, expired requests,
      other-account entries and changed-target replays are never approvable.
- [ ] **No approval or outgoing money operation exists in this slice.**
      B-8c2 must verify owner-specific exact transaction approval and the
      distinct above-limit override before any public money write can run.

## Batch G-4 externally required TEST webhook evidence — pending, not assumed

- [ ] Enroll and verify a connected Stripe TEST account and an owner-controlled public HTTPS webhook destination (no account key or webhook secret in an AI message).
- [ ] Through the independently authenticated owner page, provision a TEST endpoint's signing secret and demonstrate a genuine signed Stripe TEST event: verify exact original bytes, correct endpoint/account, event ID and type; confirm wrong secret, expired timestamp and wrong endpoint are rejected.
- [ ] From that same TEST account, demonstrate one native endpoint creation, event-subscription update and read-back, safe URL-only-origin display, and a guarded endpoint deletion with provider tombstone. Record evidence without raw provider secrets or private event data.
- [ ] Confirm connected TEST account/permission restrictions and LIVE-off remain enforced; record outcome in G-4 external acceptance note before claiming account-backed completion. No go-live authorization is implied by automated CI.
