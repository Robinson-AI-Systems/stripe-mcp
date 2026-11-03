# RAS MCP Standard conformance record

**Owner direction, 2026-11-02:** Chris directed that this server's plans be
brought into line with the RAS MCP Specification. This record is that
conformance pass. It changes **plans and plan documents only**: no code, no
deployment, no provider action, and **no claim that the implementation
conforms**. Implementation conformance is separate acceptance work, proven per
row below on live evidence at the checked deployed release; until a row's
acceptance runs, its implementation status stays `DESIGNED / NOT VERIFIED`
(or the weaker label the row itself states).

## Governing specification

- [Library D-001 — the RAS MCP Standard](https://github.com/Robinson-AI-Systems/library/blob/main/designs/ras-mcp-standard.md),
  Robinson-AI-Systems/library, read at main `063eeff2` (2026-11-02), including
  the 2026-11-02 amendments: the fleet developer access boundary, VER-1
  release provenance, the cross-server pattern appraisal, the client ID-card
  (CIMD) contract and its promulgation plan.
- The Standard's promulgation table names Vercel, GitHub, Workspace, Dokploy
  and Neon; it does not carry a Stripe row. This record is Stripe's row,
  kept here in the style of [HUB-COMPATIBILITY](HUB-COMPATIBILITY.md), and it
  closes on the same terms: live evidence at the checked release, never
  source inspection alone.
- Where this record and an older plan disagree, this record and the dated
  [DECISIONS](DECISIONS.md) entry of 2026-11-02 win for planning; the older
  text is corrected in place where it states a rule (see Corrections).

## Status vocabulary

- **CONFORMS** — the existing plan already states the requirement; no change
  was needed. Plan-level only.
- **PLANNED** — the requirement is now recorded as planned work in this pass,
  with its home unit and the acceptance that closes it.
- **CORRECTED** — plan text contradicted the Standard and has been amended in
  this pass; each correction is also named in the PR body.
- **NOT APPLICABLE** — the requirement does not bind this server, with the
  reason stated.

## Conformance record

### 1. Client compatibility — matrix, both auth shapes, verification gate — PLANNED

The Standard (2026-10-30) requires every server to ship compatible with the
clients people actually use, verified before deploy: ChatGPT and Claude
(phone app, browser, desktop), Muse, Hermes Agent, and the common
coding clients (Claude Code, Cursor, Windsurf, VS Code, Codex, Gemini CLI);
Remote Streamable HTTP as the baseline door; **both** auth shapes — a simple
bearer/API-key header and OAuth 2.0/2.1 with PKCE including public clients
with no secret; a per-client setup snippet in the connector package; and a
pre-deploy spec-shaped handshake per transport/auth shape (initialize at the
protocol versions real clients send, tools/list, one real tool call), with
results recorded and untestable clients declared untested, never silently
skipped. Confidential-client-only registration and a mandatory `resource`
parameter are named walls — do not rebuild them.

This server's plans already assume OAuth discovery/registration with PKCE
S256 and service-issued passes/bearer for the RTC doors, and CAP-5 already
requires direct ChatGPT/Claude desktop/mobile evidence. What was missing is
now planned: the full client matrix and the handshake gate are acceptance
rows under **CAP-5**, and the per-client setup snippets (including the
Hermes `config.yaml` form) are part of the connection material delivered
with **CAP-3**. A client shape that cannot connect gets a legible refusal
and a remedy, never silence.

### 2. Client ID cards (CIMD) — fetch and validate, never recognise-only — PLANNED

The Standard's 2026-11-02 amendment: clients such as Claude and ChatGPT may
identify themselves by a **URL pointing at their own ID card** (a client
metadata document) instead of registering or presenting a server-issued
client ID. A server that advertises visiting-client support **must fetch the
card and validate it**:

- fetch over HTTPS from the exact `client_id` URL; the card's own declared
  address must equal the URL it was fetched from; a client name must be
  present;
- every redirect address used must be printed on the card (the reference
  implementation's documented Claude Code localhost matching is preserved,
  not generalised);
- **secret-holding cards are refused** — card clients are public clients,
  never silently upgraded to confidential clients;
- the fetch is SSRF-bounded: HTTPS only, no private, link-local or reserved
  targets, bounded redirects, time and size caps;
- negative tests all fail closed without issuing credentials: unknown card
  host, fetched-address mismatch, redirect not on the card, secret-holding
  card, private-network card URL, oversized or slow card;
- support is claimed only after a **live knock test** with a real card
  client passes against the checked deployed release; until then the status
  is at best `FIXED IN SOURCE / NOT VERIFIED LIVE`. Reference pattern:
  PenPal's `resolveCimdClient` (live 2026-11-01); Vercel MCP PR #414 and
  GitHub MCP PR #555 fixed the same failure on 2026-11-02.

The connection design previously assumed discovery/registration as the only
client identification shape. **CAP-3** now carries card clients as a
first-class identification shape in the connection contract (see the
correction to [STRIPE-CONNECTION-GOD-MODE](designs/STRIPE-CONNECTION-GOD-MODE.md)),
and **CAP-5** carries the live knock test. No card support is claimed today.

**Implementation status (2026-11-02):** implemented in source in the
CAP-3 connection workstream (packet
[CAP-3-cimd](pr-cards/CAP-3-cimd.md)): `src/core/cimd.js` fetches and
validates cards with the full bound above — including DNS-answer
classification, which this server adds to the reference pattern — and
the authorize/token/revoke handlers resolve card clients alongside
dynamic registration. Status is `FIXED IN SOURCE / NOT VERIFIED
LIVE`; the CAP-5 live knock test against the checked deployed
release is still owed and closes this row.

### 3. One public sign-in; profiles are customer settings — CORRECTED

The Standard: exactly **one public customer sign-in and consent journey**.
Read-only, production/live, profile, areas and spending/approval delegation
are chosen as authenticated **customer settings**, never as alternate login
systems; the public sign-in yields the fullest grant the provider
authorised, and any tightening is the user's own setting in force.
Developer or read-only **sign-in modes** do not exist.

[MAXIMUM-AUTHORITY](designs/MAXIMUM-AUTHORITY.md) already frames this
server's Read-only/Everyday/Full as "explicit user delegation choices, not
artificial credential tiers", which is the settings framing. The correction
is to the connection design's consent-screen wording, which presented a
"selected read-only or explicit Full profile" as part of the connect
journey: the approval screen now **displays the resulting effective
access** (accounts, TEST/LIVE mode, the grant the provider authorised, and
any read-only tightening the user has set for this connection), while
profile and read-only choices live in the authenticated **My Connection**
settings, where the design already manages them. No plan change to the
money rules: IN-05 owner approvals and the shared daily cap are untouched.

**Implementation status (2026-11-02):** the consent journey is
corrected in source with the card work (packet
[CAP-3-cimd](pr-cards/CAP-3-cimd.md)): the authorize page renders no
profile or listing choice, displays the resulting effective access,
and defaults a new connection to the fullest grant (`full`); a
profile value remains honored only as the connection's stored
setting, with all LIVE gates unchanged. The My Connection settings
screen itself remains CAP-3 engineering gated on the unselected
human identity provider; live verification of the corrected journey
rides the same deployed-release evidence as row 2.

### 4. Developer access boundary — PLANNED (with classification)

The Standard (2026-11-02): a developer/implementation-agent sign-in and any
system for issuing developer-only TEST grants belong **only to a separately
protected backend developer/operator control plane** — never a public
sign-in mode, login choice, consent option, advertised onboarding path,
tool-catalog capability or public page link. Dev grants are their own type:
minted only by developer-authenticated, explicitly entitled personnel for
isolated development identities, fixtures and TEST contexts; short-lived,
default read-only, stored, expired, revoked, audited and rate-limited as
their own type; never imported into public users, never exchanged for live
customer authority, and **never used to fake a LIVE acceptance result**.
Public customer tokens fail on development endpoints and development grants
fail on public LIVE customer operations; cross-tenant, cross-environment,
wrong issuer/audience and revoked-role requests fail closed. Migrations are
additive; a route's name is not proof of its principal class; an endpoint
that serves a genuine customer flow is inspected and relocated, never
simply disabled.

Classification for this server, recorded so the boundary is explicit:

- The implementing-agent developer connection
  ([DEVELOPER-CONNECTION](pr-cards/DEVELOPER-CONNECTION.md), served by
  `api/developer/connect.js`) is this server's **developer/operator
  surface**: a mobile OAuth handoff that reuses native OAuth with owner
  consent and issues a distinct developer-principal grant. It conforms in
  kind — a separate principal, its own grant type, protected client
  storage — and the plans now record the standing rules that bind it: it
  is never linked or advertised from the public front door, the public
  connection page, the tool catalog or any public onboarding path; its
  grants are never customer authority and its evidence never counts as
  LIVE customer acceptance (the card already keeps those layers separate).
- Any future TEST-grant issuance adopts the Standard's `DevGrant` minimum
  specification (separate internal principal/role resolver with no
  public-user fallback; a compact grant record in this server's own
  identity/grant store — the CAP-3 tenancy store is the candidate home,
  with explicit distinct types, not a new database by default; who/which
  boundary/why/when journaling without secrets; the denial and recovery
  contract failing closed without issuing credentials).
- Existing owner passphrase/setup surfaces are **transitional** in the
  Standard's terms: they are preserved while needed, and named operator
  identity is the recorded direction before the fleet contract is asserted
  as met. Nothing is disabled by this record.
- Batch V's "developer tools" (seed data, cleanup, test events, clocks)
  are **customer product features** for developers using Stripe, not fleet
  developer grants; the appraisal distinction in the Standard (a server's
  product features are not proof of a developer identity system) is
  recorded so the two are never conflated.

Acceptance that closes this row is the Standard's: public pages, metadata
and client snippets show zero developer-login/test-grant links; an
entitled developer uses the protected backend; an ordinary user with the
same provider account cannot reach it; crossover attempts fail closed both
ways. Until that runs live, status is `DESIGNED / NOT VERIFIED`.

### 5. Release provenance — VER-1 — PLANNED

The Standard (2026-11-02, from GitHub MCP's VER-1): an agent must be able
to answer "which exact release am I connected to, and where can I read the
latest changes?" from the server itself. Planned for this server:

- one checked source for the installed package version and the running
  build SHA, resolved from verified build-time deployment metadata —
  never from `main` HEAD, request headers, a guessed tag or the last CI
  run; an unknown SHA is reported as unknown, never synthesised;
- the same version identity returned in the MCP `initialize`
  `serverInfo.version`, in `stripe_whoami` under `server_release`, and in
  the public manifest `version` + `revision`; `/health` and the front door
  use the same source;
- `server_release` exposes machine-readable `version`, `commit` (or
  `null`), `source` (stable commit URL or an authenticated-safe view) and
  `what_changed` naming the **actual deployed release channel** — for this
  repo the checked daily `main` → `live` promotion and the `live` branch
  history — not a promise that `main` is serving;
- a no-provider-calls unit test proves the surfaces agree, and that an
  unknown SHA returns an explicitly unknown revision.

Nothing in the current plans provided this; `stripe_whoami` exists as the
identity tool and is the planned home of `server_release`. Status:
`DESIGNED / NOT VERIFIED`.

### 6. Identity anchoring — the branded origin is the identity — PLANNED

The Standard (2026-11-01): a connector server's OAuth identity anchors to
its own branded origin — issuer, authorization/token/registration/
revocation endpoints, protected-resource URI, hosted client-identity
documents and every surface that names the issuer all name
`https://stripe.robinsonaisystems.com`, derived from **one configured
value** (this server's `PUBLIC_BASE_URL`); a platform deployment address
is a serving alias, never the identity; discovery fetched from an alias
names the canonical branded issuer; a connection minted against a platform
domain is a defect even when it works.

[STRIPE-BRAND-DOMAIN](designs/STRIPE-BRAND-DOMAIN.md) already targets
exactly this origin with safe cutover gates and already forbids changing
`PUBLIC_BASE_URL` until DNS, TLS, issuer/resource, callback and READY
release evidence pass. This pass adds the one-source rule and the
alias/defect wording to that contract. Status matches the Standard's own
fleet snapshot: the branded address is reserved and advertised, the
deployment does not yet serve there — **identity step unfinished, not
failed**; it completes as one ruled change through the existing cutover
gates, as its own adoption step.

### 7. Unleashed branding and naming — CORRECTED

The fleet naming rule (2026-10-30) and the Unleashed brand system
(2026-11-02): a provider-connector MCP's public title is
"**<Provider> Unleashed by Robinson AI Systems**". This server's plans,
written 2026-10-23, named the product "Stripe by Robinson AI Systems" —
the original-products family name, which does not apply to a provider
connector. **Corrected** in [STRIPE-BRAND-DOMAIN](designs/STRIPE-BRAND-DOMAIN.md),
[STRIPE-CONNECTION-GOD-MODE](designs/STRIPE-CONNECTION-GOD-MODE.md) and the
2026-11-02 [DECISIONS](DECISIONS.md) entry: the public name is
**Stripe Unleashed by Robinson AI Systems** ("Stripe Unleashed" after
first reference). Repo-internal shorthand ("Robinson Stripe MCP") is not
a public surface and is unchanged.

The product mark is the Unleashed **Break-Out** (ring in the master
emerald→teal gradient on charcoal; the shard carries the product accent).
Planned accent claim, recorded here as a planned step only: **Magenta
`#E35FD0`** — the next unclaimed accent in the D-005 registry's
extended-palette order (Vercel Sky, GitHub Arctic, Dokploy Amber, Neon
Coral, Workspace Violet are claimed). Per the registry's binding
four-step procedure, the claim is filed in the registry **in the same
change that ships this server's first branded surface**, after reading
the registry, and verified by read-back. **The claim is not filed by
this pass**, and no branded surface ships here. Trademark guardrails from
the Standard apply at that surface: no Stripe logo/mark/shape in the
mark or lockup, the provider name is descriptive only and never more
prominent than ours, and every connect page, listing and docs front page
carries: **"Stripe Unleashed is a Robinson AI Systems product. It is not
affiliated with, endorsed by, or sponsored by Stripe, Inc."** Where
Stripe publishes brand guidelines, the stricter rule wins.

### 8. Branded front door — the five fleet things — PLANNED

Every RAS MCP ships with: (a) a subdomain of robinsonaisystems.com —
reserved (`stripe.robinsonaisystems.com`), attachment gated by the
brand/domain cutover; (b) a public status front door at `/`, rendered
from the same live state the health endpoint reports (version, store,
posture, tool counts — never hardcoded); (c) a plain-English public
"My connection" page at `/connection` — distinct from the authenticated
My Connection management screen in the connection design; the public page
explains how each client class connects, that sign-in claims an existing
identity, that secrets are entered only on the server's own pages or the
client's protected credential setup, what a connection can and cannot do,
the current registration posture, and how to disconnect; (d) instructions
that name **only** the branded address; (e) exactly **one** listing in
the tools section of robinsonaisystems.com/tools in the standard
feature-block format, with an honest availability eyebrow and the connect
button only when the branded connection page actually answers. Design
implements the website blueprint
(`docs/WEBSITE-BLUEPRINT.md` in Robinson-AI-Systems/robinson-ai-systems),
and public pages carry the blueprint's standard disclaimer block.
Noted stale reference, not changed in this pass: `AGENTS.md` still names
RTC 1 in its "What this is" and rules-location text; RTC 2 governs per
[HUB-COMPATIBILITY](HUB-COMPATIBILITY.md).

### 9. Fleet health contract — PLANNED

The Standard's Stage-1 health contract: one GET JSON readout with the
pinned minimal shape — `status` (`ok`/`degraded`), server version,
deployed SHA, tool count, timestamp; 200 when healthy, 503 when a checked
dependency is degraded; dependency checks that can genuinely fail; no
credentials, user data, internal hostnames or configuration values
(booleans at most) in the public readout. The RTC advertisement SHOULD
carry the health path (RTC 2 ruling D4, already recorded in
[HUB-COMPATIBILITY](HUB-COMPATIBILITY.md)), so the one fleet watcher
learns what to watch from the same document. VER-1 (row 5) and this row
share the same checked version/SHA source.

### 10. Production readiness & protection gate — PLANNED as the bar

No "production ready" claim — in a listing, page, report or conversation —
until this server passes the Standard's readiness gate with evidence per
item, the report filed where the next builder can read it, and any
degraded check declared degraded. The gate's sections apply as written
(public surface & backdoor hunt; sign-in & token hygiene; legal &
protection placement; abuse & cost defenses; privacy & data; observability
& journaling; the 3am doctrine; recovery & fixtures; docs truth & release
discipline), with two server-specific notes:

- **Retention clocks must be stated for this server's own store** and
  swept: the fleet defaults (journals and retained-after-deletion records
  400 days; unused authorizations removed after 180 days) are the starting
  values to adopt or deliberately vary with a dated decision.
- The gate's legal item gates **Robinson AI Systems charging for this
  tool, or any launch beyond beta**, on a one-time attorney review of
  Terms/Privacy. It does not speak to Stripe account holders charging
  their own customers through Stripe, which is the product's ordinary
  function under their own provider accounts.

The owner-question doctrine applies to the gate: solvable questions are
researched, decided and logged, not parked for the owner.

### 11. Discovery & contract governance (RTC) — CONFORMS

Advertise, don't push: the hub discovers and connects; this server never
locates the hub, serves a truthful `/api/contract` advertisement, and
works fully standalone. RTC 2 was adopted by Chris's dated decision
2026-10-31 and is recorded in [HUB-COMPATIBILITY](HUB-COMPATIBILITY.md)
(PR #291); the RTC 1 freeze holds as the RTC 1 record. **No change in
this pass.** The historical "RTC 1" labels on Batch R in
[PLAN](PLAN.md)/[MASTER-ROADMAP](MASTER-ROADMAP.md) are annotated to point
at the RTC 2 adoption record; Batch R's remaining conformance proceeds
under RTC 2 through its own card.

### 12. No global credential fallback — CONFORMS

The connection design already binds this server: never share global
credentials with newly enrolled customers, never borrow another user's or
tenant's grant, never silently retry under a broader credential, never
use service developer credentials for customer actions, and a normal user
links only the provider accounts and permissions they actually control
([STRIPE-CONNECTION-GOD-MODE](designs/STRIPE-CONNECTION-GOD-MODE.md),
[MAXIMUM-AUTHORITY](designs/MAXIMUM-AUTHORITY.md)). No change needed.

### 13. Version evolution — the no-reinstall rule — CONFORMS

Additive-only surface, fail-closed defaults, security upgrades activating
in place, abuse defenses shipping with the surface that needs them. The
plans already design migrations additively (connection design item 6;
CAP-3's "freeze additive migration before touching storage"). VER-1
(row 5) is adopted under the same rule: version changes are
backwards-compatible and tool contracts remain stable. No change needed.

### 14. Pattern appraisal guardrails — recorded

Adopt principles, never another server's mechanics verbatim: the
connection design already treats GitHub MCP's tenancy files as "behavior
and security references, not copy/paste provider adapters". A remote
coding runtime is an **optional capability module**, not a fleet
requirement — **NOT APPLICABLE** here: this server has none and none is
planned. Vercel's issuer logic, Dokploy's permission model and Workspace's
account scheme are not copied into this service; where a fleet MUST is
added later it must name its benefit, provider-independent contract,
negative test, migration cost and where it does not apply.

## Corrections made in this pass

1. **Product name** — "Stripe by Robinson AI Systems" →
   **Stripe Unleashed by Robinson AI Systems** in
   [STRIPE-BRAND-DOMAIN](designs/STRIPE-BRAND-DOMAIN.md) and
   [STRIPE-CONNECTION-GOD-MODE](designs/STRIPE-CONNECTION-GOD-MODE.md);
   supersession recorded in [DECISIONS](DECISIONS.md) (2026-11-02).
2. **Product mark** — the brand/domain contract's "use the company's R
   logo/wordmark" as the product identity is corrected: the product mark
   is the Unleashed Break-Out; the R logo remains the Robinson AI Systems
   publisher/company mark. Magenta `#E35FD0` recorded as the planned
   accent claim (not filed).
3. **Consent screen** — profile selection removed from the connect
   journey's wording in the connection design; the screen displays the
   resulting effective access, and profile/read-only choices are My
   Connection customer settings (row 3).
4. **Client identification** — the connection design's connect step now
   includes client ID-card (CIMD) clients alongside discovery/registration
   (row 2).
5. **RTC labels** — Batch R's "RTC 1" framing in [PLAN](PLAN.md) and
   [MASTER-ROADMAP](MASTER-ROADMAP.md) annotated with the RTC 2 adoption
   pointer (row 11). The RTC 1 record itself is untouched.

## What this pass deliberately does not do

- No code, schema, deployment, DNS, Stripe App, key or LIVE change.
- No D-005 registry claim filed (row 7 records the planned claim only).
- No implementation subsection is marked complete, and no acceptance row
  is passed: CAP-1..CAP-5 and the protected acceptance queue are
  untouched. The conformance rows above close only through their own
  cards and live acceptance.
- The branded cutover remains behind its existing gates in
  [STRIPE-BRAND-DOMAIN](designs/STRIPE-BRAND-DOMAIN.md); nothing here
  attaches the domain or moves the issuer.
