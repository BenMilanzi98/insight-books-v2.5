/**
 * Cent-safe money arithmetic for MWK (2 decimal places).
 * Uses integer minor units internally to avoid IEEE-754 drift.
 */

export const MONEY_SCALE = 2;
export const MONEY_FACTOR = 100;

/** Default tolerance for "paid in full" / GL balance (half cent). */
export const MONEY_TOLERANCE = 0.005;

/** UI / allocation tolerance (1 cent). */
export const MONEY_TOLERANCE_CENT = 0.01;

/**
 * Parse user/API input to a finite number (strips commas).
 * @param {unknown} value
 * @returns {number}
 */
export function parseMoney(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const cleaned = String(value).replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Convert amount to integer minor units (cents).
 * @param {unknown} amount
 * @returns {number}
 */
export function toMinor(amount) {
  const n = parseMoney(amount);
  const sign = n < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(n) * MONEY_FACTOR + 1e-8);
}

/**
 * Convert minor units back to major units (2 dp).
 * @param {number} minor
 * @returns {number}
 */
export function fromMinor(minor) {
  const m = Number(minor);
  if (!Number.isFinite(m)) return 0;
  return m / MONEY_FACTOR;
}

/**
 * Round to 2 decimal places (half-up).
 * @param {unknown} amount
 * @returns {number}
 */
export function roundMoney(amount) {
  return fromMinor(toMinor(amount));
}

export function addMoney(...amounts) {
  let sum = 0;
  for (const a of amounts) {
    sum += toMinor(a);
  }
  return fromMinor(sum);
}

export function subtractMoney(a, b) {
  return fromMinor(toMinor(a) - toMinor(b));
}

/**
 * Multiply two monetary/scalar values (e.g. quantity × unit price, or amount × ratio).
 */
export function multiplyMoney(a, b) {
  const ma = toMinor(a);
  const mb = toMinor(b);
  return fromMinor(Math.round((ma * mb) / MONEY_FACTOR));
}

/**
 * amount * (ratePercent / 100), rounded to 2 dp
 */
export function percentOfMoney(amount, ratePercent) {
  const minor = toMinor(amount);
  const rate = parseMoney(ratePercent);
  return fromMinor(Math.round((minor * rate) / 100));
}

export function sumMoney(amounts) {
  if (!Array.isArray(amounts)) return 0;
  return addMoney(...amounts);
}

export function maxMoney(a, b) {
  return fromMinor(Math.max(toMinor(a), toMinor(b)));
}

export function minMoney(a, b) {
  return fromMinor(Math.min(toMinor(a), toMinor(b)));
}

export function clampMoney(amount, min = 0, max = Infinity) {
  return fromMinor(
    Math.min(Math.max(toMinor(amount), toMinor(min)), toMinor(max === Infinity ? 1e15 : max))
  );
}

/**
 * Compare two money amounts in minor units.
 * @returns {-1|0|1}
 */
export function compareMoney(a, b) {
  const da = toMinor(a) - toMinor(b);
  if (da < 0) return -1;
  if (da > 0) return 1;
  return 0;
}

export function moneyEquals(a, b, tolerance = MONEY_TOLERANCE) {
  return Math.abs(subtractMoney(a, b)) <= tolerance;
}

export function moneyGreaterOrEqual(a, b, tolerance = MONEY_TOLERANCE) {
  return compareMoney(a, b) >= 0 || moneyEquals(a, b, tolerance);
}

export function moneyLessOrEqual(a, b, tolerance = MONEY_TOLERANCE) {
  return compareMoney(a, b) <= 0 || moneyEquals(a, b, tolerance);
}

/**
 * Prisma Decimal / JSON-safe number for API responses and Float/Decimal writes.
 */
export function moneyToNumber(amount) {
  return roundMoney(amount);
}

/**
 * Serialize Prisma Decimal or number for JSON APIs.
 */
export function serializeMoney(value) {
  if (value == null) return null;
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return roundMoney(value.toNumber());
  }
  return roundMoney(value);
}
