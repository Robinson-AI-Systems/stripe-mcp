# Go-live checklist — everything that must be switched on before real money moves

Written for Chris (not a developer). Rule: everything is built and tested in **test mode**; anything that touches real
money is off until you complete the step here. Tick a box only after the "how you know it worked" check is done. Every PR
that adds a switch adds a line here.

Legend: **Owner** = only Chris · **Agent** = Claude can do it once you say go.

## 1. The server itself

| Done | Item | Where / how | Today | How you know it worked |
|---|---|---|---|---|
| [ ] | `DATABASE_URL` configured for this server's own Neon database (IN-02) | Vercel → Environment Variables (Agent after approval) | Not set | Server initializes its seven tables without touching any other project |
| [ ] | Vercel project and Neon database created (IN-02) | Vercel and Neon connectors (Agent, after you say go) | Not created | The server's home page shows its tool counts |
| [ ] | `ADMIN_PASSPHRASE` and `TOKEN_ENCRYPTION_KEY` set (IN-03) | Vercel → Environment Variables (Owner) | Not set | The setup page asks for the passphrase and accepts a key |
| [ ] | Test-mode restricted keys added (IN-04) | Stripe dashboard → Developers → API keys, then the server's setup page (Owner) | None | `stripe_whoami` shows the account, TEST, key type and last 4 |
| [ ] | Connector added in Claude, test mode (Owner) | claude.ai → Settings → Connectors | Not added | Claude answers "who am I connected as?" correctly |
| [ ] | Daily money limit confirmed (IN-05) | Ask Claude: "set my Stripe money limit to $X" (Owner confirms) | $500 default | `stripe_whoami` shows the limit |

**Developer safeguard (A-4a):** Any preview, staging or local deployment refuses live Stripe keys at the client constructor. This safeguard does not itself enable live use; Batch B's two-step owner approval is still required.

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
