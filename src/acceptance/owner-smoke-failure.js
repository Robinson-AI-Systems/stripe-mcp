// Owner-password-protected TEST diagnostic stages only. Never echo Stripe
// errors, account identifiers, authorization headers, credential bytes or URLs.
const advice=Object.freeze({
  not_enrolled:'This exact TEST account is not enrolled here. Check your original private account selection. No provider reads were attempted.',
  key_unavailable:'The enrolled encrypted TEST credential could not be loaded. Check secure server configuration. No provider reads were attempted.',
  provider_denied:'Stripe rejected the TEST identity read. Check restricted-key Account and Balance read permissions or key validity. No tool reads were attempted.',
  identity_unverified:'The exact account and independent TEST mode could not be verified. Check account selection and required identity/Balance read permissions. No tool reads were attempted.',
  identity_incomplete:'The verified TEST identity response lacked required safety fields. No tool reads were attempted.',
  tool_unavailable:'A registered read-only TEST tool contract is missing or no longer safe. The service needs repair.',
  report_rejected:'A TEST result failed the strict allowed read-only report format. The service needs repair.',
  unavailable:'The private TEST verification could not complete. Check server and provider health before retrying.'
});
export class OwnerSmokeFailure extends Error {
  constructor(stage) {
    super('Own TEST account verification failed; no other smoke reads executed');
    this.name='OwnerSmokeFailure';
    this.stage=Object.hasOwn(advice,stage)?stage:'unavailable';
  }
}
export function ownerSmokeFailureMessage(error) {
  const stage=error instanceof OwnerSmokeFailure?error.stage:'unavailable';
  return 'TEST stage: '+stage+'. '+advice[stage]+' No acceptance recorded.';
}
