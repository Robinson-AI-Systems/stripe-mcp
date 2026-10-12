# R-3 temporary one-hour RTC pass — PR #163

Status: proposed; exact-head CI and self-review required.
Baseline: 3e3cc4df969699d17bc959dc4c9cabea99862525.
Drift A: passes always lasted 24 hours despite owner-approved temporary D-4
read-only testing. Add exact 1-hour selection to the existing protected form
without widening 24-hour default or supported read areas. Validate numeric
lifetime 1/24 before account lookup, persist the corresponding expiration,
keep 256-bit pass one-time reveal and existing revocation. No LIVE, money,
provider mutations, bypass or broader auth authority.
Tests: issuer valid/invalid durations, all existing setup/CSRF/passphrase and
scoped Postgres acceptance, six CI gates.
Drift B: STATUS and OWNER-GUIDE updated. Real Hub direct, relay and Sandbox
runs plus independent revocation remain pending.
