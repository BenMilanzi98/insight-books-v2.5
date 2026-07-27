/**
 * Platform (SaaS) billing helpers — separate from tenant AR Invoice/Payment.
 * Idempotency keys prevent duplicate invoices/payments on retry/callback replay.
 */

import { createHash } from 'crypto';

export function subscriptionPeriodKey({ subscriptionId, periodStart, periodEnd }) {
  return `${subscriptionId}:${periodStart}:${periodEnd}`;
}

export function invoiceIdempotencyKey({ tenantId, subscriptionId, periodStart, periodEnd }) {
  const raw = `plat-inv:${tenantId}:${subscriptionId}:${periodStart}:${periodEnd}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

export function paymentIdempotencyKey({ gateway, gatewayReference }) {
  const ref = String(gatewayReference || '').trim();
  if (!ref) return null;
  const raw = `plat-pay:${gateway || 'manual'}:${ref}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

export function creditIdempotencyKey({ tenantId, invoiceId, amount, reasonCode }) {
  const raw = `plat-credit:${tenantId}:${invoiceId || 'none'}:${amount}:${reasonCode || ''}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

export function refundIdempotencyKey({ paymentId, amount, gatewayReference }) {
  const raw = `plat-refund:${paymentId}:${amount}:${gatewayReference || 'manual'}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

export function planVersionKey({ planCode, version }) {
  return `${String(planCode).toLowerCase()}:v${Number(version)}`;
}

/**
 * Active plan prices must not be silently edited — create a new version instead.
 */
export function assertPlanPriceChangeCreatesVersion({ existingPrice, newPrice, forceNewVersion }) {
  if (existingPrice == null) return { ok: true, requiresNewVersion: false };
  if (Number(existingPrice) === Number(newPrice)) {
    return { ok: true, requiresNewVersion: false };
  }
  if (!forceNewVersion) {
    return {
      ok: false,
      error: 'Plan price changes require a new plan version (forceNewVersion: true)',
      requiresNewVersion: true,
    };
  }
  return { ok: true, requiresNewVersion: true };
}

export function allocatePayment({ invoiceOutstanding, paymentAmount }) {
  const outstanding = Number(invoiceOutstanding);
  const amount = Number(paymentAmount);
  if (!Number.isFinite(outstanding) || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Invalid amounts' };
  }
  const applied = Math.min(outstanding, amount);
  const overpayment = Math.max(0, amount - outstanding);
  const remaining = Math.max(0, outstanding - applied);
  return {
    ok: true,
    applied,
    overpayment,
    remaining,
    invoiceStatus: remaining === 0 ? 'PAID' : remaining < outstanding ? 'PARTIALLY_PAID' : 'ISSUED',
  };
}

export function assertNoDuplicateActiveSubscription(existingActiveCount) {
  if (Number(existingActiveCount) > 0) {
    return { ok: false, error: 'Tenant already has an active subscription' };
  }
  return { ok: true };
}

export function reconcileInvoiceLine({ subtotal, discount, tax, total }) {
  const expected = Number(subtotal) - Number(discount || 0) + Number(tax || 0);
  const actual = Number(total);
  const variance = Math.round((actual - expected) * 100) / 100;
  return {
    ok: Math.abs(variance) < 0.01,
    expected,
    actual,
    variance,
  };
}

/**
 * Compute next billing period from a subscription end date.
 * @param {'month'|'quarter'|'year'} cycle
 */
export function nextBillingPeriod({ periodEnd, cycle = 'month' }) {
  const start = periodEnd ? new Date(periodEnd) : new Date();
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: 'Invalid periodEnd' };
  }
  const periodStart = new Date(start);
  const periodEndNext = new Date(start);
  const c = String(cycle || 'month').toLowerCase();
  if (c === 'year' || c === 'annual') {
    periodEndNext.setFullYear(periodEndNext.getFullYear() + 1);
  } else if (c === 'quarter') {
    periodEndNext.setMonth(periodEndNext.getMonth() + 3);
  } else {
    periodEndNext.setMonth(periodEndNext.getMonth() + 1);
  }
  return {
    ok: true,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEndNext.toISOString(),
  };
}

/**
 * Build an idempotent renewal invoice create payload.
 */
export function buildRenewalInvoiceRequest({
  tenantId,
  subscriptionId,
  periodStart,
  periodEnd,
  currency = 'MWK',
  subtotal,
  discount = 0,
  tax = 0,
  planCode,
  planVersion,
}) {
  if (!tenantId || !subscriptionId) {
    return { ok: false, error: 'tenantId and subscriptionId are required' };
  }
  if (!(Number(subtotal) >= 0)) {
    return { ok: false, error: 'subtotal must be >= 0' };
  }
  const total = Math.round((Number(subtotal) - Number(discount || 0) + Number(tax || 0)) * 100) / 100;
  const idempotencyKey = invoiceIdempotencyKey({
    tenantId,
    subscriptionId,
    periodStart,
    periodEnd,
  });
  return {
    ok: true,
    body: {
      tenantId,
      subscriptionId,
      periodStart,
      periodEnd,
      currency,
      subtotal: Number(subtotal),
      discount: Number(discount || 0),
      tax: Number(tax || 0),
      total,
      status: 'ISSUED',
      idempotencyKey,
      planCode: planCode || null,
      planVersion: planVersion != null ? Number(planVersion) : null,
    },
  };
}

export function applyCreditToInvoice({ outstanding, creditAmount }) {
  const o = Number(outstanding);
  const c = Number(creditAmount);
  if (!Number.isFinite(o) || !Number.isFinite(c) || c <= 0) {
    return { ok: false, error: 'Invalid credit amounts' };
  }
  const applied = Math.min(o, c);
  const remainingCredit = Math.max(0, c - applied);
  const remainingOutstanding = Math.max(0, o - applied);
  return {
    ok: true,
    applied,
    remainingCredit,
    remainingOutstanding,
    invoiceStatus: remainingOutstanding === 0 ? 'CREDITED' : 'PARTIALLY_PAID',
  };
}

export function assertRefundWithinPaid({ amountPaid, alreadyRefunded, refundAmount }) {
  const paid = Number(amountPaid);
  const prev = Number(alreadyRefunded || 0);
  const refund = Number(refundAmount);
  if (!(refund > 0)) return { ok: false, error: 'Refund amount must be > 0' };
  if (refund + prev > paid + 0.001) {
    return { ok: false, error: 'Refund exceeds paid amount' };
  }
  return { ok: true };
}

/** Successful payment statuses that may allocate / activate. */
export const SUCCESS_PAYMENT_STATUSES = new Set([
  'COMPLETED',
  'SUCCESSFUL',
  'FULLY_ALLOCATED',
  'PARTIALLY_ALLOCATED',
]);

export function isSuccessfulPaymentStatus(status) {
  return SUCCESS_PAYMENT_STATUSES.has(String(status || '').toUpperCase());
}
