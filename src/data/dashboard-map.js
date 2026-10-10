// Dashboard-only settings: guided steps, not claims of API access.
// Use the stable Stripe Settings landing page so changed subpaths cannot
// lead an operator into an unverified account/mode route.
export const DASHBOARD_SETTINGS = Object.freeze({
  account_verification: {label:'Account and business verification',
    steps:['Sign in to Stripe and select the intended account.',
      'Open Settings and find Business details or Account requirements.',
      'Complete any requirements shown for your business.',
      'Return to Account requirements and verify that the outstanding list changed.']},
  bank_account: {label:'Business payout bank account',
    steps:['Select the intended Stripe account.',
      'Open Settings, then Bank accounts and scheduling or Payout settings.',
      'Check the destination account and verification status.',
      'Confirm the saved bank account details directly in Stripe.']},
  receipt_emails: {label:'Customer payment receipt emails',
    steps:['Select the intended Stripe account and mode.',
      'Open Settings and find Customer emails.',
      'Review successful-payment receipt options and save the intended setting.',
      'Verify the saved option and send a test-mode payment receipt.']},
  failed_payment_emails: {label:'Failed-payment customer emails',
    steps:['Open Stripe Settings and find Customer emails.',
      'Compare failed-payment emails with messages your own app sends.',
      'Make the owner-approved selection and save it.',
      'Check the saved setting to avoid duplicate customer notices.']},
  subscription_retries: {label:'Subscription payment retries and final action',
    steps:['Open Stripe Billing settings, then Revenue recovery.',
      'Review Smart Retries and the action after every retry fails.',
      'Choose the approved invoice/subscription behavior.',
      'Save and read back both the retry schedule and final action.']},
  customer_portal: {label:'Customer billing portal configuration',
    steps:['Open Stripe Billing settings and find Customer portal.',
      'Review payment-method updates and invoice visibility.',
      'Check whether cancellation or plan switching conflicts with your application.',
      'Save the intended changes and test the customer portal.']},
  two_step_login: {label:'Stripe account two-step authentication',
    steps:['Open Stripe Dashboard Settings, then your personal security settings.',
      'Find two-step authentication and enroll a secure authenticator.',
      'Verify the method is enabled before signing out.']},
  radar_rules: {label:'Radar fraud prevention rules',
    steps:['Open Stripe Dashboard and find Radar or fraud protection.',
      'Review active rules and their intended effect on payments.',
      'Make only the owner-approved rule changes.',
      'Check the resulting Radar rules and test behavior.']},
  statement_descriptor: {label:'Statement descriptor shown to customers',
    steps:['Open Stripe Settings and search for Public details or Statement descriptor.',
      'Confirm the recognizable business name fits Stripe requirements.',
      'Save it and read back the active descriptor.']},
  webhook_events: {label:'Webhook endpoint and subscribed events',
    steps:['Open Stripe Developers and find Webhooks or Event destinations.',
      'Select the correct account and test/live mode.',
      'Review the endpoint URL and subscribed event list.',
      'Read back the saved event selection and inspect delivery health.']}
});
export function whereIsSetting(value) {
  const key=String(value ?? '').trim().toLowerCase().replace(/[ -]+/g,'_');
  const data=DASHBOARD_SETTINGS[key];
  if (!data) return {found:false,query:key,supported:Object.keys(DASHBOARD_SETTINGS)};
  return {found:true,setting:key,title:data.label,
    dashboardUrl:'https://dashboard.stripe.com/settings',
    steps:data.steps.map((step,i)=>({number:i+1,action:step})),
    verification:'Read the saved setting directly in the selected Stripe account and mode.',
    changeMade:false};
}
