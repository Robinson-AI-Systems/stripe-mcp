import { registry } from '../src/tools/index.js';
import { profileCounts } from '../src/core/profiles.js';
import { deployedCommit, packageVersion, releaseVersion } from '../src/release.js';

// Public status front door. Every fact here is rendered from the same live
// sources the health endpoint reports — the VER-1 release identity, the
// tool registry and configuration posture as booleans — never hardcoded
// values, and never configuration values themselves.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const storeConfigured = Boolean(process.env.DATABASE_URL);
  const originConfigured = Boolean(process.env.PUBLIC_BASE_URL);
  const configured = storeConfigured && originConfigured;
  return res.status(200).json({
    name: 'Stripe Unleashed by Robinson AI Systems',
    server: 'robinson-stripe-mcp',
    status: configured ? 'online' : 'setup-required',
    version: releaseVersion(),
    package_version: packageVersion(),
    commit: deployedCommit(),
    store: storeConfigured ? 'configured' : 'not-configured',
    tools: registry.tools.length,
    profileToolCounts: profileCounts(registry),
    health: '/api/health',
    oauth: '/.well-known/oauth-authorization-server',
    endpoint: '/api/mcp',
    disclaimer: 'Stripe Unleashed is a Robinson AI Systems product. It is not affiliated with, endorsed by, or sponsored by Stripe, Inc.',
    note: configured
      ? 'Service is configured; /api/health reports live dependency health.'
      : 'No Stripe key is available until an account is configured through the setup page.'
  });
}
