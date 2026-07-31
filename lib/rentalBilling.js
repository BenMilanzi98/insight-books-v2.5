import { parseMoney, roundMoney, multiplyMoney } from '@/lib/money';

/**
 * Billable duration for rental/quantity-pool pricing (fractional units allowed).
 * @param {Date|string} startAt
 * @param {Date|string} endAt
 * @param {'day'|'hour'} rateUnit
 * @returns {number}
 */
export function computeBillableUnits(startAt, endAt, rateUnit = 'day') {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const ms = end - start;
  if (!(ms > 0)) {
    throw new Error('End time must be after start time.');
  }
  if (String(rateUnit).toLowerCase() === 'hour') {
    return ms / 3600000;
  }
  return ms / 86400000;
}

/**
 * Line total before tax: rate × billable units × quantity (cent-safe where practical).
 */
export function computeLineTotal(unitRate, billableUnits, quantity = 1) {
  const rate = parseMoney(unitRate);
  const units = Number(billableUnits) || 0;
  const qty = Number(quantity) || 1;
  // billableUnits can be fractional days — multiply then round
  return roundMoney(rate * units * qty);
}

export { parseMoney, roundMoney, multiplyMoney };
