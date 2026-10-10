# Owner inputs and decisions

Decisions only Chris can make, with stable IDs. Agents check here first and ask only for what the current card needs.
An answer is "applied" only once the setting and its behavior are verified. Plain English throughout.

| ID | Status | Question | Blocks | Recommended / safe default |
|---|---|---|---|---|
| IN-00 | **Answered 2026-10-10: approved** (Chris: "Yes, I approve the plan") | Approve this plan (all designs in `docs/designs/`) so implementation can start. | Nothing | — |
| IN-01 | **Answered 2026-10-10: public; no Codex review** | Keep this repository public or make it private? Should Codex automatically review PRs here? | Nothing | Applied: repo stays public with secret scanning; PRs get no automated review — the implementer inspects the diff itself (AGENTS "Review") |
| IN-02 | Awaiting Chris (before A-5 is tried for real) | Create a Vercel project `stripe-mcp` and a Neon database for it (free tiers). Claude can do both with your Vercel and Neon connectors once you say go. | Real deployment | Free tiers; no purchase |
| IN-03 | Awaiting Chris (with IN-02) | Set two secrets in Vercel yourself: `ADMIN_PASSPHRASE` (the passphrase for the login and setup pages) and `TOKEN_ENCRYPTION_KEY` (DEPLOY.md shows how to generate it). Claude never sees them. | Real deployment | — |
| IN-04 | Awaiting Chris (after A-5 deploys) | In Stripe (test mode), create the MCP's restricted keys with the permission lists in DEPLOY.md and paste them on the setup page. These are separate from Appliance Desk's own key. | Using the server | Start with "Everyday" in test mode |
| IN-05 | **Answered 2026-10-10: policy approved; owner approval UI not yet activated** | **$500 per Stripe account per Colorado calendar day**, shared across all AI connections. **Every AI money-out operation requires Chris's own authenticated approval even below $500; crossing the limit requires separate, transaction-specific override approval.** No AI flag counts as approval; pending authorizations expire and are single-use. | B-1 policy; B-8 authenticated owner approval workflow before writes become reachable | Approved $500, no automatic spend; live mode remains off |
| IN-06 | Later | Turn on live mode for a Stripe account (two steps: a tool plus your passphrase on the setup page). | Any live use | Off until you say so, per account |
| IN-07 | **Moved 2026-10-10** to Robinson's Toolkit (the relay is built there, once, for every server) | — | Nothing here | — |
| IN-08 | Awaiting Chris (before P-3 is used for Appliance Desk) | In Stripe → Billing → Revenue recovery: when every retry of a subscription payment fails, what should Stripe do? If Stripe cancels the subscription, Appliance Desk receives a cancellation for a rental it still considers active. Also the retry schedule. | Appliance Desk go-live | **Leave the subscription past due and the invoice open** (the app handles overdue bills, late fees and your To do list). Keep Stripe's recommended retry schedule |
| IN-09 | Awaiting Chris | Which emails should Stripe send customers? Receipts are needed (phone payments rely on Stripe's receipt). Stripe's failed-payment and upcoming-renewal emails could duplicate the app's own messages. | Appliance Desk go-live | Receipts **on**; Stripe's failed-payment and renewal reminder emails **off** while the app's own customer messages handle those (revisit if the app's email stays off at launch) |
| IN-10 | Awaiting Chris | Customer portal: let customers update their card/bank and see invoices, but **not** cancel or switch plans (the app owns agreements and terms). | P-3 fix for the portal | As recommended |
| IN-11 | Later, optional | A Stripe custom payment domain (pay.<your domain>) is a paid add-on. | Nothing | Not bought |
| IN-12 | Later (Batch X) | Robinson's Toolkit's `stripe` namespace: keep for local use, retire, or point its compound tools at this server. | X-3 follow-up | Decide after this server is in use |
