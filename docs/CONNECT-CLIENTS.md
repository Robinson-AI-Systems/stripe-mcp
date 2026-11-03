# Connecting a client to Stripe Unleashed

Connection material for **Stripe Unleashed by Robinson AI Systems**,
delivered with CAP-3 (see [RAS-MCP-CONFORMANCE](RAS-MCP-CONFORMANCE.md)
row 1). One public sign-in serves every client below: the client
discovers the server, the owner approves once on the server's own
consent screen, and the connection receives the fullest access the
owner's Stripe account allows. Profile and read-only choices are
settings on the connection, never separate sign-ins.

**Addresses.** The server's identity is its branded address,
`https://stripe.robinsonaisystems.com` (MCP endpoint
`https://stripe.robinsonaisystems.com/api/mcp`). The branded address is
reserved and advertised; until the brand/domain cutover in
[STRIPE-BRAND-DOMAIN](designs/STRIPE-BRAND-DOMAIN.md) completes, the
same snippets work unchanged with the current deployment origin
`https://stripe-mcp-chris-projects-de6cd1bf.vercel.app` in place of the
branded host. Never enter a Stripe key, passphrase or secret into a
client: sign-in happens only on the server's own pages, in the
client's own browser journey.

**Client identification shapes.** Two are first-class:

1. **Dynamic registration (OAuth 2.1, PKCE S256).** The client
   registers itself at `/api/oauth/register` (discovery document at
   `/.well-known/oauth-authorization-server`) and signs in. Public
   clients with no secret are supported.
2. **Client ID cards (CIMD).** A client may present a URL pointing at
   its own client metadata document as its `client_id`. The server
   fetches the card over HTTPS from that exact URL and validates it:
   the card's declared address must equal the fetched URL, a client
   name must be present, every redirect address used must be printed
   on the card, secret-holding cards are refused (card clients are
   public clients), and the fetch is SSRF-bounded (HTTPS only, public
   addresses only, bounded redirects, time and size caps). Card
   failures fail closed with a legible "unknown client" refusal.

Status honesty: card support is **FIXED IN SOURCE / NOT VERIFIED
LIVE** — the CAP-5 live knock test with a real card client runs
against the checked deployed release and is recorded in
[STATUS](STATUS.md) when it passes. Per-client live verification is
CAP-5 acceptance; a client not yet verified live is **untested**, not
silently skipped.

## Claude (app, desktop, browser) and ChatGPT

Add a custom connector with the MCP endpoint above. No client ID or
secret is entered: the client registers itself or presents its ID
card, the owner's browser opens the server's consent screen, and the
client returns automatically after approval.

## Muse

```bash
claude mcp add --transport http stripe-unleashed https://stripe.robinsonaisystems.com/api/mcp
```

Claude Code presents its ID card and uses a loopback return address on
an ephemeral port; the server matches the card's printed loopback
address with the port relaxed (the one sanctioned relaxation — scheme,
host and path still match exactly).

## Cursor, Windsurf, VS Code and other JSON-config clients

```json
{
  "mcpServers": {
    "stripe-unleashed": {
      "url": "https://stripe.robinsonaisystems.com/api/mcp"
    }
  }
}
```

(VS Code uses `"servers"` as the top-level key.) The client runs the
same OAuth discovery/registration journey on first use.

## Codex and Gemini CLI

Add a remote MCP server with the endpoint above and Streamable HTTP
transport; both complete the same OAuth journey on first connection.
Per-client live verification for these two is CAP-5 work and is
declared **untested** until recorded there.

## Hermes Agent

```yaml
mcp_servers:
  stripe-unleashed:
    url: "https://stripe.robinsonaisystems.com/api/mcp"
    transport: streamable-http
```

## Bearer / pass access (RTC doors)

Programmatic callers that cannot run a browser journey use the
server's separately issued scoped passes over the RTC HTTPS doors
instead of OAuth; a pass is a credential issued by this server for a
named purpose and lifetime, never a Stripe key and never another
user's grant. Hub (Robinson's Toolkit) connections discover this
server through its `/api/contract` advertisement — the server never
locates the hub.

## Disconnecting

Revoke a connection's tokens at `/api/oauth/revoke` (RFC 7009) from
the client, or disconnect the client in its own settings; revocation
takes effect immediately and refresh tokens for the connection stop
rotating.
