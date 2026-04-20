/**
 * Malawi monthly PAYE (Pay As You Earn), marginal slabs.
 * Source bands (2025/26 — align with MRA guidance in product copy):
 * - MWK 0 – 170,000: 0%
 * - MWK 170,001 – 1,570,000: 30%
 * - MWK 1,570,001 – 10,000,000: 35%
 * - Above MWK 10,000,000: 40%
 *
 * Implemented as successive ceilings on cumulative gross (no double-counting).
 */

/** Upper inclusive bounds of each slab on monthly gross (MWK). Last = Infinity. */
export const MALAWI_PAYE_MONTHLY_CEILINGS = [170_000, 1_570_000, 10_000_000, Number.POSITIVE_INFINITY];

/** Rate applying to income in each slab (same length as ceilings). */
export const MALAWI_PAYE_MONTHLY_RATES = [0, 0.3, 0.35, 0.4];

const BRACKET_LABELS = [
  'Up to MK 170,000 (tax-free)',
  'MK 170,001 – 1,570,000',
  'MK 1,570,001 – 10,000,000',
  'Above MK 10,000,000',
];

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * @param {number|string} grossSalary - Monthly gross in MWK
 * @returns {{ payeAmount: number, breakdown: Array<{ bracket: string, taxableAmount: number, rate: number, tax: number }> }}
 */
export function computeMalawiPayeMonthly(grossSalary) {
  const gross = Math.max(0, parseFloat(grossSalary) || 0);

  if (gross <= 0) {
    return { payeAmount: 0, breakdown: [] };
  }

  let prevTop = 0;
  let total = 0;
  const breakdown = [];

  for (let i = 0; i < MALAWI_PAYE_MONTHLY_CEILINGS.length; i++) {
    if (gross <= prevTop) break;

    const ceiling = MALAWI_PAYE_MONTHLY_CEILINGS[i];
    const rate = MALAWI_PAYE_MONTHLY_RATES[i];
    const sliceEnd = Math.min(gross, ceiling);
    const taxable = sliceEnd - prevTop;

    if (taxable > 0) {
      const tax = taxable * rate;
      total += tax;
      breakdown.push({
        bracket: BRACKET_LABELS[i],
        taxableAmount: round2(taxable),
        rate: rate * 100,
        tax: round2(tax),
      });
    }

    prevTop = sliceEnd;
    if (gross <= ceiling) break;
  }

  return {
    payeAmount: round2(total),
    breakdown,
  };
}
