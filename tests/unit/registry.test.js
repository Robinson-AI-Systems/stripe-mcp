import { describe, expect, it } from 'vitest';
import { mergeNamespaces } from '../../src/core/registry.js';
import { registry } from '../../src/tools/index.js';
const make = (name) => ({ tools: [{ name }], handlers: { [name]: async () => null } });
describe('tool registry', () => {
  it('registers only the intended safe metadata/audit readers', () => {
    expect(registry.tools.map(t => t.name)).toEqual([
      'stripe_whoami', 'stripe_list_accounts', 'stripe_recent_changes',
      'stripe_list_connections', 'stripe_where_is_setting'
    ]);
    expect(registry.tools.every(t => t.writes === false)).toBe(true);
  });
  it('refuses duplicates across namespaces', () => {
    expect(() => mergeNamespaces([make('stripe_example'), make('stripe_example')])).toThrow(/Duplicate/);
  });
  it('refuses tools without a handler', () => {
    expect(() => mergeNamespaces([{ tools: [{ name: 'broken' }], handlers: {} }])).toThrow(/Missing handler/);
  });
});
