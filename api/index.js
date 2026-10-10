import { registry } from '../src/tools/index.js';
import { profileCounts } from '../src/core/profiles.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ name: 'Robinson Stripe MCP', status: 'setup-required',
    tools: registry.tools.length, profileToolCounts:profileCounts(registry), oauth: '/.well-known/oauth-authorization-server',
    endpoint: '/api/mcp', note: 'No Stripe key is available until an account is configured through the setup page.' });
}
