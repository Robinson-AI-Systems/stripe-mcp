# ROADMAP — ideas not being built now

Not approved scope. An item moves into a design only with Chris's approval (a dated DECISIONS entry).

- **Connect** (`connect_*`, 16 tools in TOOL-CATALOG): when YardSync or Cortiware takes payments on behalf of other
  businesses. Batch U reaches Connect operations meanwhile.
- **Hand-built tools for Terminal, Issuing, Treasury, Financial Connections** when one of them is actually used
  (signal: repeated `api_*` calls in the change log).
- **YardSync and Cortiware project profiles** when their billing code exists (`workflow_project_setup` drafts them).
- **Browser-assisted dashboard steps:** for settings Stripe has no API for, an agent with a browser (Claude in Chrome)
  follows `stripe_where_is_setting`'s structured steps while Chris watches; the server then reads back where possible.
- **Port fixes back** to the Google Workspace MCP when a copied file is improved here (e.g. hashed tokens).
- **A scheduled "Stripe health" digest** (failed payments, disputes near deadline, webhook failures) once scheduled
  tasks are in regular use.
