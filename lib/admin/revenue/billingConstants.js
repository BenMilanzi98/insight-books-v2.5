/**
 * Shared Wave 3 billing analytics constants.
 * PlatformInvoice / PlatformPayment / PlatformCredit / PlatformRefund only.
 */

/** Align with saasBillingKpis successful payment status list (collections). */
export const SUCCESSFUL_PAYMENT_STATUSES = Object.freeze([
  'COMPLETED',
  'SUCCESSFUL',
  'FULLY_ALLOCATED',
]);

export const FAILED_PAYMENT_STATUSES = Object.freeze([
  'FAILED',
  'DECLINED',
  'FAILURE',
]);

export const VOID_INVOICE_STATUSES = Object.freeze([
  'VOID',
  'VOIDED',
  'CANCELLED',
  'CANCELED',
]);

export const COMPLETED_REFUND_STATUSES = Object.freeze(['COMPLETED', 'SUCCESSFUL']);

export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function parseCurrencyOpt(currencyRaw) {
  const isCrossCurrency = currencyRaw === 'ALL' || currencyRaw === '*';
  const currency =
    !currencyRaw || isCrossCurrency ? null : String(currencyRaw).toUpperCase();
  return {
    isCrossCurrency,
    currency,
    defaultCurrency: currency || 'MWK',
  };
}
