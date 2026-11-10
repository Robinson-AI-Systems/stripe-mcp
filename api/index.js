import { registry } from '../src/tools/index.js';
import { profileCounts } from '../src/core/profiles.js';
import { deployedCommit, packageVersion, releaseVersion } from '../src/release.js';
import { checkDatabase, healthReadout } from '../src/health.js';

// Public status front door. Every fact here is rendered from the same live
// sources the health endpoint reports — the VER-1 release identity, the
// tool registry and configuration posture as booleans — never hardcoded
// values, and never configuration values themselves. The published status
// is the health readout's own verdict (conformance row 8(b): the front
// door renders the same live state /api/health reports): 'online' only
// when the checked store dependency passes, 'degraded' when it fails, and
// 'setup-required' before the service is configured at all. `check` is
// injectable for tests only, following src/health.js's own pattern.
export function createFrontDoorHandler({ check = checkDatabase } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const storeConfigured = Boolean(process.env.DATABASE_URL);
    const originConfigured = Boolean(process.env.PUBLIC_BASE_URL);
    const configured = storeConfigured && originConfigured;
    let status = 'setup-required';
    if (configured) {
      const database = await check(process.env);
      const health = healthReadout({ toolCount: registry.tools.length, database });
      status = health.status === 'ok' ? 'online' : 'degraded';
    }
    return res.status(200).json({
      name: 'Stripe Unleashed by Robinson AI Systems',
      server: 'robinson-stripe-mcp',
      status,
      version: releaseVersion(),
      package_version: packageVersion(),
      commit: deployedCommit(),
      store: storeConfigured ? 'configured' : 'not-configured',
      tools: registry.tools.length,
      // Counts carry their scope in the document itself: profileToolCounts
      // is the profileCounts() default — READ tools only — while
      // profileVisibilityCounts counts every tool a profile may see,
      // reads and writes. (W4-F6: the reads-only figures once sat
      // unlabeled beside tools: 322 and read as the full reach.)
      profileToolCounts: profileCounts(registry),
      profileToolCountsScope: 'Read tools only, per connection profile (write tools excluded).',
      profileVisibilityCounts: profileCounts(registry, { allowWrites: true }),
      profileVisibilityCountsScope: 'Every tool each connection profile may see, reads and writes.',
      health: '/api/health',
      oauth: '/.well-known/oauth-authorization-server',
      endpoint: '/api/mcp',
      // D-006 MC-8: the one sentence every fleet server tells Muse users.
      connect: {
        muse: 'In Muse, add a custom connector with this server\'s /api/mcp address. If Muse asks for a Client ID, type muse. Client Secret: leave blank.',
        muse_client_id: 'muse',
        muse_client_secret: 'leave blank',
        older_muse_client_id: '/.well-known/muse-client.json (on this server; still works)',
        other_apps: 'Leave the Client ID and Client Secret blank.'
      },
      disclaimer: 'Stripe Unleashed is a Robinson AI Systems product. It is not affiliated with, endorsed by, or sponsored by Stripe, Inc.',
      note: configured
        ? 'Service is configured; /api/health reports live dependency health.'
        : 'No Stripe key is available until an account is configured through the setup page.'
    });
  };
}

export default createFrontDoorHandler();
