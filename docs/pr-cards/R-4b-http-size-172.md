# R-4b — HTTP parsed-body cap hardening (PR #172)
Status: MERGED (#172) as-if; seven exact-head checks and review threads required.
Baseline: PR #171 head e83cc2b6d75052c423afa4d3ace3aa500749eac5 (stacked; reconcile after #171 merges).
Drift A: incomingBodyWithinLimit rejected huge declared/raw POSTs but trusted a small declared Content-Length when a framework supplied a much larger pre-parsed object. Raw-body absence permits no faithful wire-size reconstruction; normalize only to enforce an additional upper bound.
Implementation: always cap JSON serialization of structured POST when no raw body exists; fail closed on circular/BigInt, preserve declared length validation and fail-closed chunked behavior. No route, schema or operational limit changes.
Tests: undersized forged Content-Length, huge pre-parsed payload, circular and BigInt, valid small body, real RTC guarded batch never reaches handler on oversized payload.
Drift B: HTTP helper shared by RTC and existing endpoints; no Stripe API, provider write, keys or DB changes. Keep LIVE off, $0 pass, main→live scheduled only, external Hub acceptance unverified.
