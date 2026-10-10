// Stripe-account monetary safeguards. Only US dollars can be compared to the
// owner-configured dollar cap. Do not mix EUR/JPY minor units into one total.
export function formatUsd(amountCents) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new TypeError('Money must use nonnegative integer cents from the provider');
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format(amountCents / 100);
}
export function prepareMoney(value) {
  if (!value || !Number.isSafeInteger(value.amountCents) || value.amountCents <= 0 ||
    value.currency !== 'usd' || !['in', 'out', 'change'].includes(value.direction) ||
    typeof value.description !== 'string' || value.description.length < 1 ||
    value.description.length > 150 || /[\r\n]/.test(value.description)) {
    throw new TypeError('Verified USD money amount and short safe description required');
  }
  const verb = value.direction === 'out' ? 'Money out' : value.direction === 'in' ? 'Money in' : 'Money change';
  return { ...value, previewLine: verb + ': ' + formatUsd(value.amountCents) +
    ' USD — ' + value.description + '. TEST MODE.' };
}

export async function reserveMoneyBeforeWrite({ ctx, key, prepared }) {
  if (!prepared) return { accepted: true };
  if (prepared.direction !== 'out') return { accepted: true };
  if (ctx?.moneyPolicyApproved !== true) {
    return { accepted: false, reason: 'Owner must approve the daily money-out limit before spending' };
  }
  if (typeof ctx.connectionId !== 'string' || !ctx.connectionId ||
    typeof ctx.db?.reserveMoneyOut !== 'function' || typeof ctx.db?.settleMoneyReservation !== 'function') {
    return { accepted: false, reason: 'Account connection or atomic money ledger unavailable' };
  }
  const attempt = await ctx.db.reserveMoneyOut({
    account: ctx.connection.stripeAccount, connection: ctx.connectionId,
    idempotencyKey: key, amountCents: prepared.amountCents, currency: prepared.currency });
  if (attempt?.decision !== 'reserved') {
    return { accepted: false,
      reason: attempt?.decision === 'limit_exceeded'
        ? 'Daily money-out limit exceeded. No Stripe write was made.'
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
