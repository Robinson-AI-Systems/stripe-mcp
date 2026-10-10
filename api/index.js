import { registry } from '../src/tools/index.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ name: 'Robinson Stripe MCP', status: 'setup-required',
    tools: registry.tools.length, oauth: '/.well-known/oauth-authorization-server',
    endpoint: '/api/mcp', note: 'No Stripe key is available until an account is configured through the setup page.' });
}
