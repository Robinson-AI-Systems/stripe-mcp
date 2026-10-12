// Owner-private, TEST-only classification of already validated custom MCP smoke.
// This does not infer Stripe's defaults, intended settings, or provider delivery.
const ALLOWED = new Set(['observed','partial','not_readable','error']);
const GROUPS = Object.freeze({
  account:new Set(['account_get','account_list_capabilities',
    'account_list_payment_method_settings','account_list_apple_pay_domains']),
  webhooks:new Set(['event_list','webhook_list']),
  readiness:new Set(['admin_list_requirements','admin_check_setting']),
  administration:new Set(['stripe_admin_overview','admin_review_security',
    'admin_list_guided_settings'])
});
const expected = Object.freeze({
  account:[...GROUPS.account],
  webhooks:[...GROUPS.webhooks],
  readiness:[...GROUPS.readiness],
  administration:[...GROUPS.administration],
  core:[...GROUPS.account,...GROUPS.webhooks,...GROUPS.readiness]
});
const labels=Object.freeze({
  account_get:'Stripe account profile',
  account_list_capabilities:'Payment capabilities',
  account_list_payment_method_settings:'Payment-method configurations',
  account_list_apple_pay_domains:'Payment domains',
  event_list:'Stripe event listing',
  webhook_list:'Webhook endpoint listing',
  admin_list_requirements:'Account requirements',
  admin_check_setting:'Payment settings readback',
  stripe_admin_overview:'Administration overview',
  admin_review_security:'Security review',
  admin_list_guided_settings:'Dashboard-only guided settings'
});
export function buildSetupReadinessReport(smoke) {
  if(smoke?.mode!=='test'||smoke.source!=='custom_mcp_dispatch'||
    smoke.dashboardVerified!==false||smoke.writeOperations!==0||
    !Object.hasOwn(expected,smoke.focus)||
    !Array.isArray(smoke.records)||smoke.records.length!==expected[smoke.focus].length||
    new Set(smoke.records.map(v=>v.tool)).size!==smoke.records.length||
    smoke.records.some(v=>!expected[smoke.focus].includes(v.tool)||!ALLOWED.has(v.status)))
    throw new TypeError('An authenticated TEST readback is required');
  const checks=smoke.records.map(({tool,status})=>({
    check:labels[tool],status,
    meaning:status==='observed'?'Native read returned a bounded valid response; configuration intent is not verified.':
      status==='partial'?'Native evidence is incomplete; no setup conclusion can be drawn.':
      status==='not_readable'?'Not available through this key or API; cannot assume a default.':
        'No validated native result; retry or investigate the TEST read.'
  }));
  const counts=Object.fromEntries([...ALLOWED].map(status=>
    [status,checks.filter(v=>v.status===status).length]));
  // Do not turn every Dashboard-only item into an owner chore.
  const exceptions=smoke.records.filter(v=>v.status!=='observed').map(v=>({
    check:labels[v.tool],status:v.status,
    next:v.status==='error'?'Retry this read-only TEST check; review permissions or service health if it repeats.':
      v.status==='partial'?'Review the complete native readback before drawing a conclusion.':
        'Unknown from this read. Only inspect in Dashboard if your workflow requires this setting.'
  }));
  return {
    mode:'test',source:'custom_mcp_dispatch',focus:smoke.focus,
    readiness:'incomplete',configuredSettingsVerified:false,
    dashboardVerified:false,oauthVerified:false,webhookDeliveryVerified:false,
    liveEnabled:false,writeOperations:0,
    counts,checks,exceptions,
    ownerAction:exceptions.some(v=>v.status==='error')?
      'Retry failed TEST reads. No Stripe setting change is justified by this report alone.':
      'No configuration change is required based on this report alone.',
    note:'Sandbox defaults are unknown until read. Owner-observed Dashboard facts are separate evidence; native listing never proves event delivery, signature validation or OAuth.'
  };
}
