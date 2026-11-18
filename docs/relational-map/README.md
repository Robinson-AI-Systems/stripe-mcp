# Relational map — Stripe Unleashed (stripe-mcp)

A readable diagram of how the whole system connects: who calls whom,
what reads or writes what, and what depends on what. This is the map of
the **real, built system** — not the roadmap, and not provider
acceptance. When a feature is built or changed, this map is refreshed
in the same change (see `docs/RULES.md`).

- Pointer: `docs/MAP.md`
- Deep record: `docs/ARCHITECTURE.md` · Tool list: `docs/TOOL-CATALOG.md`
- Current state / what remains: `docs/STATUS.md`, `docs/COMPLETION.md`
- Honest status note: this server is deployed in **TEST-oriented
  development**; it is **not independently accepted for broad public
  or LIVE financial use** (see README).

## The system in one picture

```mermaid
flowchart LR
  subgraph clients["AI clients"]
    C1["Claude / Muse / ChatGPT<br/>and other MCP clients"]
    C2["Robinson Toolkit Hub<br/>(RTC consumer)"]
    B1["Browser user<br/>(home page, Stripe setup page)"]
  end

  subgraph entry["Entry — same handlers, two hosts"]
    RACK["rack-server.mjs<br/>standalone Node server (production)"]
    VJSON["vercel.json + api/ functions<br/>(Vercel-shaped contract)"]
    API["api/ handlers<br/>mcp · oauth · tools · contract<br/>whoami · results · test-webhooks · health"]
  end

  subgraph core["Core — src/core/"]
    OAUTH["OAuth issuer<br/>oauth.js · oauth-handlers.js<br/>mcp-auth.js · cimd.js"]
    MCPSRV["MCP server<br/>mcp-server.js (SDK)"]
    REG["Tool registry<br/>registry.js"]
    WRITE["Write + money guards<br/>write.js · effective-access.js<br/>profiles.js"]
    RTC["RTC surface<br/>rtc-http.js · rtc-route.js · rtc-passes.js"]
  end

  subgraph tools["Tools — src/tools/ (119 modules)"]
    T["stripe_* tool families<br/>index.js merges all families"]
  end

  subgraph prov["Provider layer — src/stripe/"]
    PC["client.js — the only Stripe SDK import<br/>provider.js dispatch"]
    CAP["Capability evidence<br/>unified-source.js · operation-evidence.js<br/>vs vendored GA OpenAPI"]
  end

  DB[("Postgres store<br/>src/db.js — 35 tables + gated tenancy<br/>rack Postgres in production")]
  KEYS["Encrypted key store<br/>src/keys.js · core/crypto.js<br/>AES-256-GCM at rest"]
  SAPI["Stripe API (SDK 23, API 2026-09-30.endive)<br/>customers · payments · billing · invoices<br/>Connect · payouts · disputes · …"]
  WH["Stripe test webhooks<br/>→ api/stripe/test-webhooks/{account}/{endpoint}"]

  C1 -->|"HTTPS + OAuth bearer<br/>POST /api/mcp"| API
  C2 -->|"RTC HTTPS<br/>/api/tools, /api/contract"| API
  B1 -->|"HTTPS"| API
  RACK --> API
  VJSON -.->|"same contract"| API
  API --> OAUTH
  API --> MCPSRV
  API --> RTC
  MCPSRV --> REG
  RTC --> REG
  REG --> T
  T --> WRITE
  T --> PC
  PC --> CAP
  PC -->|"HTTPS, enrolled account key<br/>+ Stripe-Account header for Connect"| SAPI
  OAUTH --> DB
  T --> DB
  WRITE --> DB
  KEYS --> DB
  PC -.->|"key loaded per call"| KEYS
  WH -->|"raw body, signature-verified"| API
```

## Area maps

| File | Area |
|---|---|
| [01-entry-and-clients.md](01-entry-and-clients.md) | Hosts, routes, and who connects |
| [02-auth-keys-and-tenancy.md](02-auth-keys-and-tenancy.md) | OAuth sign-in, Stripe key enrollment, LIVE/money gates, inactive tenancy |
| [03-tools-and-gateway.md](03-tools-and-gateway.md) | Tool registry, dispatch, write guards |
| [04-stripe-provider.md](04-stripe-provider.md) | The wrapped Stripe API surface, Connect, capability evidence |
| [05-storage-and-secrets.md](05-storage-and-secrets.md) | Postgres tables, encryption, reservations/approvals |
| [06-release-and-operations.md](06-release-and-operations.md) | CI, promotion to `live`, rack production, webhooks & dev simulation |

## Reading conventions

- **calls** — a runtime request from one part to another.
- **reads / writes** — data flow into or out of the store.
- **depends-on** — the part does not work without the other.
- A box named in backticks is a real file or route in this repo.
- Anything labelled **inactive source** exists in code but is not
  switched on in production — the map says so wherever it appears.
