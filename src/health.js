// Fleet Stage-1 health contract (RAS MCP Standard, Library D-001): one GET
// JSON readout in the pinned minimal shape — status, server version,
// deployed SHA, tool count, timestamp — 200 when healthy, 503 when a
// checked dependency is degraded. The version/SHA come from the same
// checked VER-1 source as every other surface (src/release.js). The
// readout carries no credentials, user data, internal hostnames or
// configuration values; configuration appears as booleans at most.
import { neon } from '@neondatabase/serverless';
import { deployedCommit, packageVersion, releaseVersion } from './release.js';

export function healthReadout({ env = process.env, toolCount = 0,
  database = false, now = new Date() } = {}) {
  const healthy = database === true;
  return {
    status: healthy ? 'ok' : 'degraded',
    version: releaseVersion(env),
    package_version: packageVersion(),
    commit: deployedCommit(env),
    tools: toolCount,
    timestamp: now.toISOString(),
    checks: { database }
  };
}

// A dependency check that can genuinely fail: one bounded `select 1`
// against the configured store. An unconfigured store is not healthy —
// the authenticated doors cannot serve without it — so it reads false,
// never a stale success. `query` is injectable for tests only.
export async function checkDatabase(env = process.env,
  { timeoutMs = 2500, query } = {}) {
  try {
    if (typeof query === 'function') { await query(); return true; }
    const url = env?.DATABASE_URL;
    if (typeof url !== 'string' || !url) return false;
    const sql = neon(url);
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('health check timed out')), timeoutMs);
    });
    try {
      await Promise.race([sql`select 1 as ok`, timeout]);
      return true;
    } finally { clearTimeout(timer); }
  } catch { return false; }
}
