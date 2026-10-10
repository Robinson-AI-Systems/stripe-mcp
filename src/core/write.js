// Reusable write lifecycle. Provider-specific idempotency and money rules are injected.
// No network calls or provider modules may be imported here.
const result = (value, isError = false) => ({
  ...(isError ? { isError: true } : {}),
  content: [{ type: 'text', text: JSON.stringify(value) }]
});
const allowedModes = new Set(['test']); // B-2 owns the deliberate live-mode activation.
const allowedProfiles = new Set(['everyday', 'full']);
const allowedReturn = new Set(['before', 'after', 'idempotencyKey']);

/**
 * Define one fully guarded write procedure. A-5/B-1a do not register write
 * tools: this function is infrastructure, not a bypass around the MCP boundary.
 *
 * read(args,ctx)       -> authoritative current provider state
 * summarize(before)    -> safe human-readable preview without raw private data
 * apply(args,ctx,opts) -> actual provider operation (only after confirmation)
 * readAfter(args,ctx)  -> independently read back the result
 * verify(before,after) -> whether the requested effect really happened
 * idempotency(ctx,tool,args) -> stable retry key, injected by provider adapter
 */
export function defineWrite({
  name, read, summarize, apply, readAfter, verify, idempotency,
  inverse = () => null, needsConfirm = true
}) {
  if (!/^[a-z][a-z0-9_]{1,48}$/.test(name)) throw new TypeError('A valid tool name is required');
  for (const [label, fn] of Object.entries({ read, summarize, apply, readAfter, verify, idempotency, inverse })) {
    if (typeof fn !== 'function') throw new TypeError(name + ': ' + label + ' must be a function');
  }
  if (needsConfirm !== true) {
    throw new Error('Unconfirmed writes cannot be enabled before the safety gates are complete');
  }
  const tool = Object.freeze({
    name, description: 'Guarded write: previews and requires explicit confirmation.',
    writes: true, writeContract: 'defineWrite-v1',
    inputSchema: { type: 'object', properties: {
      dryRun: { type: 'boolean' }, confirm: { type: 'boolean' },
      requestKey: { type: 'string', maxLength: 128 }
    }, additionalProperties: true }
  });
  async function handler(args, ctx) {
    // Identity is created by OAuth, never supplied by arbitrary tool arguments.
    const connection = ctx?.connection;
    if (!connection?.stripeAccount || !allowedModes.has(connection.mode) ||
        !allowedProfiles.has(connection.profile)) {
      return result({ done: false, error: 'Writing is not authorized for this connection' }, true);
    }
    if (!ctx.db || typeof ctx.db.recordChange !== 'function') {
      return result({ done: false, error: 'Audit storage is unavailable: write refused' }, true);
    }
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      return result({ done: false, error: 'Invalid tool arguments' }, true);
    }
    // Reject fabricated flags instead of silently enabling an action.
    if ((args.dryRun !== undefined && typeof args.dryRun !== 'boolean') ||
        (args.confirm !== undefined && typeof args.confirm !== 'boolean')) {
      return result({ done: false, error: 'dryRun and confirm must be booleans' }, true);
    }
    const before = await read(args, ctx);
    const summary = await summarize(before, args, ctx);
    if (typeof summary !== 'string' || !summary || summary.length > 1024) {
      return result({ done: false, error: 'A safe preview is required before writing' }, true);
    }
    const preview = { done: false, mode: connection.mode, preview: summary,
      needsConfirmation: args.confirm !== true };
    if (args.dryRun === true) {
      await ctx.db.recordChange({ account: connection.stripeAccount, mode: connection.mode,
        connection: ctx.connectionId ?? null, tool: name, summary, dryRun: true });
      return result(preview);
    }
    if (args.confirm !== true) return result({ ...preview, prompt: 'Review the preview, then set confirm: true' });
    const key = idempotency(connection, name, args);
    if (typeof key !== 'string' || !key.startsWith('rmcp_')) {
      return result({ done: false, error: 'A stable idempotency key is required' }, true);
    }
    // Persist the intent before any external write. On failure, never run apply.
    await ctx.db.recordChange({ account: connection.stripeAccount, mode: connection.mode,
      connection: ctx.connectionId ?? null, tool: name,
      summary: 'PENDING: ' + summary, dryRun: true, idempotencyKey: key });
    let observed;
    try {
      await apply(args, ctx, { idempotencyKey: key, before });
      observed = await readAfter(args, ctx);
    } catch {
      // Stripe might have completed a request before the network failed.
      // Never claim "failed" or retry with a different key; result is unknown.
      return result({ done: false, confirmed: false, idempotencyKey: key,
        warning: 'Stripe result uncertain; check the object before retrying with the same request key' }, true);
    }
    const confirmed = await verify(before, observed, args, ctx) === true;
    const inverseOperation = confirmed ? await inverse(before, observed, args, ctx) : null;
    await ctx.db.recordChange({ account: connection.stripeAccount, mode: connection.mode,
      connection: ctx.connectionId ?? null, tool: name, summary,
      before: null, after: null, dryRun: false,
      idempotencyKey: key, inverse: inverseOperation });
    return result({ done: confirmed, confirmed, mode: connection.mode,
      idempotencyKey: key, summary,
      ...(!confirmed ? { warning: 'Read-back did not confirm the requested change' } : {}) });
  }
  return Object.freeze({ tool, handler });
}
