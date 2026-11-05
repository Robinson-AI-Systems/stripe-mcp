# CAP4-PHASE5-ORG-D10 — organization context stages 1–2 (disposition 2a) and D-10's substrate decisions (records only)

**Status: source-implemented** (records and pins; no source
behavior changes) on branch `ai/vivienne/cap4-phase5-org-d10`
from baseline `main` `b08cbb9136bd8d568dd0275754aa16dfb631b329`
(PR #344, PROD-ENTITLEMENTS; the coordinator publishes).
Unit **Phase 5** of CAP-4: ORG stages 1–2 per
`card-org-context.md` plus unit **D-10** per
`card-substrate-dispositions.md`. This is a
research-and-records unit: **no native tool is built and no
source file changes.** Its deliverables are (1) the ORG
evidence memo and its Stage 2a disposition; (2) D-10's two
dated decisions; (3) pins (`tests/unit/cap4-phase5-org-d10.
test.js`, 6 tests) making the substrate facts those records
rest on re-runnable. Registry unchanged at **343 tools**.

## Part 1 — ORG Stage 1: the evidence memo

The memo lives with the card set at
`~/workspace/stripe-cap4-cards/org-context-evidence-memo.md`
and is summarized in the Stage 1 outcome section appended to
`card-org-context.md`. Method: Deep Research pattern —
evidence first, run ledger, primary sources (Stripe's
official documentation) scored over secondary,
counterevidence actively sought, skeptic pass at the end.

**Fork 1 — the provider survey (headline findings).**
Stripe's organization surface is a credential + context
layer over the existing API, not a resource API:

- **Organization-scoped API keys:** one key at the
  organization level, prefix `sk_org_…`, always secret (no
  `rk_org`, no publishable org keys), permissions limitable
  like a restricted key, sandbox and live modes, managed in
  the organization Dashboard. An organization holds up to 75
  accounts, conducts no business itself, and cannot accept
  payments. (https://docs.stripe.com/keys/organization-api-keys;
  https://docs.stripe.com/get-started/account/orgs/build)
- **`Stripe-Context` and propagation:** every org-key request
  targeting an account must carry `Stripe-Context` naming it
  (bare account ID for a standalone account; the
  `platform/connected` path for a connected account), and
  every org-key request must carry `Stripe-Version`. The same
  header is Stripe's general related-account mechanism
  (platform→connected, v2-account scopes), so context
  propagation is not itself organization surface.
  (https://docs.stripe.com/context)
- **Which resources honor it:** by construction, any
  account-scoped API — the provider's own example reads a
  standalone account's balance and a platform's connected
  account's balance with one key. There is no separate
  organization resource API to enumerate, which is why the
  census's organization zero is **structural**: the pinned
  catalog (559 operations, re-derived in this unit's suite)
  contains zero organization paths, and
  `organization_context` sits in `OUTSIDE_PINNED_SCHEMA` in
  `src/stripe/capability-inventory.js`.
- **Organization-level entitlements/evidence:** what exists
  is access administration — org-level roles granting access
  to all accounts in the org, org keys' own permission sets —
  plus cross-account Sigma as the org-level evidence surface
  (queries across selected accounts grouped by `merchant_id`,
  Sigma enabled per account, org reporting role). No provider
  surface returns "organization entitlements" as data this
  server would project.
  (https://docs.stripe.com/get-started/account/orgs/team;
  https://docs.stripe.com/data/sigma-organizations)
- **Direction signals (counterevidence, sought):** no
  deprecation or steering away from the single-account model
  exists. Account-level keys (publishable, restricted,
  secret) remain fully documented current surface
  (https://docs.stripe.com/keys), and the org-key page itself
  steers the other way for single-account use: use an
  organization key only when operating across multiple
  accounts or on the organization itself — not when accessing
  only one account.

**The server's current posture, stated precisely.** The gap
is narrower than "no organization concept anywhere": CAP-1's
documentation-only credential-evidence layer recognizes
`organization_secret` — the tenancy vault recognizes the
`sk_org_` shape and `assessCredentialContext` carries an
organization branch requiring the exact `Stripe-Context`
target and a verified-contexts list — but that layer by its
own header never grants access or selects keys. No connection
can be enrolled *as* an organization and no code path sends
`Stripe-Context` (grep over `src/stripe/client.js` and
`src/tools/`: zero hits; pinned in this unit's suite at the
evidence layer). **Recognized in evidence, not operable as a
connection.**

**Fork 2 — the workflow inventory (honest verdict).** Four
candidates were examined against the repo's records and the
owner's recorded business shape (two small businesses —
Robinson Appliance Rentals, prelaunch, and Robinson AI
Systems; **one Stripe account in real use**):

1. Cross-account operation under one organization principal
   (the scope line's motivating candidate) — **does not
   survive**: there is no second account in real use to
   operate across, and no record names such a workflow. A
   candidate that motivates a scope line is not a
   demonstrated need.
2. Consolidated reporting across both businesses — **does
   not survive**: it presupposes candidate 1's second
   account; with one account, the existing reporting family
   serves the need.
3. One credential instead of per-account keys — **does not
   survive, and cuts against adoption**: with one account it
   buys nothing, and the provider advises against org keys
   for single-account access.
4. A future second account at rentals launch — **a
   possibility, not a workflow**: nothing records rentals
   holding its own account, and the server's existing
   multi-connection enrollment already operates two accounts
   as two connections; organization context would be a
   convenience, not an enabler.

**Zero workflows survive scrutiny.** APP-NEEDS, OWNER-GUIDE
and ROADMAP contain no organization requirement
(grep-verified).

**Flip-fact test.** The standard: provider
deprecation/steering stranding the single-account model, OR
organization context REQUIRED for a surface this server
already ships, OR a demonstrated owner workflow that needs
it. **No flip fact found** — on any of the three legs.

## Part 2 — ORG Stage 2, track 2a (the disposition as drafted)

> **Organization context — recorded disposition (2026-11-04,
> CAP4-ORG Stage 2a): organization context stays outside the
> server's model.** The provider surface is an optional
> credential + context layer over the same API (org keys,
> `Stripe-Context`, org roles); nothing this server ships
> requires it, the provider steers single-account
> integrations away from org keys, and the workflow
> inventory finds no owner workflow that needs it (one
> Stripe account in real use). The CAP-1 credential-evidence
> layer's recognition of `organization_secret` stands as the
> recorded evidence of what an org credential would require.
> **Reopening condition: a named workflow** — an owner
> workflow, roadmap item, or APP-NEEDS entry that must
> operate across two or more of the owner's Stripe accounts
> as one principal through this server. On that day Stage 2b
> designs the contract (connection model, context
> propagation, entitlement evidence) for coordinator ruling
> before any build. No CAP-5 rows are owed (Stage 3 is not
> commissioned).

This line is an **input to row 15's capability-completeness
addendum**, which is the next unit (the CAP-4 close); this
card does not write the addendum.

## Part 3 — D-10's two dated decisions (paperwork-class)

**S-8 — Sigma: DELIBERATELY OUT of build scope (decision
dated 2026-11-04).** Argued from evidence: the pinned
catalog's whole Sigma surface is the two
`scheduled_query_runs` GETs, which are door-served today
(the guarded universal read), and the reporting runs Sigma
feeds ride D-6's native reporting family; the one operation
the census claims for D-10, `POST /v1/sigma/saved_queries/
{id}`, is published-only — absent from the pinned catalog,
so the door cannot even name it (both facts pinned in this
unit's suite). Sigma *authoring* (writing/running ad-hoc
queries, saved-query management) has **no consumer**: no
roadmap item, APP-NEEDS entry, or owner workflow consumes it
through this server, and the saved-query POST has no
read-back contract designed for it. Cross-account Sigma is
a Dashboard surface at the organization (see Part 1) and
changes nothing here. Building a native Sigma family now
would be speculative surface area. **Reopening condition:**
a real consumer naming Sigma authoring through this server,
or a catalog re-pin that moves the Sigma rows materially
(D-9's drift test surfaces that day) — scoped to the
consuming workflow, not a general Sigma family.

**S-9 — Data Pipeline / bulk export: DELIBERATELY OUT,
entirely; served beside the server (decision dated
2026-11-04).** Argued from the server's shape and consumer
evidence: Data Pipeline is warehouse/lake export
*infrastructure* — continuous sync of the account's data to
Snowflake, Redshift, Databricks, BigQuery, cloud storage, or
Postgres, configured in the Dashboard against the owner's
own destination credentials (https://docs.stripe.com/data/
data-pipeline) — not a tool-shaped operation surface. It has
**zero operation rows in either census** (the pinned catalog
holds no pipeline/warehouse path; pinned in this unit's
suite): it is not a gap in the inventory, it is outside it.
An MCP tool surface neither provisions the owner's warehouse
nor carries bulk data; the owner's route is to enable the
product in the Dashboard beside this server. No consumer
exists. **Reopening condition:** a named consumer — an owner
workflow that must configure or monitor Data Pipeline
through this server — as a fresh card under row 15's living
duty. "The surface exists in Stripe" is not a reopening
reason for either decision; completeness is served by this
record, not by speculative tools.

Both lines are **inputs to row 15's addendum** in the same
sense as Part 2's line; the addendum itself is the next
unit's work.

## Pins and verification

`tests/unit/cap4-phase5-org-d10.test.js` (6 tests) pins:
the `OUTSIDE_PINNED_SCHEMA` membership and disposition of
`organization_context`; the pinned catalog at 559
operations with zero organization and zero `/v2/` paths;
the `organization_secret` credential-evidence entry and its
required `Stripe-Context + Stripe-Version` header; the
pinned Sigma surface as exactly the two scheduled-query-run
GETs; the D-10 claimed POST as published-only/absent; and
zero Data Pipeline paths. **Baseline accounting: all 6 pins
pass at pristine baseline `b08cbb913` by design** — this
unit changes no behavior, and the pins are named as pins,
not behavior evidence. Verification location: this VM (the
program's declared location deviation; exact-head CI carries
the decisive weight). Local PostgreSQL binaries are absent
on this VM; no database behavior is touched.

## Drift check

Re-derived at this baseline rather than copied from the
frozen cards (whose baseline was `19766344`): the pinned
catalog totals (559 operations, zero `/v2/` paths) match
PROD-BILLING's, PROD-EVENTS' and PROD-ENTITLEMENTS'
re-derivations at their baselines; the census's ORG zero
and D-10's single claimed operation were re-derived from
the catalog and `OUTSIDE_PINNED_SCHEMA` directly and match
the appendix. Two drifts from the frozen cards' framing,
recorded: (1) `card-org-context.md` says the server "has
no organization concept anywhere" — at this baseline
CAP-1's credential-evidence layer recognizes
`organization_secret` (evidence only, never access), and
Part 1 states the posture precisely rather than repeating
the older phrasing; (2) the derivation's S-8 line says
Sigma has "no operation in the 644-row API census" — the
unified census does carry the two pinned scheduled-query
GETs (door-served) alongside the one published-only POST
the CAP-4 census claims for D-10; the decisions above rest
on the re-derived split, which changes no outcome. No
other drift: the registry count (343), the D-9
classifications and the sequence's Phase 5 placement all
match the cards' cross-references.

## CAP-5 obligation

**No CAP-5 acceptance rows are owed**: nothing in this
unit is built (Stage 3 is not commissioned and both D-10
decisions are dispositions, not surfaces), so there is no
new surface to live-prove and no disposition-verification
row to queue.

## Done-when, against the frozen cards

- ORG: the evidence memo exists (card-set folder, with the
  Stage 1 outcome summarized in `card-org-context.md`) and
  Stage 2a's disposition is recorded in this card and in the
  conformance record as an addendum input line. CAP-4
  legitimately closes this unit at Stage 2a. No CAP-5 rows
  owed.
- D-10: both decisions are recorded with dates, reasons and
  reopening conditions here and in the conformance record;
  the sequence's Phase 5 is complete with this card. No
  code beyond pins, no CAP-5 rows owed.
- Remaining after this unit: RECENSUS-1/2 per their cards,
  then the CAP-4 close (row 15's addendum + the CAP-5
  consumer test).
