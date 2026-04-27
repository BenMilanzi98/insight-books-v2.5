/**
 * Malawi monthly PAYE (Pay As You Earn), marginal slabs (2026).
 * Apply each rate only to the slice of **taxable** income in that band (never flat-rate the whole salary).
 *
 * Bands (monthly taxable income, MWK):
 * - 0 – 170,000: 0%
 * - 170,001 – 1,570,000: 30%
 * - 1,570,001 – 10,000,000: 35%
 * - Above 10,000,000: 40%
 *
 * Callers should pass **taxable income** (e.g. gross minus employee pension/NPS) — see `calculateMalawiPayroll`.
 */

/** Upper inclusive bounds of each slab on monthly taxable income (MWK). Last = Infinity. */
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
 * @param {number|string} monthlyTaxableIncome - Monthly taxable income in MWK (never negative; floored at 0)
 * @returns {{ payeAmount: number, breakdown: Array<{ bracket: string, taxableAmount: number, rate: number, tax: number }> }}
 */
export function computeMalawiPayeMonthly(monthlyTaxableIncome) {
  const taxable = Math.max(0, parseFloat(monthlyTaxableIncome) || 0);

  if (taxable <= 0) {
    return { payeAmount: 0, breakdown: [] };
  }

  let prevTop = 0;
  let total = 0;
  const breakdown = [];

  for (let i = 0; i < MALAWI_PAYE_MONTHLY_CEILINGS.length; i++) {
    if (taxable <= prevTop) break;

    const ceiling = MALAWI_PAYE_MONTHLY_CEILINGS[i];
    const rate = MALAWI_PAYE_MONTHLY_RATES[i];
    const sliceEnd = Math.min(taxable, ceiling);
    const sliceTaxable = sliceEnd - prevTop;

    if (sliceTaxable > 0) {
      const tax = sliceTaxable * rate;
      total += tax;
      breakdown.push({
        bracket: BRACKET_LABELS[i],
        taxableAmount: round2(sliceTaxable),
        rate: rate * 100,
        tax: round2(tax),
      });
    }

    prevTop = sliceEnd;
    if (taxable <= ceiling) break;
  }

  return {
    payeAmount: Math.max(0, round2(total)),
    breakdown,
  };
}
