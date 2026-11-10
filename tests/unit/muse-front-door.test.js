// D-006 MC-8: the front door tells people the one Muse Client ID, `muse`.
import { describe, it, expect } from 'vitest';
import { createFrontDoorHandler } from '../../api/index.js';
describe('front door Muse instruction', () => {
  it('names muse as the Client ID with a blank secret', async () => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status() { return this; }, json(v) { this.body = v; return this; } };
    await createFrontDoorHandler({ check: async () => true })({ method: 'GET', headers: {} }, res);
    expect(res.body.connect.muse_client_id).toBe('muse');
    expect(res.body.connect.muse_client_secret).toBe('leave blank');
    expect(res.body.connect.muse).toContain('type muse');
  });
});
