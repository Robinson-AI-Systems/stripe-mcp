# Stripe connection, independent identity and optional God Mode

**Owner-approved 2026-10-23. Engineering NOT completed by this design.** Applies to
existing CAP-1..CAP-5 and existing unfinished source/acceptance cards; no invented batch IDs,
credential rights, live deployment or owner consent. GitHub MCP's mobile-focused
`src/tenancy/public-connect.js`, `src/tenancy/public-http.js`,
`src/tenancy/master-credential.js`, `src/github/credential-authority.js`
are *behavior and security references*, not copy/paste provider adapters.

## Connection contract

1. ChatGPT or Claude adds **Stripe by Robinson AI Systems** using ordinary remote
   MCP OAuth discovery/registration, PKCE S256, callback and issuer/resource checks.
   Sign-in opens inside the client's provider-owned browser journey with automatic return.
2. Verify a stable **human principal and tenant membership** independently of the Stripe
   App's account OAuth authorization: a Stripe account grant is not evidence identifying
   which person at an organization is operating the client. Company developer credentials
   never automatically confer customer rights. Reuse a trustworthy identity provider,
   not a homegrown password protocol; select and document it before enabling enrollment.
3. Prefer a properly registered Stripe App with `stripe_api_access_type: oauth`
   and the **approved declared API permissions**. Offer Stripe-owned installation
   for a selected account; verify exact provider issuer, OAuth state/PKCE where supported,
   returned Stripe account, mode, actual grants, and recipient/tenant before issuing
   MCP credentials. Do not guess a universal install URL or launch a Connect onboarding
   flow as a substitute for Stripe App installation.
4. Show **one** mobile-safe final client approval screen: named requesting client,
   verified Stripe accounts, selected read-only or explicit Full profile,
   TEST/LIVE distinction and potential cost/write notices. Approve and cancel are
   independent one-use server-side states. Hand the client its code exactly once and
   return automatically. Avoid fragile multi-cookie redirect chains.
5. A separately authenticated **My Connection** screen manages own accounts, newly
   installed accounts, connected clients, read-only controls, account/mode choice,
   disconnect, revoke/rotate, history and optional additional credentials. Recheck
   membership and permission revision for every action, including cross-device calls.
6. Existing owner key page remains available for legitimate developer/legacy accounts.
   Additive migration maps an **independently verified owner** to existing encrypted
   account grants; ambiguous or orphaned keys are quarantined/reconnect-required.
   Never share global credentials with newly enrolled customers.

## Standard vs God Mode

- **Standard Full** makes every provider-authorized operation available under the
  user's selected policy; it is *not* an intentionally crippled plan.
- **God Mode** is an optional capability-based **additional credential** journey,
  not a single fabricated Stripe super-token. Stripe App OAuth, Connect OAuth,
  account restricted/secret keys and organization keys are different kinds with
  different API permissions, entitlements and account contexts.
- Operation-specific credential resolver uses verified `principal + tenant +
  verifiedStripeAccount + environment + connectedAccount + operation + grant revision`.
  Prefer a sufficiently scoped existing grant. Multiple eligible grants require
  explicit selection according to reviewed policy. Never silently retry under a
  broader credential, never borrow another user's grant, never use service developer
  credentials for customer actions.
- If an operation needs an extra credential, open the **provider-owned** authorized
  consent screen where possible. If Stripe requires manual key creation, launch the
  legitimate Stripe Dashboard and accept a key only through a protected, one-use
  HTTPS entry form, never a tool argument/chat, verifying issuer/account/mode/scopes
  before storing tenant-bound encrypted ciphertext. No promise of automatic key
  creation or a single all-access Stripe key.
- An organization key (`sk_org`) requires verified organization authorization,
  explicit `Stripe-Context` and API version, including correct Connect account
  context where supported; it is not interchangeable with account keys.
- Display actual additional areas unlocked, missing provider grants, expiration,
  rotation and revocation separately from source coverage. No permission percentage
  without a reproducible provider-operation denominator.

## Independent security and proof

Keep every existing seven-case write contract, confirmation, app ownership, exact
readback, idempotency, money-out signed-in **independent owner approval**, and shared
**$500 per Stripe account per America/Denver day** limit. Standard and God Mode do
not bypass them. Development $0/no-unapproved-LIVE restrictions apply to implementing
agents, not as permanent customer product limitations. LIVE activation remains a
separate existing account-specific owner decision.

Required disposable PostgreSQL tests: two people/two tenants, same person in
different role contexts, Robinson as ordinary production customer, independent
Stripe account switching, wrong account/tenant/mode/issuer/audience/redirect,
PKCE/state replay, concurrent enrollment/refresh/revoke, key AAD migration,
interrupted token exchange, stale membership, account disconnect vs app uninstall,
and financial guard under every credential family. All denial paths must block
provider I/O. Independent deployed direct ChatGPT/Claude desktop/mobile evidence
remains CAP-5; optional Hub federation is not a Stripe completion gate.

## Delivery allocation, not a parallel roadmap

- **CAP-1**: versioned operation and credential requirements, source and live evidence.
- **CAP-2**: ordinary Full and selected read-only policies plus account/client effective
  permission recovery, without silent widening.
- **CAP-3**: full human identity/tenant authorization, Stripe App OAuth install/return,
  one-screen client consent, My Connection, credential lifecycle and optional God Mode.
  Freeze additive migration before touching storage; complete all callers and tests.
- **CAP-4**: advanced provider operations chosen from CAP-1, using CAP-3 resolver and
  original guarded tools; include organization/Connect account-specific paths.
- **CAP-5**: original and new exact-source provider/client acceptance on real
  authorized, nonproduction fixtures. Do not claim anything from CI alone.

## Provider source and distribution boundary

- https://docs.stripe.com/stripe-apps/api-authentication
- https://docs.stripe.com/stripe-apps/test-app
- https://docs.stripe.com/keys
- https://docs.stripe.com/api/authentication

Stripe App creation, requested permission review, installation/testing and public
distribution are **separate provider prerequisites**. A public Stripe App may require
Stripe review/Marketplace procedures. Do not publish, spend, activate LIVE or alter a
customer account to demonstrate this design. External distribution belongs to the
Robinson AI Systems company project; this service implements direct connectivity.
