export const TAX_PERIOD_STATUS = Object.freeze({
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  FILED: 'FILED',
});

export const TAX_RETURN_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  READY: 'READY',
  FILED: 'FILED',
  AMENDED: 'AMENDED',
});

export const TAX_PAYMENT_STATUS = Object.freeze({
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
});

export const TAX_REFUND_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
});

export const TAX_CREDIT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  APPLIED: 'APPLIED',
  VOID: 'VOID',
});

export const TAX_WITHHOLDING_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  REMITTED: 'REMITTED',
  REVERSED: 'REVERSED',
});

export function modelsAvailable(db, key) {
  return Boolean(db?.[key]?.create || db?.[key]?.findMany);
}
