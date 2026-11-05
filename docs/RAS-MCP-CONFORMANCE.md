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
| 15. Capability completeness | correctable — PARTIAL under the 2026-11-04 grading amendment; re-census filed (element 1 dispositioned: 341 covered / 2 composed / 61 missing / 3 missing-in-LIVE / 8 unverified of 415 operations; elements 2–4 and the front-door census line still owed) |
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

**Re-census under the capability-completeness grading amendment —
REOPENED and re-issued, 2026-11-04.** The Standard's
capability-completeness grading amendment (Library D-001, landed
2026-11-04 by Library PR #5) reopened this row, and the fleet
re-census re-ran element (1) two-source under the Critic Step 0
pattern: a service-first map built only from Stripe's official API
reference (104 object rows, 415 operations, 13 principal workflows;
sha256
`e55b6399b355190233f8c3ea72246cd296645ef23f452f765694b15a352dc81b`),
and a server inventory built only from this repository's code at
main `2688228f` (329 registered tools, counted by executing the
registry; sha256
`e2f7d58c6415bef630bc06e3f5aaf30077a20543138aff9d586368747a60a93b`),
reconciled by a separate pass that spot-checked six map rows
against the reference where they decided dispositions. The full
reconciliation record is held with the fleet audit's re-census
files (2026-11-04); its counts stand beside the grade here, as
the amendment requires:

| Disposition | Operations |
|---|---|
| COVERED — native tool | 200 |
| COVERED — universal door (`api_read` / `api_write`) | 141 |
| COMPOSED | 2 |
| OWNER-EXCLUDED | 0 (no recorded ruling excludes a mapped operation) |
| MISSING | 61 |
| MISSING in LIVE (covered in TEST only; counts as missing) | 3 |
| UNVERIFIED | 8 |
| **Total mapped** | **415** |

**Re-issued grade: correctable — PARTIAL under the amendment,
capped.** Element (1) (the provider's full reachable surface,
every item dispositioned) is discharged by the reconciliation.
The grade cannot read *conforms* while 61 MISSING and 3
MISSING-in-LIVE operations stand, and missing-with-plan counts as
missing until the work lands. Elements (2)–(4) stand as written
above, narrowed on the record: the beside-API surfaces the map
found (Apps secrets, Financial Connections, Identity) carry
dispositions in the reconciliation; the server-side substrate —
this server's own registration records — is dispositioned there
in its own section; the 13 principal workflows now carry
through-server step counts with two COMPOSITION-OWED flags
(manual invoicing, W8; metered-billing setup, W12); and the live
consumer test remains CAP-5's, as the completion schedule
states.

**The headline absence is on this server's own records, not
Stripe's: enrollment has no exit.** No operation removes an
enrolled Stripe account or an enrolled key, and no operation
edits or deletes a registered OAuth client — the same
create-without-delete class the fleet re-census found first in
Workspace Unleashed by Robinson AI Systems and in Neon
Unleashed by Robinson AI Systems. Two build cards are filed
with this change:
[CAP4-RECENSUS-1-ACCOUNT-DEENROLL](pr-cards/CAP4-RECENSUS-1-ACCOUNT-DEENROLL.md)
and
[CAP4-RECENSUS-2-OAUTH-CLIENT-DELETE](pr-cards/CAP4-RECENSUS-2-OAUTH-CLIENT-DELETE.md).
Every other MISSING item stands in the reconciliation's
missing-with-plan register: the Connect lifecycle writes (14
operations) already ride CAP-4 Phase 2 in the completion
schedule; the rest carry cards TO-BE-FILED by this crew in its
own sequence.

Row 17 is not reopened by this re-census: its four convertible
vetoes are owner-ruled conversion work, not completeness
absences. Where the same facts appear in the reconciliation as
MISSING-in-LIVE postures, they are counted as absences there
until the conversions land — the amendment's counting rule, not
a second verdict on row 17.

**Next step:** unchanged for elements (2)–(4) (census addendum
with CAP-4's final card; consumer test under CAP-5), plus the
two RECENSUS cards above in the CAP-4 sequence. **Closing
proof:** unchanged, plus the reconciliation's missing-with-plan
register emptied or carrying ruled exceptions. Process status:
**correctable (PARTIAL under the 2026-11-04 grading amendment)**.

**Register update — CAP4-RECENSUS-1-ACCOUNT-DEENROLL landed
(2026-11-04).** The enrolled-account de-enrollment item in
this row's missing-with-plan register **stops counting as
missing in this change**: the delete leg now exists at the
merged head — a prepare-only registry tool
(`stripe_deenroll_account`, full-profile only; registry
343 → 344) that evaluates the exact account and removes
nothing, and an owner-page `request-deenroll` →
`confirm-deenroll` intent pair (10-minute expiry;
fingerprint computed fresh from the evaluated state —
account id and label, credential kinds and last4s present,
LIVE enabled/connected state, default-account state, and
the counts of live tokens and passes — and re-checked
atomically at consumption) whose single-statement removal
revokes every token and pass for the account, deletes the
dependent records and the `stripe_accounts` row with its
stored key material, and journals the removal as
IRREVERSIBLE with the fingerprint (no inverse;
`stripe_undo_change` refuses by its existing rule). Guards
refuse while LIVE is enabled, while the account is the
default, and while a money reservation is unsettled. The
companion item — OAuth client delete,
CAP4-RECENSUS-2-OAUTH-CLIENT-DELETE — remains in the
register as missing-with-plan. CAP-5 obligation recorded
on the card: enroll a throwaway TEST account, de-enroll
it, read back its absence, on the owner's own connection.

**Register update — CAP4-RECENSUS-2-OAUTH-CLIENT-DELETE landed
(2026-11-04).** The OAuth client delete item in this row's
missing-with-plan register **stops counting as missing in
this change**: the delete leg now exists at the merged head —
owner visibility on the passphrase-authenticated setup page
(registered clients listed with client id, name, auth method,
registration time, and live token/pass counts; no registry
tool added, registry unchanged at 344) and an owner-page
`request-delete-client` → `confirm-delete-client` intent pair
(10-minute expiry; fingerprint computed fresh from the
evaluated state — client id, name, auth method, and the exact
counts of live tokens and passes — and re-checked atomically
at consumption) whose single-statement deletion revokes every
token and pass issued to the client across every account,
deletes its outstanding authorization codes, deletes the
`oauth_clients` row, and journals the deletion as
IRREVERSIBLE with the fingerprint (no inverse and no owning
account; `stripe_undo_change` refuses by its existing rule).
Authorization attempts naming a deleted client refuse at both
OAuth doors. **The companion update leg is dispositioned in
the same change:** deliberately deferred with its reason
recorded on the card — no consumer has needed to edit a
registration, and name/auth-method changes are served by
delete-and-re-register now that the delete leg exists; an
RFC 7592 read/update endpoint is its own future card. Its
disposition in this register therefore reads **recorded
deferral**, not missing. CAP-5 obligation recorded on the
card: register a throwaway client, delete it through the
ceremony, read back its absence, on the owner's own
connection.

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
  **Progress 2026-11-03:** the shared machinery is
  source-implemented (OWNER-OBEDIENCE-V2-SHARED), and family 1 of
  13, **Money**, is source-implemented in its admission and
  handlers (OWNER-OBEDIENCE-V2-MONEY): the money area is admitted
  on the owner's full LIVE connection with ruling 1(b)'s
  owner-identity funding (passes unchanged), the TEST-only handler
  gates are mode-parameterized, and `setup_set_payout_schedule`
  converted with the family; top-ups stay synthetic by ruling.
  The one blocker recorded on that card — the money reservation
  SQL bound a non-pass approval to TEST mode, so LIVE payout
  creation and reversal could not complete — was ruled and fixed
  the same day (follow-up commit): the reservation now binds a
  non-pass approval's mode to the mode stored on the connection's
  own token row, and the family is fully source-implemented,
  execution leg included. Family 2 of 13, **Disputes**, is
  source-implemented the same day (OWNER-OBEDIENCE-V2-DISPUTES):
  the three handler gates (submit evidence, accept, save
  evidence) are removed, every dispute/charge/file/read-back
  invariant is mode-parameterized, submission and acceptance
  previews disclose finality and the full concession plus the
  dispute fee in both modes, and dispute acceptance's money-out
  wiring (rows 20–21) is untouched and proven unrelaxed in
  LIVE. Family 3 of 13, **Payments & refunds**, is
  source-implemented the same day
  (OWNER-OBEDIENCE-V2-PAYMENTS): the TEST-mode wrapper gate is
  removed from all nine payment write operations, every target
  and read-back invariant demands the connection's own mode in
  both directions, previews disclose in plain words what will
  happen to the customer's card (including the refund amount
  and its destination), and the refund's money-out wiring
  (rows 20–21) plus the app-owned-target guard and its refund
  exception are untouched and proven unrelaxed in LIVE.
  Family 4 of 13, **Invoices & credit notes**, is
  source-implemented the same day
  (OWNER-OBEDIENCE-V2-INVOICES): this family was refused at
  the dispatcher in **both** modes (the `invoices` area was in
  neither guarded set), so the conversion admits the area in
  `guardedTestAreas` and `guardedLiveAreas` as well as
  converting the handlers — TEST reachability is itself new.
  All fourteen operations (draft create/update and line
  add/update/remove, lifecycle delete/finalize/send/charge/
  record-external-payment/void/mark-uncollectible, and credit
  note create/void) complete the confirmed-action sequence in
  the connection's mode; every evaluated object and read-back
  demands that mode; previews are mode-labeled and, in LIVE,
  sending discloses that Stripe emails the real customer and
  opens real collection. The credit note's money-out wiring
  (rows 20–21) is untouched and proven unrelaxed in LIVE:
  confirm alone moves nothing, and the exact owner approval
  executes exactly once against the shared daily cap.
  Family 5 of 13, **Billing**, is source-implemented the same
  day (OWNER-OBEDIENCE-V2-BILLING): no dispatcher change (the
  billing area was already a guarded LIVE area); the TEST-only
  wrapper gates are removed from all fourteen subscription,
  item and schedule writes; every evaluated object and
  read-back demands the connection's mode in both directions;
  the shared subscription projections verify a discount only
  in its own mode (the unverified sentinel, never a zero);
  previews are mode-labeled and disclose the first charge,
  exact proration and period-end cancellation effects; and
  `billing_change_plan`'s money wiring (rows 20–21) is
  untouched and proven unrelaxed in LIVE — confirm alone
  moves nothing, and the exact owner approval executes
  exactly once against the shared daily cap. The customer
  balance credit/debit item is not part of V2 (ruling 3:
  separate row-35 card). Remaining families:
  Checkout;
  Family 6 of 13, **Checkout, payment links and portal
  sessions**, is source-implemented 2026-11-04
  (OWNER-OBEDIENCE-V2-CHECKOUT): the TEST-only wrapper gate
  is removed from all nine hosted write operations (checkout
  payment/setup links, session expiry, payment-link
  create/update/deactivate/activate, portal session create
  and configuration update); two further mode gates inside
  the tools are removed (the `cs_test`-only session-id
  pattern on expiry, and the brand-kit read hardcoded to
  TEST mode); every evaluated object and read-back demands
  the connection's own mode in both directions; and
  summaries are mode-labeled and disclose in plain words
  what a live payment link does and what deactivating one
  does. The hosted-URL aim check is NOT relaxed: a created
  page's URL is surfaced only when it verifies as
  Stripe-hosted. No money wiring is touched: these tools
  create payment surfaces, and any charge flows through
  Stripe's hosted page under the existing contracts.
  Family 7 of 13, **Radar**, is source-implemented 2026-11-04
  (OWNER-OBEDIENCE-V2-RADAR): no dispatcher change (the `risk`
  area was already a guarded LIVE area); the TEST-only handler
  gates are removed from all five writes (review approval,
  value-list creation, empty-list deletion, list-item add and
  remove); a fourth, hidden TEST gate in the shared safe
  projections (`radar-reads.js`) is converted to an optional
  mode argument, so the write preflights and read-backs verify
  records in the connection's own mode while the read tools —
  unchanged, still TEST-only — call them exactly as before;
  every evaluated object and read-back demands the
  connection's mode in both directions; previews are
  mode-labeled and state in plain words that approving a
  review releases the held payment to be captured and settled
  and that a live list change blocks or stops blocking real
  payments; and the family's privacy invariant is preserved —
  raw item values appear in no preview, result or audit
  record. No money wiring is touched: Radar writes move no
  money.
  Family 8 of 13, **Identity**, is source-implemented
  2026-11-04 (OWNER-OBEDIENCE-V2-IDENTITY): the three
  handler gates (create session, cancel session, redact
  session) are removed — cancel and redact stay independent
  operations with separate confirmations — and a fourth,
  hidden gate in the shared safe projection is
  mode-parameterized: a session now verifies only in its own
  mode, while the read tools, which call the projection
  without a mode, keep the historical TEST-only check exactly
  (the reads' LIVE reachability is unclassified item (1),
  owned by CAP-4, and is not claimed here). Every evaluated
  object and read-back demands the connection's mode in both
  directions; the state requirements before cancel and
  redaction are unchanged. The LIVE create preview discloses
  that a real person will be asked to submit identity
  documents to Stripe; the redact preview discloses
  irreversibility, what record is destroyed, and that the
  business's own retention obligations are the owner's to
  judge — disclosed, never vetoed. The safe projection's
  field set is not widened: no `client_secret`, verified
  outputs, report IDs, document links or full metadata
  surface in either mode. No money wiring is touched.
  Family 9 of 13, **Files**, is source-implemented 2026-11-04
  (OWNER-OBEDIENCE-V2-FILES): this family was refused at the
  dispatcher in BOTH modes (the `files` area was in neither
  guarded set), so the area is admitted in TEST and LIVE and
  both operations (evidence import, brand-asset file link)
  complete the full confirmed-action sequence in the
  connection's own mode in tests; three further mode gates
  the census had not enumerated — the evidence import's
  account read and read-back verification, and the shared
  `fileSafe` projection the link preflight uses — are
  mode-parameterized, with the read tools calling the
  projection without a mode and staying TEST-only and
  byte-identical; the import's public-source, type and size
  bounds, the link's brand-asset scope guard, expiry
  requirement and URL-withholding re-verification are
  demonstrably unrelaxed; previews are mode-labeled, the
  link preview states in plain words that anyone with the
  URL can fetch the file until it expires, and the evidence
  preview states the import does not attach or submit a
  dispute (the design card's "names the target dispute"
  wording is flagged in the card for a coordinator ruling:
  the tool takes no dispute argument by design). No money
  wiring is touched: file writes move no money.   Family 10 of 13, **Reports**, is source-implemented
  2026-11-04 (OWNER-OBEDIENCE-V2-REPORTS): the smallest
  family — the `reports` area joins `guardedLiveAreas` for
  exactly the one write, `report_run`, and the handler's
  TEST-only gate is removed; the report type's
  data-available window must be the connection's own mode's
  window, a created run whose present mode disagrees is
  never claimed, and the read-back demands the run's mode
  equal the connection's mode, in both directions. The
  curated type allowlist, the interval bound and the
  availability verification are unrelaxed. The LIVE preview
  states the type, the exact interval and that the output is
  a financial report file whose contents are the account's
  real figures; creation is never reported as completion —
  the result reports the run as requested/pending and
  carries only the verified run ID and status, no report
  contents and no file URL. The report reads keep their own
  TEST gates and are not converted (unclassified item (1),
  owned by CAP-4). No money wiring is touched.
  Family 11 of 13, **Branding**, is source-implemented
  2026-11-04 (OWNER-OBEDIENCE-V2-BRANDING): the `branding`
  area joins `guardedLiveAreas` (the payout schedule's
  exposure in this area already converted with Money,
  ruling 6, and is untouched), the TEST-only account
  verifiers in both modules become mode-aware, and all six
  writes (brand kit save, image upload, Checkout preview,
  invoice template archive/unarchive, portal look) complete
  the confirmed-action sequence in the connection's own
  mode in tests. Two further mode gates are converted: the
  kit store itself refused any non-TEST save — it is keyed
  by account+mode, so LIVE kits are now separate records,
  disclosed in the preview — and the kit's brand-file check
  demands the file's mode equal the connection's. **Row 32
  does not convert:** the portal look's ownership refusal
  (any actively bound app refuses the write even with
  `outsideApp`) is byte-untouched and proven firing in both
  modes; the public-HTTPS validation and the
  owner-configured return-destination match are likewise
  unrelaxed. `brand_preview_checkout`'s write registration
  was confirmed correct at build time: it persists a real
  Checkout session through Family 6's converted write. The
  guided own-account tools and the brand/template reads are
  not writes and stay TEST-only under CAP-4's ownership.
  Family 13 of 13, **Projects** (provider-write half), is
  source-implemented 2026-11-04
  (OWNER-OBEDIENCE-V2-PROJECTS): under coordinator ruling 4
  only the provider-write half converts — the dispatcher
  admits exactly three names (`project_portal_create`,
  `workflow_project_setup`, `workflow_app_readiness_fix`) in
  both modes via an exact name set, the `projects` area
  itself staying out of both area sets, and all three
  complete the confirmed-action sequence in the connection's
  own mode in tests; setup verifies the brand kit and portal
  configurations in the connection's mode, its previews
  state that the recorded draft is not bound and scoped
  ownership is not enabled, and the readiness fix's composed
  native writes inherit their own families' guards. **The
  binding half does not convert:**
  `project_bind_profile_account` and
  `project_enable_scoped_ownership` gain no admission in
  either mode, their module is byte-untouched and their LIVE
  refusals are proven identical — they are referred to the
  owner-surface migration named at
  `src/tools/app-profiles.js:94`. The readiness read keeps
  its TEST-only gate exactly (read reachability is CAP-4's);
  only the fix's internal observation is mode-parameterized.
  With this family the V2 family sequence is complete in
  source; the binding half and all live proof remain open.
  Each family closes only on live proof.
- **V3 — Catalog `outsideApp` categorical ban** (`src/tools/catalog.js`).
  The one place the owner's explicit ownership acknowledgment — the
  route the general app-ownership guard accepts — is itself refused.
  Conversion: evaluate the exact product/price and its marker state,
  disclose, fingerprint target + marker + previewed change, owner
  confirms the fingerprint, re-check the marker at apply, journal,
  read back. The refusal of a write whose ownership is *unclear* stays
  an aim check.
  **Source-implemented 2026-11-04 (OWNER-OBEDIENCE-V3):** the seven
  catalog writes (`product_create`, `product_update`,
  `product_archive`, `product_unarchive`, `product_delete`,
  `price_create`, `price_update`) accept `outsideApp` together with
  an `outsideAppFingerprint`; for a target whose ownership is known,
  the preview names the owning app, the record and the exact change
  and carries the fingerprint, and a confirm proceeds only on the
  fresh fingerprint for the current marker state and change. No-flag
  refusals are unchanged, `outsideApp` on `product_create` is an
  accepted no-op, a marker removed between preview and confirm
  leaves an ordinary write, and unclear ownership still refuses as
  an aim check. One refusal the design map did not enumerate —
  `price_create` refusing reuse of an existing app-owned
  lookup-key price — is left exactly as built and recorded in the
  card as an open point pending a coordinator ruling. With this,
  all four conversions V1–V4 stand source-implemented. Live proof
  remains open and closes only at a checked release (CAP-5 queue,
  against the disposable app-marked catalog product fixture).
- **V4 — Pass/revoke preparation gate** (`src/tools/server.js`). The
  read-only preparation tools for pass issuance and connection
  revocation demand a full TEST connection although the owner page
  completes both in LIVE. Conversion: allow preparation on the owner's
  full connection in either mode; the consequential step stays on the
  passphrase-authenticated owner page.
  **Source-implemented 2026-11-03 (OWNER-OBEDIENCE-V4):** both
  preparation handlers accept the owner's full connection in either
  mode (mode membership replaces the TEST-only condition); profile,
  account/client shape, scope validation, result shapes, and
  side-effect-freeness are unchanged, and issuance/revocation still
  complete only on the owner page. Live proof remains open and
  closes only at a checked release (CAP-5 queue).

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

**CAP-4 progress — D-3 and the A9 half-open interval (2026-11-04):**
unclassified item (1) is being engineered away family by family
under CAP-4. Its first family, **D-3 (invoice, billing and
credit-note reads)**, is source-implemented
(CAP4-D3-INVOICE-BILLING-READS): all 13 swept handlers now verify
every returned object against the connection's own mode in both
directions, on the shared-projection precedent (optional mode;
no-mode callers byte-identical). The D-3 derivation also found —
and this record states plainly — that V2's shared machinery above
had left a **half-open state**: from PR #304's merge until D-3's
merge, the invoice, billing and credit-note read handlers executed
on LIVE connections through the mode-aware seam while their
projections did not verify returned objects' `livemode`, so for
that interval these reads were **neither TEST-only nor converted**
(the derivation's A9 finding). Production never ran the half-open
code: the deployed build predates PR #304, and `main` was not
promoted while the interval stood. The remaining read families
(payments, disputes/events, checkout, reports/files/radar,
account/admin, identity, brand, composites) still refuse LIVE
behind their own gates and convert under their own CAP-4 cards;
item (1) closes when the last of them lands or is dispositioned.

**CAP-4 progress — D-1 money reads (2026-11-04):** the second
family, **D-1 (money reads)**, is source-implemented
(CAP4-D1-MONEY-READS): all 10 money read tools (balance, balance
transactions, payouts, payout transactions, top-ups, bank
accounts, payout schedule) now verify every returned object
against the connection's own mode in both directions, on the
same shared-projection precedent. D-1's baseline differed from
D-3's: the family was never half-open — three TEST-only gates
refused LIVE outright — but it carried no verification in either
direction, so a LIVE object projected without complaint on a
TEST connection, and the automatic-payout proof embedded its own
TEST check (`livemode===true` refused), now parameterized to the
connection's mode with the manual-payout exclusion standing in
both modes. Bank and schedule account verification follows the
connection mode via the verified-account readers, and the
schedule result's hardcoded `mode:'test'` literal now reports
the connection's mode (unchanged on TEST). Live proof for these
reads stands in the CAP-5 queue.

**CAP-4 progress — D-2 payment reads (2026-11-04):** the third
family, **D-2 (payment reads)**, is source-implemented
(CAP4-D2-PAYMENT-READS): all 10 payment read tools (payment
intents, charges, refunds, setup intents — list, get and search
paths alike) now verify every returned object against the
connection's own mode in both directions, on the same
shared-projection precedent. D-2's baseline was refusal-only,
like D-1's: a module-local client guard refused every non-TEST
connection before any provider call, and the four projections
verified nothing, so a LIVE object projected without complaint
on a TEST connection. The family's writes were converted by V2
(PR #310) and are untouched here, as is the money wiring. The
projections' field sets are byte-identical — no field added,
removed or renamed in either mode — so the raw-value privacy
invariant (no client secrets, no card fingerprints in any read
output) holds exactly as before, now proven on LIVE fixtures
too. Live proof for these reads stands in the CAP-5 queue.
**CAP-4 progress — Connect slice 1 reads (2026-11-04):** the
first Phase 2 unit, **Connect slice 1 (connected-account
reads)**, is source-implemented (CAP4-CONNECT-SLICE1-READS)
under ruling 3's credential posture: the platform acts only via
the owner's enrolled connection, and the connected account is
always an explicit exact argument. Seven new native readers
(connected-account list/get, capability list/get, external-
account get, person list/get; registry 322 → 329) verify the
platform actor (identity plus independent mode evidence, both
modes) and every returned object's mode before projecting safe
fields only — connected-account data is third-party data: no
email, tax ID, bank numbers, card fingerprints or person data
enter a result, and persons follow the Identity family's
safe-fields posture with the field set pinned by test. The
remaining Connect slices (lifecycle writes, then
destructive/terminal) are not built and remain exactly as
refused as at baseline — the card's suite pins the universal
door's own classification and exact refusal reason for all 13
pinned write operations. Live proof for slice 1 stands in the
CAP-5 queue on the testing surface only.

**CAP-4 progress — Connect slice 2 lifecycle writes
(2026-11-04):** the second Phase 2 unit, **Connect slice 2
(connected-account lifecycle writes)**, is source-implemented
(CAP4-CONNECT-SLICE-2) under rulings 3 and 5. Eleven new native
write tools (account create/update; person create/update/
delete; external-account create/update/delete — tokenized
attachment only; capability request; account-link and
login-link minting; registry 329 → 340, writes 155 → 166) run
the full guarded write contract on slice 1's foundations: the
platform account is verified as the actor via slice 1's own
verification before any connected-account call, every preview
names the exact connected account and the exact change set,
replay keys return the original result, before-state is
captured and audited, and provider read-backs verify (a
mismatch fails the tool). Persons keep the safe-fields posture
in previews, results and audit records — fields are named,
identity values never surface. The two link tools carry the
recorded minting-exception disposition: Stripe offers no
read-back for a minted link, the tools say so plainly, and the
minted URL appears exactly once, in the confirmed result —
never in a preview, an audit record or a log. Slice 3
(account delete, reject, unreject, v2 close) remains unbuilt;
the universal door is untouched by this slice (the
accounts-row flip is D-9's, landing after). Live proof for
slice 2 stands in the CAP-5 queue as one lifecycle round-trip
on the testing surface only.

**CAP-4 progress — Connect slice 3 terminal operations
(2026-11-04):** the third and last Phase 2 unit, **Connect
slice 3 (connected-account terminal operations)**, is
source-implemented (CAP4-CONNECT-SLICE-3) under rulings 3
and 5. Three new native write tools (account delete; reject,
its `reason` validated against the pinned SDK's seven
accepted values with the exact reason shown in the preview;
unreject; registry 340 → 343, writes 166 → 169) run the full
guarded write contract plus the strongest ceremony the
contract offers — the exact-account confirmation shape:
every call repeats the exact connected-account ID in
`confirmAccount`, and a missing or mismatched repeat, or the
platform account itself offered as the subject, refuses
before any provider call (pinned with provider spies).
Reject and unreject have no direct read-back — the Connect
card's named decision — and verify by state read-back: the
re-read account's projected disabled reason must show, or
no longer show, a rejection, mode-verified; a silent
provider no-op fails the tool as uncertain. Delete verifies
by the deleted marker or the provider's `resource_missing`
for the exact ID, as slice 2's deletes did. The v2 close is
covered-by-design-decision (card fork 4, ruling 3(iv)): it
exists only as `POST /v2/core/accounts/{id}/close` on the v2
core surface, which has no dispatch surface in this server;
it is not built and not routed through the door. **With
slice 3 the Connect family is COMPLETE in source** — every
one of the card's 45 census operations carries its
disposition. The universal door is untouched by this slice
(the accounts-row flip is D-9's, landing after, and now
names slices 1–3). Live proof for slice 3 stands in the
CAP-5 queue as one ceremony refusal on the testing surface
only.

**CAP-4 progress — D-9 the universal door, classified
(2026-11-04):** Phase 3's first unit (CAP4-D9-UNIVERSAL-DOOR):
the universal write door's classifier is now a data table —
215 rows, one per pinned POST/DELETE operation outside the
money class, each naming ownership, cost, secret, read-back
and disposition — machine-checked against the pinned catalog
so an unclassified operation fails the build instead of
receiving a silent generic refusal. 39 rows run generically
under the existing guarded-write contract (Terminal
locations/readers/configurations; billing meter/alert/
feedback configuration; Tax registrations, locations and
settings; Radar value lists and items; a small
payment-method/review set — including two new classified
shapes, item actions verified by expected state and the tax
settings singleton), 122 rows redirect to an owning native
family by name, and the remainder refuse with their true
class reason (session/secret-minting, apps/secrets per row
36, third-party-subject, payload-shape, no-read-back,
device-action, ingestion, money-adjacent). The old generic
refusal is proven absent from every in-scope refusal, and the
92 money rows, the metadata-only route and the whitelist
paths are byte-identical to baseline. The Connect
accounts-row flip lands here: the 13 `v1/accounts` rows (plus
account links) name their slice 1–3 Connect tools instead of
the frozen card's other-unit text; billing meter events stay
refused as an ingestion class, citing E-3's native
idempotent route. The Terminal family is the proof family:
the reader registration code is proven shown-once — it
appears only in the caller's own confirmed call — and absent
from the audit trail, previews and results. This row's
door-coverage accounting is unaffected (the 141 operations
were counted as door-covered; what changed is the truth of
their dispositions). Registry unchanged at 343 tools; the
door's own description and the 19,999-token everyday budget
did not move. Live proof for the door rows (one
generic-allow family plus a refusal sample) stands in the
CAP-5 queue.

**CAP-4 progress — D-4 dispute and event reads (2026-11-04):**
the fourth family, **D-4 (dispute and event reads)**, is
source-implemented (CAP4-D4-DISPUTE-EVENT-READS): all 5 registry
tools (dispute list/get; event list, get and the undelivered
list) now verify every returned object against the connection's
own mode in both directions, on the same shared-projection
precedent. D-4's baseline was refusal-only, like D-1's and
D-2's: handler gates refused every non-TEST connection before
any provider call, and both projections hard-required
`livemode===false`. The projections' shapes are byte-identical
in both modes — dispute projections keep the minimal verified
shape and event projections keep projecting only the embedded
data object's ID and type — so the privacy invariant (no
evidence contents, no customer emails or IPs, no raw event
payloads in any read output) holds exactly as before, now
proven on LIVE fixtures too. The census names the family's
fifth tool `event_list_types`; no such tool exists in the
registry, whose fifth tool is `event_list_undelivered` — naming
drift, recorded in the card; the dispute writes (V2, PR #308)
and the `workflow_dispute_kit_save` composite (D-8's §B) are
untouched, as is the money wiring. Live proof for these reads
stands in the CAP-5 queue.

**CAP-4 progress — D-5 checkout, payment-link and portal reads
(2026-11-04):** the fifth family, **D-5 (checkout reads)**, is
source-implemented (CAP4-D5-CHECKOUT-READS): all 7 registry
tools (checkout session list/get/line items, payment-link
list/get, portal-configuration list/get) now verify every
returned object against the connection's own mode in both
directions, on the same shared-projection precedent. D-5's
baseline was refusal-only at the helper layer — one shared
helper refused every non-TEST connection before any provider
call — and the build also converts an unenumerated mode-shaped
gate the census missed: the session-ID pattern admitted only
`cs_test_` IDs, refusing every LIVE session before any provider
call; it now admits the V2 write-side `cs_(test|live)` pattern
and the returned object is verified. The projections carried no
livemode check at baseline, so the shared helper's default
semantics apply (D-4's `{required:true}` was the deliberate
exception, driven by its projections' historical hard check);
the session's own `mode` field (payment/subscription) is
projected untouched and never gated on. The projections' field
sets are byte-identical in both modes — session reads still
never carry `client_secret`, now proven on LIVE fixtures too.
The census names the family with drifted tool names and claims
an eighth operation (a payment-link line-items read) that does
not exist — drift, recorded in the card; the family's writes
(V2, PR #313), including the hosted-URL aim check, and the
money wiring are untouched. Live proof for these reads stands
in the CAP-5 queue.

**CAP-4 progress — D-6 report, file and Radar reads
(2026-11-04):** the sixth family, **D-6 (report, file and Radar
reads)**, is source-implemented (CAP4-D6-REPORT-FILE-RADAR-READS):
all 12 registry tools (report type list, report run list/get and
the result-file read; file list/get; Radar fraud-warning, review,
value-list and list-item reads) now verify every returned object
against the connection's own mode in both directions. D-6's
baseline differed from its siblings': the family was
half-converted by V2 — `fileSafe` (PR #316) and the Radar
projections (PR #314) were already mode-parameterized, but their
read callers passed no mode — while reports carried a wrapper
gate, a second gate in the result-file module and
per-projection hard-checks. Each projection was parameterized by
its own baseline semantics, per the D-5 lesson: strict for the
run projections (baseline `livemode === false` required),
boolean-present for the report type and result file (baseline
refused only `livemode === true`; the pre-existing result-file
fixture carries no `livemode` and still projects), so the TEST
read set and every refusal text are byte-identical. The build
also converts an unenumerated TEST-hardcoded output — the
report-type list's `scope` literal — and records the frozen
card's radar census drift (three named tools do not exist; the
registry's six Radar reads are the family) and the G-1g owner
CSV download's disposition (TEST-bound substrate, never
returned to MCP, out of scope; the settled CSV disposition is
unchanged). The family's three invariants are proven in both
modes: signed report URLs never appear in any result; Radar
results identify value-list items by ID and type only, with no
raw values in results or audit text; and the file reads'
purpose bounds refuse identically in LIVE. The Radar writes,
file-link write, report-run creation write and the money
wiring are untouched. Live proof for these reads stands in the
CAP-5 queue.

**CAP-4 progress — D-7 account and admin reads (2026-11-04):**
the seventh family, **D-7 (account and admin reads)**, is
source-implemented (CAP4-D7-ACCOUNT-ADMIN-READS) with one leg
flagged. `account_get` and `account_list_capabilities` follow
the connection mode: the account record is proven by the
mode-matched verified reader and its `livemode` strictly
equals the connection mode (the baseline always required an
explicit `livemode===false`, so the TEST read set is
unchanged). The shared admin gate is mode-aware — a connected
account in the connection's own mode, verified — so
`stripe_admin_overview`, `admin_list_requirements`,
`admin_fees_and_billing` and `admin_review_security` derive
every section from the selected connection and report its
actual mode in every payload `mode` field; the census's
admin names are drift (business health, the attention queue
and todos are overview sections and derivations, not tools).
The fees projection's categorical 'LIVE balance data is not
allowed' refusal is replaced by the standard wrong-mode
refusal under default semantics (the baseline accepted a
TEST row with `livemode` false or absent). Every mode-naming
refusal or note substitutes the connection's mode word, so
TEST outputs are byte-identical. The guided settings tools
share the admin gate: under the coordinator's ruling their
gate follows, the guided list payload reports the connection
mode, and D-12 still owns that family's full conversion.
**Flagged:** `stripe_check_key_permissions` remains TEST-only
— persisting a LIVE probe result requires a `src/db.js`
decision (`updateKeyPermissions` matches only `test_key_enc`
and writes the single shared `key_permissions` columns), so
the leg is stopped for a coordinator ruling rather than
improvised; baseline pins prove a LIVE connection refuses and
the probe is never invoked (no cross-mode fallback), and the
security review's probe re-validation is already mode-aware.
Live proof for these reads stands in the CAP-5 queue,
including the LIVE admin-surface rows; the probe's LIVE row
also waits on the flagged conversion.

**CAP-4 progress — D-11 Identity reads (2026-11-04):** the
eighth family, **D-11 (Identity reads)**, is
source-implemented (CAP4-D11-IDENTITY-READS): both registry
tools (`identity_list_sessions`, `identity_get_session`) now
verify every returned session against the connection's own
mode in both directions. The conversion is the smallest in
the series — the projection `identitySafe(v, mode)` was
already mode-parameterized by the V2 Identity family
(PR #315) and its write callers already passed the connection
mode; the build deletes the two handler gates that refused
every non-TEST connection before any provider call and passes
the connection mode at both read call sites, leaving the
projection itself byte-untouched. The family's defining
discipline holds: the field set is frozen — exactly `id`,
`type`, `status`, `createdAt`, `redactionStatus`,
`actionRequired`, `note` — verification state and verified
metadata only, with no document images, personal data,
`client_secret`, verification-report IDs or hosted URL in
either mode, pinned by an exact-keys test with sentinel
document/PII/secret fixture values. The hunt for unenumerated
gates came up empty, each species recorded in the card (the
`vs_` ID pattern carries no mode segment; no output is
TEST-hardcoded; no other caller omits the mode; no
store-layer refusal exists on either path). The 2
verification-report GETs are deliberately not claimed — no
native read tool exists and they stay door-served. The V2
disclosure is unchanged: redaction is irreversible and is
not complete erasure. Identity writes and the money wiring
are untouched. Live proof for these reads stands in the
CAP-5 queue.

**CAP-4 progress — D-12 brand reads and guided tools (2026-11-04):**
the ninth family, **D-12 (brand reads and guided tools)**, is
source-implemented (CAP4-D12-BRAND-READS-GUIDED): all 9
registry tools now serve the connection's own mode by
adopting the either-mode twins the V2 Branding family built
for its writes (`selectedEitherMode`, `modeAccount`,
`verifiedMode`) — the conversion the V2 card expressly left
to CAP-4. The six guided tools return Dashboard steps and a
read-back verification (they do not write; the owner
performs the change): their guidance text is mode-templated
so the steps name the mode the owner is actually working
in, the read-back verifies against the mode-verified
account, the payload `mode` reports the connection mode,
and the manual settings URL is mode-templated (an
unenumerated mode-shaped URL the build found in the
guidance payload). The invoice-template reads verify
provider mode evidence with default semantics fitted to
the baseline read set, and `brand_get` reads the kit
revision from the connection's own mode partition. TEST
payloads stay byte-identical except one named refusal
correction: an unselected account no longer refuses with
text asserting TEST as a requirement. No branding write
handler was modified. Under the D-7 ruling's annex, this
family also discharges the admin guided tools' remainder:
`admin_check_setting`'s description names the connection
mode, the remaining TEST-shaped text in `admin-guided.js`
is resolved, and the check-setting observed flow is pinned
end-to-end in both modes. Live proof for these reads and
guidance rows stands in the CAP-5 queue.

**CAP-4 progress — D-8 §A workflow read composites (2026-11-04):**
the tenth family, **D-8 §A (workflow read composites)**, is
source-implemented (CAP4-D8-WORKFLOW-READ-COMPOSITES): all
nine registered `writes: false` workflow composites now
serve the connection's own mode, closing Phase 1's read
sequence. The build takes the frozen card's split route
under its preservation clause: `verifyContext` in
`workflow-read-common.js` stays byte-identical because
every write composite enters through `writable()`, which
calls it before any composed read — the read composites
opt into a new `verifyModeContext` via the shared
plumbing's opt-in verifier option, and the shared read
phases inside write-owned modules keep legacy defaults for
their write callers. Result stamps follow the connection
mode with no re-stamping of any existing record; the
go-live checklist's internal TEST-matrix plus LIVE-sentinel
contract is preserved, so its LIVE behavior is an honest
degradation, never a fabricated matrix; the dispute kit's
agreement link remains TEST-gated with the Projects reads
(coordinator ruling 4) and surfaces on LIVE as a recorded
gap. §B (`workflow_dispute_kit_save`) remains the
immediate sibling unit. Live proof for the composite rows
stands in the CAP-5 queue.

**CAP-4 progress — D-8 §B dispute-kit save (2026-11-04):**
the eleventh family, **D-8 §B (workflow dispute-kit save)**,
is source-implemented (CAP4-D8B-DISPUTE-KIT-SAVE), completing
D-8 and the Phase 1 read+workflow scope. The one write
composite §A held out follows the connection mode under the
V2 write idiom, taking the same split route as §A one level
up: a new `writableMode` sits beside a byte-identical
`writable` (the mode-aware context verifier and the
connection's mode word over the same profile and
audit-database checks), the save's examination is §A's
converted `examine()` with the mode-aware verifier, and the
guarded native writer — already mode-converted in V2 — is
untouched, as are the other five write composites. On TEST
the behavior is byte-identical; a wrong-mode dispute refuses
in either direction with nothing persisted. The save
persists no local record: its persistence is the native
writer's mode-partitioned Stripe draft, never re-stamped.
The app-agreement link stays TEST-gated (ruling 4); on
LIVE its recorded gap is carried on the saved kit and
checklist without blocking staging, while every other gap
still blocks and TEST refuses on a failed link exactly as
at baseline. Live proof for the save's LIVE row stands in
the CAP-5 queue.

**CAP-4 progress — D7b key-permission probe per mode (2026-11-04):**
the twelfth family, **D7b (the key-permission probe, per
mode)**, is source-implemented (CAP4-D7B-KEY-PROBE-PER-MODE),
closing the leg D-7 flagged and the coordinator split into
its own schema-bearing card. The probe's stored record is
split per mode: the baseline `key_permissions`/
`key_checked_at` columns are the TEST record by construction
(their only writers were TEST-matched), and new additive
`live_key_permissions`/`live_key_checked_at` columns start
never-probed — no data movement, added in `initSchema` the
repo's additive way. `db.updateKeyPermissions` takes a mode
(its TEST branch is the baseline statement verbatim; the
LIVE branch matches `live_key_enc` under the `live_enabled`
gate), the reprobe service verifies provider identity and
persists in the connection's mode with the key store's LIVE
production gate intact, the handler serves either mode with
the both-modes refusal text D-7 deferred, and
`stripe_whoami` reports the connection mode's own stored
record (`keyPermissions`/`keyCheckedAt`, nulls when never
probed — never the other mode's). `admin_review_security`
is untouched; its LIVE probe section now observes. The
card records one premise correction: baseline whoami
surfaced no probe fields at all — the mode-blindness lived
in the shared record, and both halves are fixed. Live
proof for the probe's LIVE row stands in the CAP-5 queue;
the db-suite persistence and legacy-migration proof rides
exact-head CI (no local PostgreSQL on the coordinator VM).

**CAP-4 progress — PROD-PAYMENT payment-area coverage
completion (2026-11-04):** Phase 4's first product-gap card
(CAP4-PROD-PAYMENT) closes the payment area by verification
and disposition; no native tool is built and the registry
stays at 343 tools. The four operations the census left
with no native read and no D-card claim are dispositioned:
`payment_records` list/get take native coverage
deliberately out — third-party subject, no consuming
workflow — closing the family as a unit with D-9's
refused-third-party write rows under one reason, on this
record's own financial-connections precedent; the guarded
universal read serves both GETs (single reads
mode-verified; list items are not individually
mode-verified at the door, the recorded limitation those
precedent rows share). The `mandates` GET is
door-sufficient: the pinned catalog holds no mandate list
operation, so the door's per-object mode verification is
complete for the family, proven in both modes and both
wrong-mode directions. The `confirmation_tokens` GET takes
no native read — the pinned object is an ephemeral,
client-issued pre-confirmation snapshot whose field groups
are payment detail (full payment-method preview incl.
card fingerprint), billing/shipping PII and customer
acceptance network data (IP, user agent), with no
consuming workflow — and the enumeration proved the door
served it at baseline: the read screen's sensitive-family
pattern names `tokens`, but the underscore in
`confirmation_tokens` is a word character, so no word
boundary precedes `tokens` and the screen never fired; at
`detail:'full'` the door returned the whole payload under
credential redaction only. The screen now names the family
explicitly and refuses before any provider call; no other
family's screen behavior changes. The area sweep re-ran at
the unit's baseline: 69 pinned operations across the
eleven payment families, zero unclassified (native 28,
door 16, D-9 10, row-35 money 14, out 1), reconciling with
the census appendix. A disposition-verification row (the
deployed refusal plus the two door reads) stands in the
CAP-5 queue; the dispositioned rows join this record's
addendum accounting through this passage.

**CAP-4 progress — PROD-BILLING billing-area coverage
completion (2026-11-04):** Phase 4's second product-gap
card (CAP4-PROD-BILLING) closes the billing area by
decision and disposition; no native tool is built, no
source file changes, and the registry stays at 343 tools.
The four claimed v2 billing meter-event operations take
disposition (a) — unserved until a v2 dispatch surface is
commissioned as its own unit — on recorded evidence: the
pinned catalog holds zero `/v2/` operations, so no
existing surface can dispatch them; the usage-ingestion
consumer is already served natively in v1 by E-3's
`meter_record_usage` with its durable identifier ledger;
no unit, design or roadmap entry commissions a v2
dispatch surface; and ruling 3(iv) records the same
answer for every v2 row (the Connect slices applied it
identically). The card adopts D-9's ingestion rule
verbatim — meter-event ingestion has no meaningful
per-call read-back and its idempotency is by the event's
own identifier, not by request — so the v1 and v2
surfaces state one rule and the two cards' coordination
point closes without divergence. On reads: meter reads
are natively covered in full and the alert list is
native (E-3's catalog-metered module, which D-3's
billing-shared seam sweep never reached); the remaining
billing-family GETs — alert by id, credit grant by id,
credit balance summary and transactions, feedback
options, and the undecided by-id/list GETs in the
invoice, quote and subscription families — are
door-sufficient, pinned through the real read handler
(by-id reads refuse a wrong-mode object in both
directions; list reads carry the door's recorded
limitation); the quote PDF GET is native by E-4's design
(the authenticated link route — the binary is not a JSON
door read). The area sweep re-ran at the unit's
baseline: 101 operations examined (97 pinned v1 + the 4
claimed v2), zero unclassified (native 60, door 15,
D-9 15, row-35 money 7, out 4), reconciling with the
census appendix per path. A disposition-verification
row (the door GETs on the owner's connection; the v2
paths still undispatched) stands in the CAP-5 queue;
the dispositioned rows join this record's addendum
accounting through this passage.

**CAP-4 progress — PROD-EVENTS event-area coverage
completion (2026-11-04):** Phase 4's third product-gap
card (CAP4-PROD-EVENTS) closes the event area by
recorded disposition; no native tool is built, no
source file changes, and the registry stays at 343
tools. All 10 claimed v2 rows — the two
`GET /v2/core/events` reads and the eight
`event_destinations` operations (list, get, create,
update, delete, disable, enable, ping) — take the
fleet's settled v2 answer: unserved until a v2 dispatch
surface is commissioned as its own unit, inherited per
the frozen card's fork text and ruling 3(iv) (the
product cards inherit the Connect answer unless a card
names a reason it differs; none is named here). The
inheritance was re-proven at this baseline, not
copied from PROD-BILLING: the pinned catalog was
re-derived by the same pin method (559 operations,
zero `/v2/` paths; the door's request builder accepts
only `/v1/` paths, and the only `rawRequest` caller is
the door itself, bound to catalog records), and the
card's named reopening condition was searched for
directly — a tree-wide search across designs, roadmap,
the work index, workflows and the webhook family finds
no consumer that needs event destinations
specifically; the rows exist only in census records.
The reopening condition is recorded in the card's own
terms: the v2 dispatch decision, or a consumer that
needs event destinations specifically. The card also
records the standing build posture the rows inherit if
ever built — destinations as webhook-class
infrastructure under the native webhook family's
contracts (the signing secret shown once via the
one-time route, never journaled, this record's row 36
boundary; the full write contract, as `webhook_create`
already carries it) and v2 event reads under the D-4
idiom (minimal identity projection; the event payload
posture does not widen). The area sweep re-ran at the
unit's baseline: 17 operations examined (7 pinned v1 +
the 10 claimed v2), zero unclassified (native 4, D-9
3, out 10) — the v1 event reads are D-4's native tools,
the webhook endpoint reads are the mode-aware native
family, and the webhook endpoint writes are D-9
native-owns naming the native family — reconciling
with the census appendix bucket by bucket (D-4 2,
served 2, D-9 3, PROD-EVENT 10); the signing-secret
posture rows remain classified exactly as the census
has them (no secret/Out bucket for webhook endpoints;
the refused-secret rows are `apps/secrets`, a different
family). A disposition-verification row (the deployed
server still cannot name the v2 operations — no
operation exists to call and no tool is listed) stands
in the CAP-5 queue; the dispositioned rows join this
record's addendum accounting through this passage.

**CAP-4 progress — PROD-TAX Tax-area closure
(2026-11-04):** Phase 4's fourth product-gap card
(CAP4-PROD-TAX) is the program's verification card —
it claims zero census operations, deliberately — and
closes the Tax area with evidence; no native tool is
built, no source file changes, and the registry stays
at 343 tools. The closure line, in the frozen card's
own words: **Tax — no CAP-4 gap at the 2026-11-04
census; writes classified in D-9; reads natively
mode-aware.** The re-sweep behind that line was
re-derived at this baseline from the pinned catalog
(`src/stripe/openapi-index.js`, 559 operations): 31
Tax-area operations across the four census families
(tax, tax_codes, tax_ids including the
customer-scoped rows, tax_rates), zero unexamined —
8 GETs native-verified, 10 GETs door-served, and all
13 POST/DELETE rows classified in D-9's table
(6 allow: registrations create/update, settings,
locations, and the two tax_rates rows carrying the
whitelist `baseline: true` marker; 7 native-owns:
the tax family owns `POST /v1/tax/calculations` and
the two transaction creates, the customer family
owns the four tax_ids writes) — reconciling with the
census appendix (its served bucket's 18 Tax GETs land
as the 8 + 10 split its "and/or" wording carries; its
13 classification rows match D-9's table row for
row). Every claim in the frozen card's trace was
verified against the current tree and holds, with
the sweep's refinements recorded in the card (the
native/door split of the GETs; the allow rows for
settings and locations and the native-owns row for
calculations, which the trace did not enumerate and
which reverse none of it — no census amendment is
made). Reads: the native Tax reads verify each
object's `livemode` through one shared projection
(`src/tools/tax-native.js` on
`src/tools/catalog-mode.js`, whose LIVE branch routes
through the owner-enabled selected-account seam; the
catalog-extras `taxrate_*` reads and the customer
family's `customer_list_tax_ids` verify through
their own families' mode checks), and the guarded
universal read mode-verifies the GETs no native tool
governs — pin-proven in the unit's suite on two
representative rows (registrations/{id} and
tax_ids/{id}: serve mode-matched in TEST and LIVE,
refuse wrong-mode in both directions). The mode
proof cites the existing suites by test name —
final-native-e4's wrong-mode fixture for the
tax-native projection, catalog-extras'
wrong-environment refusal for its shared verifier,
customer-live-authority's LIVE execution of
`customer_list_tax_ids` — and fills the one genuine
gap (no test had exercised a tax-native read through
the LIVE client route) with two legs in the unit's
suite. **No CAP-5 rows are owed**: nothing in this
unit changes behavior, so no live-proof or
disposition-verification row joins the queue (the
frozen card's Done-when, stated explicitly).

**CAP-4 progress — PROD-ENTITLEMENTS entitled-product
coverage completion (2026-11-04):** Phase 4's fifth
and last product-gap card (CAP4-PROD-ENTITLEMENTS)
closes the entitled-product area; all 7 claimed
operations carry a build or a reasoned disposition,
no native tool is built, no source file changes, and
the registry stays at 343 tools. The 4 v1
entitlements GETs split as the tree holds them: the
two list GETs are native and projected (E-2's
`feature_list` → `{id, lookupKey, name, active}`;
`entitlement_list_active` → `{id, feature,
lookupKey}` — one shared `livemode` projection in
`catalog-extras.js` on `catalog-mode.js`, whose LIVE
branch routes through the owner-enabled
selected-account seam), and the two by-id GETs have
no native read. Those two builds are **stopped on a
measured budget fact and flagged for a coordinator
ruling**: the everyday catalog stands at exactly
19,999 / 20,000 tokens with zero headroom, and the
leanest honest forms of the two reads cost +78 and
+84 tokens each against the real budget evaluator
(re-proven in the unit's suite), so neither fits
without moving the cap or shrinking another tool's
text — neither of which this unit may do. The
interim route is the guarded universal read,
pin-proven to mode-verify both by-id GETs
per-object in both modes and both wrong-mode
directions; the raw shape exceeds the native
projections only by identifier-class fields
(`livemode`, `metadata`, `object` on the feature;
`livemode`, `object` on the active entitlement —
neither object carries PII or any secret). The 3 v2
commerce product-catalog imports are unserved under
the fleet v2 rule (ruling 3(iv); PROD-BILLING /
PROD-EVENTS disposition (a) inherited and
re-verified: the pinned catalog enumerates 559
operations with zero `/v2/` paths and zero commerce
paths, and no catalog-import consumer exists in the
tree). The area sweep examined 28 operations (25
pinned across entitlements, product_catalog,
products, prices, plus the 3 v2 census rows), zero
unexamined — 9 native, 5 door-served, 11 D-9
native-owns rows (every area write carries exactly
one, all family `catalog`), 3 out — reconciling
with the census appendix. **The entitlement
evidence note, as the frozen card requires:** CAP-1's
fields mark every operation `providerVerified:
false` — entitlement *evidence* in the strong sense
(provider-proven entitlement state) is a CAP-5 axis
(live proof), not something this card can mint from
source; "entitled-product gaps closed" is therefore
never to be misread as "entitlements live-proven."
**No CAP-5 rows are owed by this unit** (nothing is
built); the two blocked by-id builds are a flagged
coordinator ruling, and a future unit building them
under that ruling inherits the D-series CAP-5
obligation by name.

**CAP-4 progress — Phase 5: organization context
stages 1–2 and D-10's substrate decisions
(2026-11-04):** CAP-4's last scope lines close as a
research-and-records unit (CAP4-PHASE5-ORG-D10); no
native tool is built, no source file changes, and the
registry stays at 343 tools. The three lines below are
**inputs to row 15's capability-completeness addendum**
— the addendum itself lands with the CAP-4 close unit;
this passage does not write it.

**Organization context (CAP4-ORG, Stage 2a):**
organization context stays outside the server's model,
by recorded disposition dated 2026-11-04. The Stage 1
evidence memo (card-set record
`org-context-evidence-memo.md`; Deep Research pattern,
primary provider sources) establishes that the
organization surface is an optional credential +
context layer over the same API — organization keys
(`sk_org_…`), the `Stripe-Context` header with its
account-path propagation, organization-level roles, and
cross-account Sigma as the org-level evidence surface —
with no organization resource operations at all: the
pinned catalog (559 operations, re-derived and pinned
in the unit's suite) holds zero organization paths, and
`organization_context` sits in `OUTSIDE_PINNED_SCHEMA`,
so the census zero is structural. The flip-fact test
found none: no provider deprecation or steering strands
the single-account model (the provider's own guidance
steers single-account integrations away from org keys),
no shipped surface requires organization context, and
the workflow inventory found no owner workflow that
needs it — four candidates examined, zero surviving
scrutiny, with one Stripe account in real use. The
server's posture is recorded precisely: CAP-1's
credential-evidence layer recognizes the
`organization_secret` kind (exact `Stripe-Context` +
`Stripe-Version` requirement on file, permission
unverified) but never grants access or selects keys —
recognized in evidence, not operable as a connection,
and no code path sends `Stripe-Context`.
**Reopening condition: a named workflow** — an owner
workflow, roadmap item, or APP-NEEDS entry that must
operate across two or more of the owner's Stripe
accounts as one principal through this server; Stage 2b
then designs the contract for coordinator ruling before
any build. No CAP-5 rows are owed.

**D-10 — Sigma (S-8), decision dated 2026-11-04:
deliberately out of build scope.** The pinned catalog's
whole Sigma surface is the two `scheduled_query_runs`
GETs, door-served today through the guarded universal
read, and the reporting surface Sigma feeds rides D-6's
native family; the one operation the census claims for
D-10 (`POST /v1/sigma/saved_queries/{id}`) is
published-only — absent from the pinned catalog, so the
door cannot name it (both facts pinned in the unit's
suite). Sigma authoring (ad-hoc queries, saved-query
management) has no consumer — no roadmap item, APP-NEEDS
entry, or owner workflow — and no read-back contract
designed for it; a native Sigma family now would be
speculative surface area. **Reopening condition:** a
real consumer naming Sigma authoring through this
server, or a catalog re-pin that moves the Sigma rows
materially (surfaced by D-9's drift test), scoped to
the consuming workflow.

**D-10 — Data Pipeline / bulk export (S-9), decision
dated 2026-11-04: deliberately out, entirely; served
beside the server.** Data Pipeline is
Dashboard-configured warehouse/lake export
infrastructure (continuous sync to the owner's own
warehouse, storage, or Postgres destination), not a
tool-shaped operation surface: it holds zero operation
rows in either census (no pipeline/warehouse path in
the pinned catalog; pinned in the unit's suite), so it
is a named absence outside the inventory, not a gap in
it. An MCP tool surface neither provisions the owner's
warehouse nor carries bulk data; the owner enables the
product in the Dashboard beside this server. No consumer
exists. **Reopening condition:** a named consumer — an
owner workflow that must configure or monitor Data
Pipeline through this server — as a fresh card under
row 15's living duty. For both D-10 lines, "the surface
exists in Stripe" is not a reopening reason;
completeness is served by this record, not by
speculative tools. No CAP-5 rows are owed by either
decision.

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
