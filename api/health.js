import { registry } from '../src/tools/index.js';
import { checkDatabase, healthReadout } from '../src/health.js';
import { send } from '../src/core/http.js';

// Fleet Stage-1 health contract: GET JSON, 200 when healthy, 503 when the
// checked store dependency is degraded. Public and credential-free; the
// readout contains no configuration values, only booleans for checks.
export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  const database = await checkDatabase(process.env);
  const body = healthReadout({ toolCount: registry.tools.length, database });
  return send(res, body.status === 'ok' ? 200 : 503, body);
}
