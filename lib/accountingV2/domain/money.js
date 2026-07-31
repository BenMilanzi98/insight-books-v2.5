/**
 * Accounting V2 — monetary value object.
 *
 * Authoritative arithmetic uses integer minor units (delegating to `lib/money.js`,
 * the project's cent-safe utility). API boundaries exchange decimal strings; JS
 * floating point is never the authoritative representation.
 */

import { toMinor, fromMinor } from '../../money.js';
import { InvalidExchangeRateError, AccountingValidationError } from './errors.js';

export const DEFAULT_CURRENCY = 'MWK';
export const DEFAULT_SCALE = 2;

/** ISO-4217-shaped code check (uppercase alpha-3). */
const CURRENCY_RE = /^[A-Z]{3}$/;

/**
 * @typedef {object} MoneyValue
 * @property {number} minor integer minor units (authoritative)
 * @property {string} currency
 * @property {number} scale
 * @property {string} decimal decimal-string rendering, e.g. "1500.00"
 */

/**
 * Parse a decimal input (string preferred, Prisma Decimal, or number) to integer minor units.
 * Rejects non-finite, malformed, and unsafe values.
 * @param {unknown} input
 * @returns {number}
 */
export function parseDecimalToMinor(input) {
  if (input == null || input === '') {
    throw new AccountingValidationError('Monetary amount is required.', [
      { path: 'amount', message: 'missing amount' },
    ]);
  }
  if (typeof input === 'object' && typeof input.toString === 'function' && 'd' in input) {
    // Prisma Decimal — serialize to string first for exactness
    input = input.toString();
  }
  if (typeof input === 'string') {
    const trimmed = input.replace(/,/g, '').trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      throw new AccountingValidationError(`Invalid decimal amount: "${input}"`, [
        { path: 'amount', message: 'not a decimal string' },
      ]);
    }
    const negative = trimmed.startsWith('-');
    const [wholeRaw, fracRaw = ''] = (negative ? trimmed.slice(1) : trimmed).split('.');
    const frac = (fracRaw + '00').slice(0, DEFAULT_SCALE);
    const extra = fracRaw.slice(DEFAULT_SCALE);
    let minor = Number(wholeRaw) * 100 + Number(frac);
    // Half-up rounding on digits beyond the scale
    if (extra && Number(extra[0]) >= 5) minor += 1;
    if (!Number.isSafeInteger(minor)) {
      throw new AccountingValidationError('Amount exceeds the supported magnitude.', [
        { path: 'amount', message: 'unsafe integer' },
      ]);
    }
    return negative ? -minor : minor;
  }
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new AccountingValidationError('Amount must be a finite number.', [
        { path: 'amount', message: 'non-finite' },
      ]);
    }
    return toMinor(input);
  }
  throw new AccountingValidationError('Unsupported monetary input type.', [
    { path: 'amount', message: typeof input },
  ]);
}

/** @param {number} minor @returns {string} decimal string at scale 2 */
export function minorToDecimalString(minor) {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

/**
 * Create an immutable monetary value.
 * @param {unknown} amount decimal string (preferred), Prisma Decimal, or number
 * @param {string} [currency]
 * @returns {MoneyValue}
 */
export function money(amount, currency = DEFAULT_CURRENCY) {
  if (!CURRENCY_RE.test(currency)) {
    throw new AccountingValidationError(`Invalid currency code: "${currency}"`, [
      { path: 'currency', message: 'must be alpha-3 uppercase' },
    ]);
  }
  const minor = parseDecimalToMinor(amount);
  return Object.freeze({
    minor,
    currency,
    scale: DEFAULT_SCALE,
    decimal: minorToDecimalString(minor),
  });
}

/** @param {MoneyValue} a @param {MoneyValue} b */
function assertSameCurrency(a, b) {
  if (a.currency !== b.currency) {
    throw new AccountingValidationError(
      `Cannot combine ${a.currency} with ${b.currency} without an explicit conversion.`,
      [{ path: 'currency', message: 'currency mismatch' }]
    );
  }
}

/** @param {MoneyValue} a @param {MoneyValue} b @returns {MoneyValue} */
export function addMoneyValues(a, b) {
  assertSameCurrency(a, b);
  return money(minorToDecimalString(a.minor + b.minor), a.currency);
}

/** @param {MoneyValue} a @param {MoneyValue} b @returns {MoneyValue} */
export function subtractMoneyValues(a, b) {
  assertSameCurrency(a, b);
  return money(minorToDecimalString(a.minor - b.minor), a.currency);
}

/** @param {MoneyValue[]} values @param {string} currency */
export function sumMoneyValues(values, currency = DEFAULT_CURRENCY) {
  let total = 0;
  for (const v of values) {
    if (v.currency !== currency) assertSameCurrency({ currency }, v);
    total += v.minor;
  }
  return money(minorToDecimalString(total), currency);
}

/** @param {MoneyValue} v */
export function isZeroMoney(v) {
  return v.minor === 0;
}

/** @param {MoneyValue} v */
export function isNegativeMoney(v) {
  return v.minor < 0;
}

/**
 * Convert a transaction-currency amount to base currency at an explicit positive rate.
 * Rounds half-up at base-currency scale. Rate must be a positive decimal string/number.
 * @param {MoneyValue} value
 * @param {string|number} exchangeRate
 * @param {string} baseCurrency
 * @returns {MoneyValue}
 */
export function convertToBase(value, exchangeRate, baseCurrency = DEFAULT_CURRENCY) {
  const rate = typeof exchangeRate === 'string' ? Number(exchangeRate) : exchangeRate;
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new InvalidExchangeRateError({ diagnostic: { exchangeRate } });
  }
  if (value.currency === baseCurrency && rate === 1) return money(value.decimal, baseCurrency);
  const baseMinor = Math.round(value.minor * rate);
  if (!Number.isSafeInteger(baseMinor)) {
    throw new AccountingValidationError('Converted amount exceeds the supported magnitude.');
  }
  return money(minorToDecimalString(baseMinor), baseCurrency);
}

/** Legacy interop: render minor units as a JS number (for adapter comparisons only). */
export function minorToNumber(minor) {
  return fromMinor(minor);
}
