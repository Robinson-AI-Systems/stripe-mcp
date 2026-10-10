// Built for stripe-mcp; adapted from the nested-client fake pattern in google-workspace-mcp.
import Stripe from 'stripe';

/** Configurable proxy for any Stripe resource.method, including nested resources. */
export function makeFakeStripe({ livemode = false } = {}) {
  const calls = [];
  const responses = new Map();
  const when = (path) => ({
    resolves(value) { responses.set(path, { value }); return this; },
    rejects(error) { responses.set(path, { error }); return this; }
  });
  function resource(path = '') {
    const callable = async (params, options) => {
      calls.push({ path, params, options });
      const result = responses.get(path);
      if (result?.error) throw result.error;
      if (result && Object.hasOwn(result, 'value')) return result.value;
      throw new Error(`Unconfigured fake Stripe call: ${path}`);
    };
    return new Proxy(callable, {
      get(_target, prop) {
        if (prop === 'then') return undefined;
        if (typeof prop !== 'string') return undefined;
        return resource(path ? `${path}.${prop}` : prop);
      }
    });
  }
  return { stripe: resource(), calls, when, livemode };
}

/** Use the official SDK's error hierarchy, not an ad hoc Error subclass. */
export function stripeError(type = 'invalid_request_error', fields = {}) {
  return Stripe.errors.generate({ type, message: 'Test Stripe error', ...fields });
}
