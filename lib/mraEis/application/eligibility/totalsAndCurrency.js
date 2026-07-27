/**
 * Currency, exact decimal, and totals reconciliation — Phase 11.
 * Uses integer minor units via lib/money.js. Source totals are not mutated.
 */
import { toMinor, fromMinor, parseMoney } from '../../../money.js';

export const TOTALS_RECONCILIATION_VERSION = 'phase11-totals-v1';
export const CURRENCY_POLICY_VERSION = 'phase11-currency-v1';
export const DECIMAL_POLICY_VERSION = 'phase11-decimal-v1';

const DEFAULT_TOLERANCE_MINOR = 1; // 0.01
const SUPPORTED_CURRENCIES = new Set(['MWK']);

function minor(v) {
  if (v == null || v === '') return 0;
  return toMinor(v);
}

export function validateSalesCurrency({
  sourceCurrency = 'MWK',
  businessBaseCurrency = 'MWK',
  paymentCurrencies = [],
  exchangeRate = null,
} = {}) {
  const blockers = [];
  const warnings = [];
  const currency = String(sourceCurrency || 'MWK').toUpperCase();

  if (!SUPPORTED_CURRENCIES.has(currency)) {
    blockers.push('UNSUPPORTED_CURRENCY');
    blockers.push('MRA_CURRENCY_CONTRACT_UNVERIFIED');
  }
  if (currency !== String(businessBaseCurrency || 'MWK').toUpperCase()) {
    warnings.push('SOURCE_CURRENCY_DIFFERS_FROM_BASE');
    if (exchangeRate == null) blockers.push('EXCHANGE_RATE_REQUIRED');
  }
  const payCurrencies = [
    ...new Set((paymentCurrencies || []).map((c) => String(c || currency).toUpperCase())),
  ];
  if (payCurrencies.length > 1) blockers.push('MIXED_PAYMENT_CURRENCIES_UNSUPPORTED');

  return {
    valid: blockers.length === 0,
    currency,
    blockers,
    warnings,
    policyVersion: CURRENCY_POLICY_VERSION,
  };
}

export function validateSalesDecimals({
  quantity,
  unitPrice,
  discountAmount = 0,
  taxAmount = 0,
  levyAmount = 0,
  netAmount = 0,
  grossAmount = 0,
  paymentAmount = 0,
  amountTendered = null,
  changeGiven = null,
} = {}) {
  const blockers = [];
  const warnings = [];
  const moneyFields = {
    unitPrice,
    discountAmount,
    taxAmount,
    levyAmount,
    netAmount,
    grossAmount,
    paymentAmount,
    amountTendered,
    changeGiven,
  };

  for (const [name, value] of Object.entries(moneyFields)) {
    if (value == null) continue;
    try {
      const n = parseMoney(value);
      if (!Number.isFinite(n)) blockers.push(`DECIMAL_INVALID_${name.toUpperCase()}`);
      if (n < 0 && !['discountAmount', 'changeGiven'].includes(name)) {
        if (['unitPrice', 'grossAmount', 'netAmount', 'paymentAmount'].includes(name)) {
          blockers.push(`NEGATIVE_AMOUNT_${name.toUpperCase()}`);
        }
      }
    } catch {
      blockers.push(`DECIMAL_PARSE_${name.toUpperCase()}`);
    }
  }

  if (quantity != null) {
    const q = Number(quantity);
    if (!Number.isFinite(q)) blockers.push('DECIMAL_INVALID_QUANTITY');
    if (q < 0) blockers.push('NEGATIVE_AMOUNT_QUANTITY');
    if (q === 0) blockers.push('ZERO_QUANTITY');
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
    policyVersion: DECIMAL_POLICY_VERSION,
  };
}

/**
 * Deterministic totals reconciler. Does not create balancing lines.
 */
export function reconcileSalesTotals({
  lineNetTotal = 0,
  lineTaxTotal = 0,
  lineLevyTotal = 0,
  lineGrossTotal = 0,
  lineDiscountTotal = 0,
  headerNetTotal = 0,
  headerTaxTotal = 0,
  headerLevyTotal = 0,
  headerDiscountTotal = 0,
  headerGrossTotal = 0,
  paymentTotal = 0,
  amountTendered = null,
  changeGiven = null,
  toleranceMinor = DEFAULT_TOLERANCE_MINOR,
} = {}) {
  const blockers = [];
  const warnings = [];

  const pairs = [
    ['NET', lineNetTotal, headerNetTotal],
    ['TAX', lineTaxTotal, headerTaxTotal],
    ['LEVY', lineLevyTotal, headerLevyTotal],
    ['DISCOUNT', lineDiscountTotal, headerDiscountTotal],
    ['GROSS', lineGrossTotal, headerGrossTotal],
  ];

  let maxDiff = 0;
  for (const [label, a, b] of pairs) {
    const diff = Math.abs(minor(a) - minor(b));
    if (diff > maxDiff) maxDiff = diff;
    if (diff > toleranceMinor) blockers.push(`TOTALS_MISMATCH_${label}`);
  }

  const payDiff = Math.abs(minor(paymentTotal) - minor(headerGrossTotal));
  if (payDiff > toleranceMinor) {
    if (minor(paymentTotal) === 0 && minor(headerGrossTotal) > 0) {
      warnings.push('PAYMENT_TOTAL_ZERO_CREDIT_CANDIDATE');
    } else {
      blockers.push('PAYMENT_TOTAL_MISMATCH');
    }
  }

  if (amountTendered != null) {
    const expectedChange = minor(amountTendered) - minor(headerGrossTotal);
    if (changeGiven != null && Math.abs(expectedChange - minor(changeGiven)) > toleranceMinor) {
      blockers.push('AMOUNT_TENDERED_CHANGE_MISMATCH');
    }
  }

  return {
    valid: blockers.length === 0,
    lineNetTotal: fromMinor(minor(lineNetTotal)),
    lineTaxTotal: fromMinor(minor(lineTaxTotal)),
    lineLevyTotal: fromMinor(minor(lineLevyTotal)),
    lineGrossTotal: fromMinor(minor(lineGrossTotal)),
    headerNetTotal: fromMinor(minor(headerNetTotal)),
    headerTaxTotal: fromMinor(minor(headerTaxTotal)),
    headerLevyTotal: fromMinor(minor(headerLevyTotal)),
    headerGrossTotal: fromMinor(minor(headerGrossTotal)),
    paymentTotal: fromMinor(minor(paymentTotal)),
    difference: fromMinor(maxDiff),
    tolerance: fromMinor(toleranceMinor),
    blockers,
    warnings,
    reconciliationVersion: TOTALS_RECONCILIATION_VERSION,
  };
}

export function sumMoney(values = []) {
  return fromMinor(values.reduce((acc, v) => acc + minor(v), 0));
}
