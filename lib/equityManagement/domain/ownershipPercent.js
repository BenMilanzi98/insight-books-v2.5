/**
 * Exact ownership percentage arithmetic (no IEEE float).
 * Stored as Decimal(18,8) in DB; computed in integer "percent-minor" units
 * where 1 unit = 0.00000001% and 100% = 10_000_000_000 units.
 */

import { ONE_HUNDRED_PERCENT_MINOR, OWNERSHIP_PERCENT_SCALE } from './enums.js';

export { ONE_HUNDRED_PERCENT_MINOR };

const FACTOR = 10 ** OWNERSHIP_PERCENT_SCALE;

export function percentToMinor(value) {
  if (value == null || value === '') return 0;
  const s = String(value).replace(/,/g, '').trim();
  const neg = s.startsWith('-');
  const raw = neg ? s.slice(1) : s;
  const [whole, frac = ''] = raw.split('.');
  const padded = (frac + '0'.repeat(OWNERSHIP_PERCENT_SCALE)).slice(0, OWNERSHIP_PERCENT_SCALE);
  const minor = BigInt(whole || '0') * BigInt(FACTOR) + BigInt(padded || '0');
  return Number(neg ? -minor : minor);
}

export function minorToPercentString(minor) {
  const n = BigInt(minor || 0);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / BigInt(FACTOR);
  const frac = (abs % BigInt(FACTOR)).toString().padStart(OWNERSHIP_PERCENT_SCALE, '0');
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

export function sumPercentMinors(values) {
  return values.reduce((s, v) => s + Number(v || 0), 0);
}

export function assertOwnershipTotalWithinLimit(percentMinors, { allowEqual = true } = {}) {
  const total = sumPercentMinors(percentMinors);
  if (total < 0) {
    throw Object.assign(new Error('Ownership percentage cannot be negative.'), {
      code: 'INVALID_OWNERSHIP_PERCENTAGE',
    });
  }
  if (allowEqual ? total > ONE_HUNDRED_PERCENT_MINOR : total >= ONE_HUNDRED_PERCENT_MINOR) {
    throw Object.assign(
      new Error(`Ownership percentage total ${minorToPercentString(total)}% exceeds 100%.`),
      { code: 'OWNERSHIP_PERCENTAGE_EXCEEDED', totalMinor: total }
    );
  }
  return total;
}

/** Share capital at nominal: qty * nominal (both decimal strings) → minor money via parseDecimalToMinor externally. */
export function shareCapitalAndPremium({ quantity, nominalValue, issuePrice }) {
  const qty = Number(quantity);
  const nom = Number(nominalValue);
  const price = Number(issuePrice);
  if (!(qty > 0) || !(nom >= 0) || !(price >= 0)) {
    throw Object.assign(new Error('Invalid share quantity / nominal / issue price.'), {
      code: 'INVALID_SHARE_QUANTITY',
    });
  }
  if (price < nom) {
    throw Object.assign(new Error('Issue price cannot be below nominal value.'), {
      code: 'INVALID_ISSUE_PRICE',
    });
  }
  const shareCapital = qty * nom;
  const premium = qty * (price - nom);
  return {
    shareCapital: shareCapital.toFixed(2),
    premium: premium.toFixed(2),
    totalConsideration: (qty * price).toFixed(2),
  };
}
