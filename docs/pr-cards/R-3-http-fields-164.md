# R-3 HTTP fields schema and pre-dispatch validation — PR #164

Status: proposed; exact-head CI and self-review required.
Baseline: ae58709364073043a588c3b8ab075424c8c2a242.
Drift A: RTC HTTPS metadata said fields:string even though handler
supported array, and malformed detail/path selection reached dispatcher,
which labelled it as a service failure rather than invalid_args.
Implementation: describe string/array JSON Schema only for HTTPS. Apply
existing projectFields safe paths to normalized arguments before handler,
reject malformed types, duplicate/prototype selector and invalid detail.
Do not touch the existing MCP registered tool metadata, permissions,
Stripe provider, token issuance, approval, LIVE or HTTP protection.
Tests: exact describe schema and adversarial zero-handler-call rejection,
array success, six exact-head gates.
Drift B: STATUS. External Hub three-route acceptance remains pending.
