/**
 * Phase 1 forensic audit — shared finding model and money helpers.
 * READ-ONLY: nothing in lib/accountingAudit may write accounting data.
 */

export const SEVERITY = Object.freeze({
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'informational',
});

export const CONFIDENCE = Object.freeze({
  CONFIRMED: 'confirmed',
  HIGHLY_LIKELY: 'highly_likely',
  POSSIBLE: 'possible',
  REVIEW: 'requires_review',
});

/** Posted-status variants used inconsistently across the codebase (itself a finding). */
export const POSTED_STATUSES = ['posted', 'Posted', 'POSTED'];

/**
 * Convert Prisma Decimal | string | number to integer cents (exact, no float drift).
 * @param {unknown} value
 * @returns {number} integer cents
 */
export function toCents(value) {
  if (value === null || value === undefined) return 0;
  const str = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(str)) return 0;
  const negative = str.startsWith('-');
  const [wholeRaw, fracRaw = ''] = (negative ? str.slice(1) : str).split('.');
  const frac = (fracRaw + '00').slice(0, 2);
  const carry = fracRaw.length > 2 && Number(fracRaw[2]) >= 5 ? 1 : 0;
  const cents = Number(wholeRaw) * 100 + Number(frac) + carry;
  return negative ? -cents : cents;
}

/** @param {number} cents */
export function centsToAmount(cents) {
  return cents / 100;
}

/**
 * @param {object} input
 * @param {string} input.ruleCode
 * @param {string} input.severity
 * @param {string} input.category
 * @param {string|null} [input.tenantId]
 * @param {string} [input.module]
 * @param {string} [input.entityType]
 * @param {string|null} [input.entityId]
 * @param {string} input.description
 * @param {string} [input.expected]
 * @param {string} [input.actual]
 * @param {number|null} [input.differenceAmount]
 * @param {string} [input.confidence]
 * @param {string} [input.recommendation]
 * @param {object} [input.evidence]
 */
export function makeFinding({
  ruleCode,
  severity,
  category,
  tenantId = null,
  module = 'accounting',
  entityType = null,
  entityId = null,
  description,
  expected = null,
  actual = null,
  differenceAmount = null,
  confidence = CONFIDENCE.CONFIRMED,
  recommendation = null,
  evidence = null,
}) {
  return {
    ruleCode,
    severity,
    category,
    tenantId,
    module,
    entityType,
    entityId,
    description,
    expected,
    actual,
    differenceAmount,
    confidence,
    recommendation,
    evidence,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Signed journal-derived balance in cents for the account's normal side.
 * Assets/Expenses (or normalBalance=Debit): debits - credits. Otherwise credits - debits.
 */
export function derivedBalanceCents(account, debitCents, creditCents) {
  const type = account.accountType || account.type || '';
  const debitNormal =
    type === 'Asset' || type === 'Expense' || account.normalBalance === 'Debit';
  return debitNormal ? debitCents - creditCents : creditCents - debitCents;
}
