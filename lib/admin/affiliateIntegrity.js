/**
 * Affiliate integrity helpers — pure, unit-testable.
 * Use for referral uniqueness and commission/payout idempotency keys.
 */

/**
 * Normalize and assert a referral code is unique against known codes.
 * @param {string} code
 * @param {Iterable<string>} existingCodes
 * @returns {string} normalized uppercase code
 */
export function assertUniqueReferralCode(code, existingCodes = []) {
  if (code == null || typeof code !== 'string' || !code.trim()) {
    throw new Error('Referral code is required');
  }
  const normalized = code.trim().toUpperCase();
  const set = new Set(
    [...existingCodes]
      .filter((c) => c != null && String(c).trim())
      .map((c) => String(c).trim().toUpperCase())
  );
  if (set.has(normalized)) {
    throw new Error('Referral code already exists');
  }
  return normalized;
}

/**
 * Stable idempotency key for a commission tied to a tenant payment/conversion.
 * @param {string} tenantId
 * @param {string} paymentIdOrConversionId
 * @returns {string}
 */
export function commissionIdempotencyKey(tenantId, paymentIdOrConversionId) {
  const t = String(tenantId || '').trim();
  const p = String(paymentIdOrConversionId || '').trim();
  if (!t || !p) {
    throw new Error('tenantId and paymentId/conversionId are required');
  }
  return `aff-comm:${t}:${p}`;
}

/**
 * Stable idempotency key for an affiliate payout period.
 * @param {string} affiliateId
 * @param {string} periodKey e.g. "2026-07" or "2026-W30"
 * @returns {string}
 */
export function payoutIdempotencyKey(affiliateId, periodKey) {
  const a = String(affiliateId || '').trim();
  const period = String(periodKey || '').trim();
  if (!a || !period) {
    throw new Error('affiliateId and periodKey are required');
  }
  return `aff-payout:${a}:${period}`;
}

/**
 * Mask bank / payment details for API responses — never return full secrets.
 * @param {unknown} paymentDetails
 * @returns {string|null}
 */
export function maskPaymentDetails(paymentDetails) {
  if (paymentDetails == null || paymentDetails === '') return null;
  const s = typeof paymentDetails === 'string' ? paymentDetails : JSON.stringify(paymentDetails);
  if (s.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(8, s.length - 4))}${s.slice(-4)}`;
}

/**
 * Compute commission amount from a verified platform payment.
 */
export function calculateCommission({ paymentAmount, commissionRatePercent }) {
  const amount = Number(paymentAmount);
  const rate = Number(commissionRatePercent);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Invalid payment amount' };
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return { ok: false, error: 'Invalid commission rate' };
  }
  const commission = Math.round(((amount * rate) / 100) * 100) / 100;
  return { ok: true, commission };
}

/**
 * Reverse commission safely after refund (idempotent via reverseKey).
 */
export function commissionReversalKey(originalIdempotencyKey) {
  const k = String(originalIdempotencyKey || '').trim();
  if (!k) throw new Error('originalIdempotencyKey required');
  return `aff-comm-rev:${k}`;
}
