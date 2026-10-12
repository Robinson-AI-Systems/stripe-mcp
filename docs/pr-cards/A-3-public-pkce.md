# A-3 follow-up — MCP public-client OAuth interoperability (#140)

Status: PROPOSED (exact-head CI, review and merge required). Approved foundation A-3 and external custom MCP acceptance gate.

## Drift A
- The current metadata supports `client_secret_post` only. Current MCP authorization permits PKCE-only public clients; confidential registrations must remain compatible.
- Current Neon OAuth client data is JSONB, so the registered authentication method and null secret hash require no migration; existing clients without that field must continue as confidential.
- Authorization is owner-passphrase gated, TEST-only and bound to an exact account, redirect URI, PKCE S256 and MCP resource. Public clients MUST NOT receive or present a shared client secret.
- Stripe enrollment, Vercel Deployment Protection, LIVE-disabled policy and Dashboard acceptance remain unchanged.

## Acceptance and security
- Explicit DCR `token_endpoint_auth_method: none` gets no `client_secret`, nullable stored hash and correct metadata; default confidential clients still get a hashed secret.
- Both methods require correct S256 PKCE, exact registered callback and resource; public attempts using a nonempty secret fail, cross-client refresh and replay fail.
- Unit and disposable-Postgres tests cover complete public issuance/refresh and stored registration; all five exact-head CI checks and mandatory self-review required.
- No real OAuth handshake is claimed until a protected, owner-authorized external MCP client can reach deployed discovery/registration/token endpoints.
