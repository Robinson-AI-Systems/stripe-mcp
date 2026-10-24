# ROADMAP — ideas not in the approved CAP implementation

2026-10-23 reconciliation: The owner's approved [CAP-1..CAP-5](designs/MAXIMUM-AUTHORITY.md)
and [Stripe connection/God Mode implementation](designs/STRIPE-CONNECTION-GOD-MODE.md)
now **include inventory and actual closure of supported Connect, Issuing, Treasury,
Terminal, Financial Connections and organization-operation gaps** when verified by
the provider. Those areas are no longer categorically excluded pending a
particular app adopting them. This list below records separate speculative
customer projects, workflows and distribution tasks; it does not override
the approved CAP roadmap.

Not approved scope. An item moves into a design only with Chris's approval (a dated DECISIONS entry).

- **YardSync and Cortiware project profiles** when their billing code exists (`workflow_project_setup` drafts them).
- **Browser-assisted dashboard steps:** for settings Stripe has no API for, an agent with a browser (Claude in Chrome)
  follows `stripe_where_is_setting`'s structured steps while Chris watches; the server then reads back where possible.
- **Port fixes back** to the Google Workspace MCP when a copied file is improved here (e.g. hashed tokens).
- **A scheduled "Stripe health" digest** (failed payments, disputes near deadline, webhook failures) once scheduled
  tasks are in regular use.
