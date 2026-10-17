// Stripe-account monetary safeguards. Only US dollars can be compared to the
// owner-configured dollar cap. Do not mix EUR/JPY minor units into one total.
export function formatUsd(amountCents) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new TypeError('Money must use nonnegative integer cents from the provider');
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format(amountCents / 100);
}
export function prepareMoney(value, mode = 'test') {
  if (!value || !Number.isSafeInteger(value.amountCents) || value.amountCents <= 0 ||
    value.currency !== 'usd' || !['in', 'out', 'change'].includes(value.direction) ||
    typeof value.description !== 'string' || value.description.length < 1 ||
    value.description.length > 150 || /[\r\n]/.test(value.description) ||
    (value.direction === 'out' &&
      (typeof value.targetId !== 'string' ||
      !/^(?:ch|py|po|tr|re|pi|in|cus|acct|ba|src|pm|sub|txn|bt|du)_[A-Za-z0-9]{2,100}$/.test(value.targetId)))) {
    throw new TypeError('Verified USD money amount and short safe description required');
  }
  const verb = value.direction === 'out' ? 'Money out' : value.direction === 'in' ? 'Money in' : 'Money change';
  return { ...value, previewLine: verb + ': ' + formatUsd(value.amountCents) +
    ' USD — ' + value.description + (mode === 'live' ? '. LIVE MODE.' : '. TEST MODE.') };
}

export async function reserveMoneyBeforeWrite({ ctx, key, prepared, tool }) {
  if (!prepared) return { accepted: true };
  if (prepared.direction !== 'out') return { accepted: true };

  if (typeof ctx.connectionId !== 'string' || !ctx.connectionId ||
    typeof ctx.db?.reserveMoneyOut !== 'function' || typeof ctx.db?.settleMoneyReservation !== 'function' ||
    typeof ctx.db?.requestMoneyApproval !== 'function') {
    return { accepted: false, reason: 'Account connection or atomic money ledger unavailable' };
  }
  // Recording a pending request cannot authorize it. Only a separate,
  // authenticated owner setup action may set approved_at in the database.
  // No caller-controlled confirm/approval/override flag is trusted.
  const requested = await ctx.db.requestMoneyApproval({
    account: ctx.connection.stripeAccount, idempotencyKey: key,
    tool, description: prepared.description, target: prepared.targetId,
    mode: ctx.connection.mode, amountCents: prepared.amountCents,
    currency: prepared.currency
  });
  if (!requested) return { accepted: false, reason: 'Invalid or expired money approval request; use a new requestKey' };
  const attempt = await ctx.db.reserveMoneyOut({
    account: ctx.connection.stripeAccount, connection: ctx.connectionId,
    idempotencyKey: key, amountCents: prepared.amountCents, currency: prepared.currency });
  if (attempt?.decision !== 'reserved') {
    return { accepted: false,
      reason: attempt?.decision === 'owner_approval_required'
        ? 'Your explicit approval is required for this exact money-out transaction. No Stripe write was made.'
        : attempt?.decision === 'limit_exceeded_override_required'
          ? 'Shared account daily limit exceeded; a separate explicit owner override is required. No Stripe write was made.'
          : attempt?.decision === 'delegated_limit_exceeded'
            ? 'Owner-selected delegated pass money ceiling exceeded. No Stripe write was made.'
            : attempt?.decision === 'delegated_pass_denied'
              ? 'The owner-issued pass is expired, revoked, or has no money-out authority. No Stripe write was made.'
              : 'Reservation refused (' + (attempt?.decision || 'unavailable') + '). No Stripe write was made.' };
  }
  return { accepted: true };
}
export async function settleMoneyAfterWrite({ ctx, key, prepared, status }) {
  if (prepared?.direction !== 'out') return;
  const settled = await ctx.db.settleMoneyReservation({
    account: ctx.connection.stripeAccount, connection: ctx.connectionId,
    idempotencyKey: key, state: status });
  if (!settled) throw new Error('Money reservation could not be settled');
}
