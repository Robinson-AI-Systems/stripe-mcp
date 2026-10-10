// Safe, human-readable Stripe errors. No provider message or secret is echoed.
// The Stripe request ID is the only diagnostic identifier returned to an agent.
import Stripe from 'stripe';

const safeCode = value => typeof value === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(value)
  ? value : null;
const safeParam = value => typeof value === 'string' &&
  /^[a-zA-Z][a-zA-Z0-9_\[\].]{0,90}$/.test(value) ? value : null;
const safeRequest = value => typeof value === 'string' && /^req_[A-Za-z0-9]{6,100}$/.test(value)
  ? value : null;
const safePermission = value => typeof value === 'string' &&
  /^[a-z][a-z_]{1,50}$/.test(value) ? value : null;

export function isStripeFailure(error) {
  return error instanceof Stripe.errors.StripeError;
}

export function describeStripeFailure(error, { mode = 'test',
  requiredPermission = null, otherModeObjectVerified = false, requirementsDue = [] } = {}) {
  if (!isStripeFailure(error)) return null;
  const code = safeCode(error.code);
  const param = safeParam(error.param);
  const requestId = safeRequest(error.requestId || error.request_id);
  const type = safeCode(error.type) || 'stripe_error';
  const technical = 'Stripe error: ' + type +
    (code ? ' / ' + code : '') +
    (param ? ' / field ' + param : '') +
    ' / request ' + (requestId || 'unavailable');
  let whatHappened = 'Stripe could not complete the operation.';
  let likelyCause = 'Stripe did not provide a safe, specific reason.';
  let whatToDo = 'Review the operation and your Stripe dashboard before attempting it again.';

  const due = Array.isArray(requirementsDue) ?
    requirementsDue.filter(item => safeParam(item)).slice(0,5) : [];
  if (code === 'account_invalid' || code === 'account_not_activated' ||
      code === 'account_not_ready' || due.length) {
    whatHappened = 'The Stripe account is not ready for this action.';
    likelyCause = due.length ? 'Stripe still needs: ' + due.join(', ') + '.' :
      'Stripe account activation or verification may be incomplete.';
    whatToDo = 'Open Stripe Dashboard → Account requirements and complete the missing checks.';
  } else if (error instanceof Stripe.errors.StripeCardError) {
    const guidance = {
      insufficient_funds: ['The payment method was declined for insufficient funds.',
        'The card does not have sufficient available funds.',
        'Ask the customer to use another payment method or contact their bank.'],
      expired_card: ['The payment method was declined because the card expired.',
        'The card expiry date is no longer valid.',
        'Ask the customer to update their card.'],
      incorrect_cvc: ['The payment method was declined due to a security code mismatch.',
        'The card security code may be incorrect.',
        'Ask the customer to verify their card details and try again.'],
      do_not_honor: ['The bank declined the payment.',
        'The issuing bank declined authorization.',
        'Ask the customer to contact their bank or use another payment method.']
    };
    [whatHappened, likelyCause, whatToDo] = guidance[safeCode(error.decline_code)] ||
      ['The bank declined this payment.', 'The issuer did not authorize this payment.',
        'Ask the customer to try another card or contact their bank.'];
  } else if (error instanceof Stripe.errors.StripeAuthenticationError) {
    whatHappened = 'Stripe rejected this connection’s API key.';
    likelyCause = 'The key may have been revoked, rotated or entered for the wrong mode.';
    whatToDo = 'Recheck the key in the private owner setup page. Never paste the key into AI chat.';
  } else if (error instanceof Stripe.errors.StripePermissionError) {
    const permission = safePermission(requiredPermission);
    whatHappened = 'This Stripe key cannot perform the requested operation.';
    likelyCause = permission ? 'Its restricted-key permission for ' + permission +
      ' may be disabled.' : 'The restricted API key lacks the required permission.';
    whatToDo = permission ? 'In Stripe Dashboard → Developers → API keys, review the ' +
      permission + ' permission on the restricted key.' :
      'In Stripe Dashboard → Developers → API keys, review the key permissions.';
  } else if (error instanceof Stripe.errors.StripeIdempotencyError) {
    whatHappened = 'Stripe refused a conflicting retry.';
    likelyCause = 'The same retry identifier was used for a different operation.';
    whatToDo = 'Inspect the original operation and its result before considering a new request key.';
  } else if (error instanceof Stripe.errors.StripeRateLimitError) {
    whatHappened = 'Stripe is temporarily limiting requests.';
    likelyCause = 'Too many Stripe requests arrived within a short period.';
    whatToDo = 'Reduce concurrent requests and retry with the same idempotency key after a delay.';
  } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    if (code === 'resource_missing') {
      whatHappened = 'The Stripe object could not be found in this account or mode.';
      likelyCause = otherModeObjectVerified ?
        'A matching object was independently verified in the other Stripe mode.' :
        'The object ID, selected account or ' + (mode === 'live' ? 'LIVE' : 'TEST') +
        ' mode may be incorrect.';
      whatToDo = 'Check the selected account, object ID and TEST/LIVE mode before retrying.';
    } else {
      whatHappened = 'Stripe rejected a field in this request.';
      likelyCause = param ? 'The parameter ' + param + ' was not accepted.' :
        'The request did not match Stripe’s accepted parameters.';
      whatToDo = 'Check the documented Stripe request fields and retry after correction.';
    }
  }
  return Object.freeze({whatHappened, likelyCause, whatToDo, technical});
}

export function toStripeToolError(error, options = {}) {
  const details = describeStripeFailure(error, options);
  if (!details) return null;
  return {isError:true,content:[{type:'text',text:JSON.stringify({done:false,
    whatHappened:details.whatHappened, likelyCause:details.likelyCause,
    whatToDo:details.whatToDo, technical:details.technical})}]};
}
