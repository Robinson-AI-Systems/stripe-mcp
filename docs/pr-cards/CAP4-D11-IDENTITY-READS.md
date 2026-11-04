# CAP4-D11-IDENTITY-READS — Identity reads follow the connection mode

Status: **SOURCE-IMPLEMENTED.** Family D-11 of CAP-4 (the eighth
CAP-4 family built, in the frozen Phase 1 sequence after D-7).
Read paths only: no write handler's mode gate, ceremony or
verification moves, the Identity write family (V2, PR #315) is
untouched, and the money wiring (`src/tools/write.js`,
`src/money.js`, `src/db.js`) is byte-untouched, proven by an
empty name-only diff against the baseline. Baseline: `main`
`3b56392515c7c2ea649ba6133b6fedc35a75938a` (PR #329, CAP-4 D-7).
Design record: the frozen card `card-identity-reads.md` and
`coordinator-rulings.md` in the coordinator's design folder.

## Scope, as built

Two registry tools carry this family's conversion:
`identity_list_sessions` and `identity_get_session`
(`src/tools/identity-sessions.js`) — the family's full read
surface, claiming the 2 census operations
(`GET /v1/identity/verification_sessions`,
`GET /v1/identity/verification_sessions/{session}`). The 2
verification-**report** GETs are **deliberately not claimed**:
no native read tool exists for them, they stay door-served
(census appendix, DOOR), and this card builds none. Identity
writes (`identity_create_session`, cancel, redact) are V2's,
merged, and untouched.

## The conversion

The projection already existed: `identitySafe(v, mode)` (V2
Identity, PR #315) takes an optional mode — when supplied, a
session verifies only in its own mode; the write callers in
`identity-lifecycle.js` already passed the connection mode, and
the read callers passed none, keeping the historical TEST-only
check. This build is the smallest conversion in the D-series:

- Both handler gates (`ctx?.connection?.mode!=='test'` →
  `fail('TEST Identity mode required')`) are deleted. The
  handlers now run through the one shared seam (`guarded` →
  `modeClient`, as in every sibling family): TEST resolves
  exactly as before; LIVE resolves only through the verified
  selected-account path.
- Both read callers pass the connection mode into the existing
  projection — the list through a per-member mapper (a
  wrong-mode member refuses the whole page, as in D-4), the get
  directly after the baseline's ID-match check.
- The module comment above `identitySafe` is updated to record
  that read callers now supply the mode; the now-unused `fail`
  import is removed (its only call sites were the two gates).
- The projection itself is **not modified by a single line**.

## The frozen field set (this family's defining discipline)

The conversion changes mode reachability, never the fields.
`identitySafe` projects exactly these keys, in TEST and LIVE
alike:

`id`, `type`, `status`, `createdAt`, `redactionStatus`,
`actionRequired`, `note`

Verification state and verified metadata only — no document
images or document data, no personal data (names, verified
outputs), no `client_secret` or other access secrets, no
verification-report IDs, no hosted URL, no raw metadata. The
suite pins the exact key set in both modes with sentinel
document/PII/secret values planted in the fixtures. The V2
disclosure rides along unchanged: redaction is irreversible
and is not complete erasure; nothing in this read conversion
weakens or re-describes that posture.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The projection needs building | `identitySafe(v, mode)` already takes an optional mode (V2, PR #315); only the read callers supplied none | Confirmed at the cited module: the conversion is the two handler gates plus passing `ctx.connection.mode` at both read call sites — the projection is untouched |
| The two handler gates sit at `identity-sessions.js:72`, `:80` (the frozen card's derivation) | Exactly there at the shipped baseline: both reads gate on `mode!=='test'` with `fail('TEST Identity mode required')` before any provider call | Deleted; the shared mode-aware seam governs, as in D-1..D-7 |
| Unenumerated gates (the hunt every family runs) | The hunt came up **empty**, each species checked and recorded: (a) **no mode-shaped ID pattern** — the session ID rule `^vs_[A-Za-z0-9]{2,100}$` carries no mode segment (Stripe verification-session IDs have no `vs_test_`/`vs_live_` form; contrast D-5's `cs_test_` find, which was real), so nothing converts and the returned object's `livemode` is the verification, as the projection already enforces; (b) **no TEST-hardcoded output** in the read path — the projection's fields and `note` text are mode-invariant, and its refusal text was already mode-parameterized by V2 ('Exact TEST/LIVE Identity verification session unavailable'); (c) **no other `identitySafe` caller omits the mode** — the only other callers are the V2 write paths (`identity-lifecycle.js`, the create's verify step), which already pass `modeOf(ctx)`; (d) **no other module calls the read handlers**, and no other module reads `identity.verificationSessions` outside this file and the write lifecycle; (e) **no store-layer refusal** exists on either read path | Recorded as a negative hunt with the species enumerated, not silently skipped |
| The 2 verification-report GETs belong to the read surface | No native read tool exists for them anywhere in the registry | **Deliberately excluded** (the frozen card's disposition): they stay door-served; a native-coverage decision is future work, not this card |
| Identity data is ordinary read data | It is the family's defining sensitivity | The field set is frozen (above) and pinned by an exact-keys test in both modes |

## Semantics (fitted to baseline evidence; the D-5 lesson)

The projection's mode semantics are V2's and are unchanged:
when a mode is supplied it is **strict** — the session's
`livemode` must be the boolean for that mode (a missing or
non-boolean `livemode` refuses, exactly as the baseline's
no-mode check required `livemode === false` explicitly) — so
the baseline TEST read set is unchanged: `identitySafe(v)` and
`identitySafe(v, 'test')` accept and refuse exactly the same
objects and produce byte-identical output (pinned). No-mode
callers keep the historical contract exactly (the V2
precedent). On a LIVE connection the verified selected-account
client resolution happens inside the shared seam before any
provider object is touched, and a wrong-mode session then
refuses at the projection **after** the provider call (the
D-4 evidence shape), with the mode-correct refusal text.

## Card-named behavior changes (the complete list)

1. **Mode reachability:** both reads serve LIVE connections
   (baseline: refused at the handler gate before any provider
   call). Wrong-mode sessions refuse in both directions — on
   TEST as before (the projection's historical check), on LIVE
   now at the projection after the provider call.
2. **Descriptions name both modes** (below). No refusal text,
   output field, output value or TEST behavior changes:
   `identitySafe` is untouched and the TEST path supplies
   `'test'`, which is the baseline's expected mode exactly.

## Budget

Dual-mode wording was fitted inside this family's own two
descriptions only: the list description drops the word 'safe'
('List TEST or LIVE Identity verification statuses without
private documents.') and the get description drops its article
('Get TEST or LIVE Identity verification state without access
secrets or personal data.') — every behavior and privacy
clause survives in both. Measured with
the repository's own budget script on both trees, the everyday
catalog reads **19,997 tokens against the 20,000 cap at
baseline and 19,997 after** — net zero by the official
serialized reading; the cap did not move and no other family's
text was touched.

## Proof

New suite `tests/unit/cap4-d11-identity-reads.test.js`: 10
tests — **4 fail at the pristine baseline** `3b563925` (the
LIVE list/get happy paths; the provider-called wrong-mode
refusals on a LIVE connection, including a wrong-mode member
inside an otherwise valid LIVE list page; and the both-modes
descriptions) and all 10 pass after. The 6 baseline passes are
accounted: the TEST happy paths and the byte-identical TEST
output pin (TEST behavior did not move); the LIVE-on-TEST
refusals (outcome-identical at baseline — the projection's
historical no-mode check already refused a LIVE object on a
TEST connection with the same text); the frozen-field-set pin
and the no-mode projection contract (the projection is
unchanged V2 code — the pins prove the conversion did not move
the fields); and the handler privacy assertion, whose LIVE leg
passes vacuously at baseline because the gate refused
everything (so nothing could leak) and gains its meaning
after conversion, when real LIVE projections still leak
nothing. The pre-existing family suites
(`identity-sessions.test.js`, `identity-live-conversion.test.js`)
pass unedited. Registry stays 329 tools (no tool added,
removed or renamed).

## CAP-5 obligation

Live proof for D-11 stands in the CAP-5 queue: one
`identity_list_sessions` read and one `identity_get_session`
read on the owner's LIVE connection, projecting the frozen
field set.

## What was NOT done

- The verification-report native reads (deliberately excluded
  above; door-served, no tool built).
- Identity writes — V2's, merged; not touched, including their
  D-9 rows (third-party-subject refusal class) and the
  redaction posture/disclosure.
- No account was enabled and no LIVE key was used; all LIVE
  evidence is fixture-based, as for every sibling family.
