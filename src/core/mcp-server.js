// No Stripe imports; future write handlers must pass the write-contract safety layer.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { requireMcpToken } from './mcp-auth.js';

export function createMcpHandler({ db, registry, env = process.env }) {
  return async function mcp(req, res) {
    const ctx = await requireMcpToken(req, res, db, env);
    if (!ctx) return;
    const server = new Server({ name: 'robinson-stripe-mcp', version: '0.1.0' },
      { capabilities: { tools: {} } });
    // A-3 has no registered tools. A-5 adds read-only server tools; B adds the
    // uniform guarded dispatcher before any write tool can be registered.
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: registry.tools }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const name = request.params?.name;
      if (!registry.tools.some(t => t.name === name)) {
        return { isError: true, content: [{ type: 'text', text: 'Unknown tool' }] };
      }
      // Guardrail: no tool dispatcher is installed until the B safety layer.
      return { isError: true, content: [{ type: 'text', text: 'This tool is not enabled yet' }] };
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on?.('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
    }
  };
}
