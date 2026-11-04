# RAS MCP Standard conformance record

**Owner direction, 2026-11-02:** Chris directed that this server's plans be
brought into line with the RAS MCP Specification. This record is that
conformance pass. It changes **plans and plan documents only**: no code, no
deployment, no provider action, and **no claim that the implementation
conforms**. Implementation conformance is separate acceptance work, proven per
row below on live evidence at the checked deployed release; until a row's
acceptance runs, its implementation status stays `DESIGNED / NOT VERIFIED`
(or the weaker label the row itself states).

> **Reconciliation (2026-11-03):** the paragraph above and the closing
> “What this pass deliberately does not do” section describe the original
> 2026-11-02 plans-only pass. Later dated updates inside individual rows
> supersede them where they record source implementation or live proof.
> This file contains **14 numbered rows**, not 16. The single reconciled
> current schedule is [COMPLETION](COMPLETION.md); in case of a summary
> conflict, the row's latest dated evidence plus COMPLETION govern.

> **Design-conformance compensation (2026-11-03, later):** Chris directed
> that the designing to the RAS MCP Specification that was not done be
> made up before further implementation drifts from it. The Specification
> gained three sections on 2026-11-03 — capability completeness, the
> conformance-correction process, and owner-obedience — after this record
> was written against the older text. Under the correction process, each
> new section automatically opened a correction row on this server. This
> record is therefore re-baselined to Library D-001 at Library `main`
> `f134c849038e1845a70e8e1d5a569859571b15f2` (2026-11-03) and extended
> with rows 15–17 below: **17 numbered rows**. The correction process's
> status vocabulary (conforms / correctable / ruled exception /
> not applicable) is adopted in the process-status map under Status
> vocabulary; rows keep their evidence labels alongside it.

## Governing specification

- [Library D-001 — the RAS MCP Standard](https://github.com/Robinson-AI-Systems/library/blob/main/designs/ras-mcp-standard.md),
  Robinson-AI-Systems/library, read at main `063eeff2` (2026-11-02), including
  the 2026-11-02 amendments: the fleet developer access boundary, VER-1
  release provenance, the cross-server pattern appraisal, the client ID-card
  (CIMD) contract and its promulgation plan. **Re-baselined 2026-11-03**
  to Library `main` `f134c849038e1845a70e8e1d5a569859571b15f2`, which adds
  the 2026-11-03 sections: capability completeness, the
  conformance-correction process, and owner-obedience (rows 15–17).
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

**Process status (adopted 2026-11-03 from the conformance-correction
process).** Each row also carries the correction process's status —
**conforms / correctable / ruled exception / not applicable** — which
describes the plan's position against the current Standard, separately
from the evidence label in its heading:

| Row | Process status |
|---|---|
| 1. Client compatibility | correctable (CAP-5 matrix and handshakes) |
| 2. Client ID cards (CIMD) | conforms (component live-closed) |
| 3. One public sign-in | correctable (My Connection settings screen, CAP-3) |
| 4. Developer access boundary | correctable (live pair) |
| 5. Release provenance — VER-1 | conforms (live-closed) |
| 6. Identity anchoring | correctable (branded cutover) |
| 7. Unleashed branding and naming | correctable (D-005 claim at first marked surface) |
| 8. Branded front door | correctable (row 8 items (a), (c), (d), (e); `/` route question) |
| 9. Fleet health contract | conforms (live-closed) |
| 10. Production readiness gate | correctable (gate not yet passed) |
| 11. Discovery & contract governance (RTC) | conforms (plan level) |
| 12. No global credential fallback | conforms (plan level) |
| 13. Version evolution | conforms (plan level) |
| 14. Pattern appraisal guardrails | not applicable (remote coding runtime; recorded) |
| 15. Capability completeness | correctable (census elements 2–4; front-door census line) |
| 16. Conformance-correction process | correctable (process running; closes when all rows conform or carry a ruled exception) |
| 17. Owner-obedience | correctable (four conversions designed; four unclassified items recorded) |

## Conformance record

### 1. Client compatibility — matrix, both auth shapes, verification gate — PLANNED / OPEN

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

### 2. Client ID cards (CIMD) — fetch and validate, never recognise-only — VERIFIED LIVE (component)

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
and **CAP-5** carries the live knock test. No card support is claimed
today. **[Superseded by the 2026-11-03 live acceptance below.]**

**Implementation status (2026-11-02):** implemented in source in the
CAP-3 connection workstream (packet
[CAP-3-cimd](pr-cards/CAP-3-cimd.md)): `src/core/cimd.js` fetches and
validates cards with the full bound above — including DNS-answer
classification, which this server adds to the reference pattern — and
the authorize/token/revoke handlers resolve card clients alongside
dynamic registration. Status is `FIXED IN SOURCE / NOT VERIFIED
LIVE`; the CAP-5 live knock test against the checked deployed
release is still owed and closes this row.

**Live acceptance (2026-11-03):** the CAP-5 knock test ran against
the checked deployed release `5b5f701cb1c7aa803d076b4c5e023b5ea3639ece`
(production, `live` branch) and passed end to end. A real hosted card
was fetched and validated by the deployed server (a fake card was
refused with a legible error; a redirect not printed on the card was
refused; the sanctioned loopback port relaxation held); the owner
approved on the consent page; the token exchange and a refresh
rotation both succeeded with **no `resource` parameter sent** (the
owner ruling recorded in DECISIONS, 2026-11-03); `stripe_whoami`
answered for the connected TEST account and named the deployed
commit as its server release; the grant was then revoked and refused
at the MCP door. Card support is claimed: **VERIFIED LIVE** at that
release. This closes the live half of this row.

### 3. One public sign-in; profiles are customer settings — CORRECTED / JOURNEY VERIFIED LIVE; SETTINGS SCREEN OPEN

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

**Live verification (2026-11-03):** the corrected journey was
exercised in the knock test recorded under row 2 — the approval page
offered no profile or listing choice, and the issued grant carried
the fullest profile (`full`) by default at the deployed release
`5b5f701cb1c7aa803d076b4c5e023b5ea3639ece`.

### 4. Developer access boundary — PLANNED (with classification) / SOURCE IMPLEMENTED; LIVE PAIR OPEN

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

**Implementation (source, 2026-11-02; live acceptance still owed).** The
boundary is now enforced in source under the DEVELOPER-CONNECTION card:
every OAuth grant carries a server-derived identity context (additive
`oauth_tokens.context`, stamped at issuance from the server-verified
code record, preserved through refresh; pre-typing developer grants
resolve by derivation from their registered client, via the
`DeveloperAccess` resolver in `src/developer/access.js`). Developer-context
grants fail closed on LIVE operations at issuance, at refresh and at the
MCP door; customer clients are refused at handoff start and a connector
bearer is not a polling credential; refusals are journaled without
secrets in `developer_boundary_events`; the operator connection and the
passphrase/setup surfaces are classified and marked transitional in code
and docs, with nothing disabled and the connection's TEST flow unchanged.
Unit and real-Postgres tests prove both crossover directions and the
zero-developer-link guard over the public surfaces. What remains for
this row is only the live half of the acceptance above, at the checked
deployed release; the planned `DevGrant` issuance system itself is not
built (no consumer exists yet) and stays bound by the minimum
specification recorded here when it is.

### 5. Release provenance — VER-1 — VERIFIED LIVE

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

**Implementation update (2026-11-02, card [VER-1](pr-cards/VER-1.md)):**
built in source — `src/release.js` is the one checked source (installed
package version; deployed commit from verified build-time deployment
metadata only; unknown stated as unknown), and `initialize`
`serverInfo.version`, `stripe_whoami` `server_release`, the manifest
`version` + `revision`, `/health` and the front door all resolve from
it. The CAP-5 agreement check runs as a no-provider-calls unit test.
Status: `IMPLEMENTED IN SOURCE / NOT VERIFIED LIVE` — the row closes
when the surfaces are re-read at the deployed SHA after the scheduled
`main` → `live` promotion.

**Live closure (2026-11-03 completion reconciliation):** the public
front door (`/api`), `/api/health`, and `/api/contract` were re-read at
deployed commit `c95f9cf0160f85f59789a11d1885e422ec84770b` and agree on
that release. Authenticated `initialize` and `stripe_whoami` were
exercised at the immediate parent release `5b5f701c` in the knock test;
the only intervening change to `c95f9cf0` was documentation, so the code
behavior carries. Row status: **VERIFIED LIVE**.

### 6. Identity anchoring — the branded origin is the identity — PLANNED / CUTOVER OPEN

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

**Implementation update (2026-11-02, card [VER-1](pr-cards/VER-1.md)):**
the code side is proven in source — every issuer surface derives from
the one configured `PUBLIC_BASE_URL` via `publicOrigin`, no serving
code derives an origin from a request Host, and a unit test fetches
the discovery documents with a platform-alias Host and verifies they
still name the configured origin. The live cutover itself (domain
attachment, `PUBLIC_BASE_URL` change, re-proof at the branded origin)
is **not performed** and remains owed as the separate ruled step
through the STRIPE-BRAND-DOMAIN gates above. Status unchanged in
kind: identity step unfinished, not failed.

**Current stack note (2026-11-03):** the configured issuer still names
the platform hostname `stripe-mcp-chris-projects-de6cd1bf.vercel.app`,
which Vercel Authentication intercepts for unauthenticated visitors;
the application was verified serving on the different platform alias
`stripe-mcp-psi.vercel.app`; and `stripe.robinsonaisystems.com` returned
`DEPLOYMENT_NOT_FOUND`. Those are three distinct states and none is the
completed branded identity.

### 7. Unleashed branding and naming — CORRECTED / D-005 CLAIM OPEN

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
this pass**, and no branded surface ships here. For the claim trigger,
“first branded surface” means the first surface carrying the Break-Out
mark, not product-name or disclaimer text alone; the claim remains
unfiled at the 2026-11-03 reconciliation. Trademark guardrails from
the Standard apply at that surface: no Stripe logo/mark/shape in the
mark or lockup, the provider name is descriptive only and never more
prominent than ours, and every connect page, listing and docs front page
carries: **"Stripe Unleashed is a Robinson AI Systems product. It is not
affiliated with, endorsed by, or sponsored by Stripe, Inc."** Where
Stripe publishes brand guidelines, the stricter rule wins.

### 8. Branded front door — the five fleet things — PLANNED / PARTIAL

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

**Implementation update (2026-11-02, card [VER-1](pr-cards/VER-1.md)):**
item (b) is built in source — the front door at `/` renders the public
name, the VER-1 release identity, store posture, tool counts and the
fleet disclaimer from the same live state `/api/health` reports,
nothing hardcoded. Items (a), (c), (d) and (e) remain as recorded:
the subdomain attachment rides the brand/domain cutover gates; the
public `/connection` page and branded-address-only instructions belong
to the connection workstream (CAP-3/CAP-5); the single /tools listing
is website work in another repo, owed when the branded connection
page actually answers. Status: `PARTIALLY IMPLEMENTED IN SOURCE /
NOT VERIFIED LIVE`.

**Live reconciliation (2026-11-03):** item (b)'s substance is now
verified live at deployed `c95f9cf0`, but at **`/api`**, not the literal
`/` route: `/` on the serving alias returns 404 and `/api` returns the
health-derived status surface. The row therefore remains partial; either
the route or this governing wording must be deliberately resolved rather
than silently treating `/api` as `/`. Items (a), (c), (d), and (e)
remain open as recorded.

### 9. Fleet health contract — VERIFIED LIVE

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

**Implementation update (2026-11-02, card [VER-1](pr-cards/VER-1.md)):**
built in source — `GET /api/health` (with a `/health` rewrite) returns
the pinned shape (`status`, `version`, `commit`, `tools`,
`timestamp`), 200 when healthy and 503 when the checked store
dependency is degraded; the dependency check is a bounded `select 1`
against the configured store that can genuinely fail, and the readout
carries no credentials, user data, hostnames or configuration values
(booleans at most). The RTC manifest now carries `health:
'/api/health'`, so the fleet watcher learns the path from the
advertisement. Status: `IMPLEMENTED IN SOURCE / NOT VERIFIED LIVE` —
the row closes on a live read at the checked deployed release.

**Live closure (2026-11-03 completion reconciliation):** `/api/health`
and the `/health` rewrite were read at deployed commit
`c95f9cf0160f85f59789a11d1885e422ec84770b`; both returned the pinned
healthy shape with the database check true, and `/api/contract` at the
same commit advertises `health: '/api/health'`. Row status:
**VERIFIED LIVE**.

### 10. Production readiness & protection gate — PLANNED as the bar / OPEN

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

**Current status (2026-11-03):** no filed production-readiness pass is
recorded. The gate, its retention-clock note, and its legal gate remain
open; a READY production deployment is not a readiness pass.

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

### 15. Capability completeness — the census before the tool list — CORRECTABLE

The Standard (2026-11-03) requires every server — and every major
revision of an existing one — to begin from a written capability census:
(1) the provider's full reachable surface, every item dispositioned
covered / planned / deliberately out; (2) beyond-API substrate designed
in from the start; (3) workflow-frequency research that collapses
repeated call chains into one-call composites; (4) the consumer test —
the provider's whole project scope done through this one connection,
with every "no" dispositioned. Completeness is claimed from the census,
never from the tool count, and the census is a living record.

This server started before the section existed. Scored element by
element against the retroactive census this process prescribes:

1. **Full reachable surface — covered for the API.** CAP-1 is the
   retroactive census: 644 unique GA method/path rows (612 v1, 32 v2),
   five credential kinds per row, provider permission/entitlement kept
   `UNKNOWN` where unproven, and machine checks that keep the registry
   and the census consistent. Surfaces beside the API are covered only
   in part: webhooks and events are inside the API census, and
   dashboard-only settings are carried by the guided-settings design —
   but no separate disposition exists for Stripe's CLI or for
   bulk/export routes beyond their API equivalents.
2. **Beyond-API substrate — present, never censused.** Test-data
   lifecycle, event forwarding, test clocks, and project profiles are
   designed and built, but no census chapter dispositions the substrate
   Stripe work needs beside the API.
3. **Workflow frequency — composites built, research unrecorded.** The
   Batch W workflow tools are one-call composites, but no frequency
   research record supports them. CAP-4's gap derivation
   ([COMPLETION](COMPLETION.md)) must run this element before its gap
   set is frozen.
4. **Consumer test — never formally run.** No record asks, from the
   chair of an agent holding only this connection, whether Stripe's
   whole project scope completes through it, or dispositions the "no"
   answers.

Two corrections ride existing work: the front door currently cites tool
counts (322); under this section its depth line must cite the census —
that correction lands with the branded front door (row 8). And the
living duty is recorded here: the census re-runs when Stripe ships a
major API change, when a user hits a gap in real work (the gap enters
the census first, as a finding), and at each major revision.

**Next step:** a census addendum covering elements 2–4, filed with
CAP-4's just-in-time card. **Closing proof:** the addendum in this
repository, plus the census-citing depth line read live at the branded
origin. Process status: **correctable**.

### 16. Conformance-correction process — bringing a pre-Standard server under the Standard — CORRECTABLE (process running)

The Standard (2026-11-03) names the five-step process this server is
being corrected under, and the standing rule that a new section of the
Standard automatically opens a correction row on every existing server.
This row is that process's record for this server:

- **Step 0 — Freeze and inventory: done twice.** The 2026-11-03
  documentation-versus-code audit (449 items, frozen at `2b9f19a6`) and
  the completion audit (frozen at `c95f9cf0`), each with its degradation
  declared in its record; a degraded phase has never been counted as a
  clean pass.
- **Step 1 — Retroactive capability census: done with gaps.** CAP-1,
  scored in row 15; its missing elements are CAP-4 work, not paperwork.
- **Step 2 — Conformance record: this file.** Fourteen rows against the
  2026-11-02 text; extended to seventeen rows against the 2026-11-03
  text on 2026-11-03, with the process status vocabulary adopted.
- **Step 3 — Correction plan ordered by risk: [COMPLETION](COMPLETION.md).**
  Identity and sign-in safety first, then owner authority, then
  capability completeness, then legibility — the order the completion
  schedule's remainder already follows.
- **Step 4 — Correct in place: the standing pattern.** Corrections land
  as ordinary pull requests at green exact-head checks (PRs #292–#301
  are the worked examples); the server keeps serving throughout.
- **Step 5 — Live proof and close-out:** rows close only on live
  evidence at the checked release. Rows 2, 5, and 9 closed that way;
  no other row has been closed by paperwork.

**Watch duty accepted:** when the Standard gains a section, a row opens
here in the next correction pass, dispositioned like any other; the
census re-runs on row 15's triggers. **Closing proof for this row:**
every row in this record conforms or carries a ruled exception, with
its live proof filed. Process status: **correctable**.

### 17. Owner-obedience — confirmed action in place of hard blocks — CORRECTABLE

The Standard (2026-11-03): on the owner's own connection, a dangerous
action is never refused for the action's own sake; the confirmed-action
pattern (evaluate, disclose, fingerprint, confirm by naming the
fingerprint, re-check, journal, verify) replaces the refusal. Aim
checks are not vetoes and stay hard. Three boundaries can never be
converted: the tenant wall, secret values never shown back, and the
platform's own rules reported as the platform's. Every refusal point
in the server must be inventoried and classified in this record as an
aim check, a convertible veto, a non-convertible boundary, or a
platform rule.

**Classification filed 2026-11-03.** A source census swept all 233
runtime files under `src/` and `api/` (28,814 lines; 1,851 candidate
refusal lines triaged) and grouped them into **47 mechanisms: 36 aim
checks, 4 non-convertible boundaries, 3 platform rules, and 4
convertible vetoes.** The appendix below is the classification of
record. Spotlight dispositions, checked in full:

- Money-out exact owner approval, the shared daily cap with its second
  override, and delegated pass money ceilings are **aim checks**: they
  bind AI and delegate callers, the owner is the approver, the cap is
  the owner's own setting with owner routes around it, and the flow
  already implements the confirmed-action shape. They do not convert.
- The administrator passphrase lockout is an **aim check** (identity
  proof under brute-force attack), kept hard.
- The `read_only` profile write refusal and the RTC pass scope
  refusals are **plan-binding on grants as issued**; they bind
  delegates and chosen profiles, not the owner's full connection.
- The developer-context LIVE wall is a **non-convertible boundary**:
  converting it would let a developer grant mint LIVE customer
  authority, widening someone else's authority — the one thing the
  pattern never does.

**The four convertible vetoes** — the complete set found where the
owner's own connection is hard-refused for the action's own sake.
Each conversion is an implementation card under normal discipline;
this document converts nothing. Conversion order: V1 first (it gates
all LIVE work and its ceremony already exists), then V2 family by
family, most destructive first, with the money families' own approval
gates (appendix rows 20–22) untouched by the mode conversion; then
V3, then V4.

- **V1 — LIVE enablement environment-flag stop** (`src/stripe/setup-page.js`).
  After passphrase, account-specific consent, a 10-minute intent, and a
  verified LIVE key, `enable-live` still refuses unless the deployment
  setting `LIVE_MODE_OWNER_APPROVED` is `true`. Conversion: remove the
  blanket flag as a hard stop; bind the existing ceremony to a
  fingerprint of the evaluated state (account, key last-4, environment,
  intent), re-check at consumption, journal, read back. IN-06's owner
  approval itself is unchanged — what converts is only the additional
  flag that outranks the owner's completed ceremony.
  **Source-implemented 2026-11-03 (OWNER-OBEDIENCE-V1):** the flag is
  removed from both `enable-live` and `add-live-key`; the ceremony is
  bound to `liveEnableFingerprint` of the evaluated state (account,
  credential kind and last four, enabled/connected state, environment,
  intent, expiry); consumption re-checks the expected credential
  atomically and journals the fingerprint; a read-back is required
  before success is reported. IN-06 itself is unchanged and no account
  was enabled. Live proof remains open and closes only at a checked
  release (CAP-5 queue).
- **V2 — LIVE write static allowlists and TEST-only handlers**
  (`src/core/profiles.js` and the legacy write handlers). On the
  owner's full, LIVE-consented connection, whole classes of
  LIVE-supported writes (payments, invoices, billing, checkout, credit
  notes, dispute submission, money tools, report runs, file links,
  customer monetary writes) refuse because they are unreviewed.
  Conversion per family: provider-derived LIVE preview, plain-words
  disclosure, confirmation bound to the preview fingerprint, re-check
  at execution, existing journal and read-back.
- **V3 — Catalog `outsideApp` categorical ban** (`src/tools/catalog.js`).
  The one place the owner's explicit ownership acknowledgment — the
  route the general app-ownership guard accepts — is itself refused.
  Conversion: evaluate the exact product/price and its marker state,
  disclose, fingerprint target + marker + previewed change, owner
  confirms the fingerprint, re-check the marker at apply, journal,
  read back. The refusal of a write whose ownership is *unclear* stays
  an aim check.
- **V4 — Pass/revoke preparation gate** (`src/tools/server.js`). The
  read-only preparation tools for pass issuance and connection
  revocation demand a full TEST connection although the owner page
  completes both in LIVE. Conversion: allow preparation on the owner's
  full connection in either mode; the consequential step stays on the
  passphrase-authenticated owner page.

**Unclassified items — recorded as defects, not silently labeled:**
(1) a family of read tools refuses LIVE connections although Stripe
serves the same data in LIVE (money/bank/report reads and others) —
reads should simply obey, so the remedy is engineering (per-reader
mode review), owned by CAP-4's gap derivation; (2) universal-door
non-money operations the classifier cannot yet classify — the
classification engineering is owed, owned by CAP-4; (3) the CAP-3
tenancy/vault code is unreachable from any door, so it has no live
refusal point to classify — a census pass is owed when CAP-3 wires it
to a door; (4) two money-surface wording/eligibility ambiguities on
the owner setup page (a "TEST request" refusal text over a mode-general
layer; a money-limit flow staged for "TEST-connected" accounts while
the cap governs LIVE too) — verify, then correct the wording or the
eligibility.

**Closing proof:** each conversion live at a checked release, proven
on the owner's own connection (the action completes after fingerprint
confirmation and is refused, with a fresh disclosure, when the
fingerprint has moved); the row closes when all four conversions are
live-proven and the four unclassified items are classified or
engineered away. Process status: **correctable**.

#### Appendix to row 17 — refusal-point classification (2026-11-03)

Condensed from the source census; sites are the primary enforcement
files at baseline `92cdf0c7`. Mechanism numbering is the census's.

| # | Mechanism | Primary sites | Classification |
|---|---|---|---|
| 1 | Bearer-token identity (missing/expired/revoked → 401) | `src/core/mcp-auth.js` | aim check |
| 2 | OAuth authorize-request validation (incl. sent `resource` must name this MCP) | `src/core/oauth-handlers.js` | aim check |
| 3 | Dynamic client registration metadata bounds | `src/core/oauth-handlers.js` | aim check |
| 4 | CIMD client-card identity (SSRF-bounded fetch; secret-holding cards refused) | `src/core/cimd.js` | aim check |
| 5 | Authorization-code redemption (expiry, single use, PKCE match) | `src/core/oauth-handlers.js` | aim check |
| 6 | Refresh-token lifecycle (rotation; reuse refused) | `src/core/oauth-handlers.js`, `src/db.js` | aim check |
| 7 | Revocation endpoint ownership (a client revokes only its own tokens) | `src/core/oauth-revocation.js` | non-convertible boundary (client wall) |
| 8 | Administrator passphrase + IP lockout (5 failures / 15 min) | `src/core/oauth.js`, `src/stripe/setup-page.js` | aim check |
| 9 | Owner setup-page transport guards (origin, CSRF, body limits) | `src/stripe/setup-page.js`, `src/core/http.js` | aim check |
| 10 | Owner-action intents (10-minute, consent + passphrase per action) | `src/stripe/setup-page.js` | aim check (confirmed-action shape already) |
| 11 | Developer handoff identity | `src/developer/handoff.js` | aim check |
| 12 | Developer-context LIVE wall | `src/developer/access.js`, `src/core/mcp-auth.js` | non-convertible boundary (principal-class wall) |
| 13 | Profile grant scope and default-deny dispatch (incl. `read_only` write refusal) | `src/core/profiles.js`, `src/core/mcp-server.js`, `src/tools/meta.js` | aim check (plan-binding) |
| 14 | RTC pass authentication state | `src/core/rtc-http.js`, `src/db.js` | aim check |
| 15 | RTC pass scope (areas, profile, ceiling, rate limit) | `src/core/rtc-http.js`, `src/core/rtc-passes.js` | aim check (plan-binding) |
| 16 | Result-handle scope (foreign handle indistinguishable from missing) | `src/tools/server.js`, `src/core/rtc-http.js` | non-convertible boundary (tenant wall) |
| 17 | RTC pass issuance policy (validated grant terms; credential shown once) | `src/core/rtc-passes.js`, `src/stripe/setup-page.js` | aim check |
| 18 | Guarded write lifecycle prerequisites (preview, confirm, idempotency key, journal) | `src/core/write.js` | aim check |
| 19 | Write read-back verification (unverifiable outcome is never reported done) | `src/core/write.js` | aim check |
| 20 | Money-out exact owner approval | `src/money.js`, `src/db.js`, `src/stripe/setup-page.js` | aim check (confirmed-action shape already) |
| 21 | Shared daily money cap + second owner override | `src/db.js`, `src/stripe/setup-page.js` | aim check |
| 22 | Delegated pass money ceiling | `src/db.js` | aim check (plan-binding) |
| 23 | Non-USD money-out (no verified conversion policy) | `src/money.js`, `src/db.js` | aim check (re-examine if a conversion policy is built) |
| 24 | LIVE activation state at every door | `src/core/mcp-auth.js`, `src/stripe/provider.js`, `src/tools/live-guard.js` | aim check |
| 25 | LIVE credential enrollment verification | `src/keys.js`, `src/stripe/setup-page.js` | aim check |
| 26 | IN-06 LIVE enablement environment-flag stop | `src/stripe/setup-page.js` | **convertible veto — V1** |
| 27 | LIVE write consent gate (consent carried on the grant) | `src/tools/live-guard.js` | aim check (plan-binding) |
| 28 | LIVE write static allowlists + TEST-only handlers for real operations | `src/core/profiles.js`, `src/tools/*-writes.js` | **convertible veto — V2** |
| 29 | Intrinsically TEST-only operations (fixtures, test clocks, synthetic events) | `src/dev/`, `src/tools/dev-*.js`, `src/tools/testclocks.js` | platform rule |
| 30 | App-ownership guard (general; `outsideApp` acknowledgment is the owner route) | `src/tools/app-guard.js` | aim check |
| 31 | Catalog `outsideApp` categorical ban | `src/tools/catalog.js` | **convertible veto — V3** |
| 32 | Portal ownership-unproven refusal | `src/tools/brand-account.js` | aim check (re-examine if an ownership proof is built) |
| 33 | App-owned customer metadata namespace | `src/tools/customer-writes.js` | aim check |
| 34 | Undo restrictions (proven exact inverse only) | `src/tools/undo.js` | aim check |
| 35 | Universal-door financial classification | `src/stripe/universal-policy.js`, `src/tools/universal.js` | aim check (amount proof) |
| 36 | Secret values never shown back (one-time reveal only) | `src/core/one-time-secrets.js`, `src/tools/util.js` | non-convertible boundary |
| 37 | Stripe's own answers reported as Stripe's | `src/keys.js`, `src/tools/errors.js`, `src/stripe/client.js` | platform rule |
| 38 | Client construction mode proof (key mode must match requested mode) | `src/stripe/client.js` | aim check |
| 39 | Account identity and mode verification | `src/stripe/test-account.js`, `src/tools/account-mode.js` | aim check |
| 40 | TEST webhook signature and provisioning | `src/webhooks/test-receiver.js`, `src/webhooks/signature-store.js` | aim check |
| 41 | Developer fixture run ownership | `src/tools/dev-cleanup.js`, `src/dev/cleanup.js` | aim check |
| 42 | Developer forwarder destination rules (SSRF-class destination proof) | `src/dev/forwarder-security.js` | aim check |
| 43 | App-profile, brand-kit, and metered revision binding | `src/tools/app-profiles.js`, `src/brand/store.js`, `src/metered/store.js` | aim check (plan-binding) |
| 44 | Guided Dashboard-only settings (no Stripe API exists) | `src/tools/admin-guided.js` | platform rule |
| 45 | Transport and per-tool input-validation family | `src/core/http.js`, `src/tools/result-rules.js`, tool files | aim check |
| 46 | Pass/revoke preparation gate (full TEST connection demanded) | `src/tools/server.js` | **convertible veto — V4** |
| 47 | Acceptance harness gates (operator test scripts; not a product door) | `src/acceptance/` | aim check |

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

> **Historical scope note:** this section describes the original
> 2026-11-02 plans-only pass. Later dated row updates and the 2026-11-03
> completion reconciliation supersede its “no acceptance row is passed”
> wording for rows 2, 5, and 9 and for the row 3 journey. It remains
> accurate that the original pass itself made none of those changes.

- No code, schema, deployment, DNS, Stripe App, key or LIVE change.
- No D-005 registry claim filed (row 7 records the planned claim only).
- No implementation subsection is marked complete, and no acceptance row
  is passed: CAP-1..CAP-5 and the protected acceptance queue are
  untouched. The conformance rows above close only through their own
  cards and live acceptance.
- The branded cutover remains behind its existing gates in
  [STRIPE-BRAND-DOMAIN](designs/STRIPE-BRAND-DOMAIN.md); nothing here
  attaches the domain or moves the issuer.
