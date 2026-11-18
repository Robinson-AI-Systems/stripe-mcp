# 01 — Entry and clients

## Hosts (one codebase, two shapes, one contract)

- **Production today: the Development Rack.** Since 2026-11-08
  production serves from the rack at
  `https://stripe.robinsonaisystems.com` via `rack-server.mjs`, a thin
  standalone Node server that reproduces the Vercel function contract
  route-for-route. The hosted Vercel project and its Neon store were
  retired the same day (see `docs/STATUS.md`, 2026-11-08).
- **Vercel-shaped contract:** `api/**/*.js` default exports are the
  handlers; `vercel.json` carries the rewrites. `rack-server.mjs`
  implements the same binding (filesystem routes, bracket segments as
  query params, rewrites verbatim, per-function `bodyParser` handling —
  the Stripe-signed test-webhook receiver keeps its raw stream), so no
  application logic lives in the entrypoint.
- Release identity: health and the front door read the deployed commit
  from the release pin (`src/release.js`); with no valid pin, health
  honestly reports a null commit.

## Routes (`api/`)

| Route | Handler | Serves |
|---|---|---|
| `/` | `api/index.js` | Home page (`src/home-page.js`) for browsers; JSON status for programs |
| `/api/mcp` | `api/mcp.js` | Streamable HTTP MCP transport (SDK) |
| `/api/contract`, `/api/openapi.json` | `api/contract.js`, `api/openapi.js` | RTC contract + OpenAPI document |
| `/api/whoami` | `api/whoami.js` | Authenticated identity / connection read |
| `/api/tools`, `/api/tools/{name}` | `api/tools/*` | RTC tool invocation doors |
| `/api/results/{handle}` | `api/results/[handle].js` | Stored large-result delivery |
| `/api/oauth/*` | `api/oauth/*` | OAuth issuer: authorize, token, register, revoke |
| `/api/stripe/setup` | `api/stripe/setup.js` | Protected owner setup page for Stripe keys (see 02) |
| `/api/stripe/test-webhooks/{account}/{endpoint}` | `api/stripe/test-webhooks/[account]/[endpoint].js` | Stripe test-webhook receiver (raw body, signature-verified) |
| `/api/developer/connect` | `api/developer/connect.js` | Developer connection route |
| `/api/health` | `api/health.js` | Health / release identity |
| `/.well-known/*` | `api/well-known/*` | OAuth authorization-server + protected-resource metadata, Muse client document |

## Clients

- **MCP clients** (Claude, Muse, ChatGPT, other MCP apps) — connect
  to `/api/mcp` with OAuth; see 02. Today the sign-in journey is the
  legacy protected owner flow: only the service owner can sign in,
  with a Stripe test account — the one-screen public self-enrollment
  flow is not built yet (README, `docs/COMPLETION.md`).
- **Robinson Toolkit Hub** — consumes the RTC HTTPS surface
  (`/api/contract`, `/api/tools…`); see `docs/HUB-COMPATIBILITY.md`.
  This server stays independently usable without the Hub.
- **Browser users** — home page and the Stripe setup page.
