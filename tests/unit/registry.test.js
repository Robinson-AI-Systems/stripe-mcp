import { describe, expect, it } from 'vitest';
import { mergeNamespaces } from '../../src/core/registry.js';
import { registry } from '../../src/tools/index.js';
const make = (name) => ({ tools: [{ name }], handlers: { [name]: async () => null } });
describe('tool registry', () => {
  it('registers only the intended safe metadata/audit readers', () => {
    expect(registry.tools.map(t => t.name)).toEqual([
      'stripe_whoami', 'stripe_list_accounts', 'stripe_check_key_permissions', 'stripe_recent_changes',
      'stripe_list_connections', 'stripe_get_result', 'stripe_where_is_setting',
      'stripe_search_tools', 'stripe_describe_tool', 'stripe_call', 'stripe_batch',
      'customer_list','customer_get','customer_search','customer_find',
      'customer_list_payment_methods','customer_get_payment_method',
      'customer_list_balance_transactions','customer_list_tax_ids',
      'customer_create','customer_update','customer_delete',
      'customer_remove_payment_method','customer_set_default_payment_method',
      'customer_add_balance_credit','customer_add_tax_id','customer_delete_tax_id',
      'customer_remove_discount',
      'payment_list','payment_get','payment_search','charge_list','charge_get',
      'charge_search','payment_list_refunds','payment_get_refund','setup_list','setup_get',
      'payment_charge_saved_method','payment_capture','payment_cancel',
      'payment_update','charge_update','payment_create_refund',
      'payment_update_refund','payment_cancel_refund','setup_cancel',
      'checkout_list','checkout_get','checkout_list_line_items',
      'paylink_list','paylink_get','portal_list_configurations','portal_get_configuration',
      'checkout_create_payment_link_for_customer','checkout_create_setup_link',
      'checkout_expire','paylink_create','paylink_update','paylink_deactivate',
      'paylink_activate','portal_create_session','portal_update_configuration',
      'billing_list_subscriptions','billing_get_subscription','billing_search_subscriptions',
      'billing_preview_change','billing_list_items','billing_list_schedules',
      'billing_get_schedule','billing_create_subscription','billing_update_subscription',
      'billing_change_plan','billing_cancel_subscription','billing_undo_cancel',
      'billing_pause_collection','billing_resume_collection'
    ]);
    expect(registry.tools.filter(t=>t.writes===true)).toHaveLength(34);
    expect(registry.tools.filter(t=>t.writes===true).every(t=>t.writeContract==='defineWrite-v1')).toBe(true);
  });
  it('refuses duplicates across namespaces', () => {
    expect(() => mergeNamespaces([make('stripe_example'), make('stripe_example')])).toThrow(/Duplicate/);
  });
  it('refuses tools without a handler', () => {
    expect(() => mergeNamespaces([{ tools: [{ name: 'broken' }], handlers: {} }])).toThrow(/Missing handler/);
  });
});
