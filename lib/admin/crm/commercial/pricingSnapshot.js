/**
 * Immutable pricing snapshot builders — Phase 15 Wave 2.
 */

import { roundMoney } from './currencyFx.js';

/**
 * Build currency-explicit totals. Labels never swapped / never labelled as Revenue.
 */
export function buildCurrencyExplicitTotals({
  currency,
  listSubtotal,
  netSubtotal,
  taxTotal,
  lineSnapshots = [],
  inclusive = false,
} = {}) {
  const cur = currency ? String(currency).trim().toUpperCase() : null;
  const list = roundMoney(listSubtotal);
  const net = roundMoney(netSubtotal);
  const tax = roundMoney(taxTotal);
  // Inclusive: netSubtotal already includes tax — do not add taxTotal again.
  const grand = inclusive ? net : roundMoney(net + tax);

  let monthly = 0;
  let annual = 0;
  let oneTime = 0;

  for (const line of lineSnapshots) {
    const amount = Number(line.netAmount) || 0;
    const freq = String(line.billingFrequency || 'MONTHLY').toUpperCase();
    if (freq === 'MONTHLY') monthly += amount;
    else if (freq === 'ANNUAL') annual += amount;
    else if (freq === 'QUARTERLY') monthly += amount / 3;
    else if (freq === 'ONE_TIME') oneTime += amount;
    else monthly += amount;
  }

  monthly = roundMoney(monthly);
  annual = roundMoney(annual + monthly * 12);
  const firstYearTotal = roundMoney(monthly * 12 + oneTime + (annual > monthly * 12 ? 0 : 0));
  // Prefer explicit annual lines + monthly*12 + one-time
  const firstYear = roundMoney(
    oneTime +
      monthly * 12 +
      lineSnapshots
        .filter((l) => String(l.billingFrequency || '').toUpperCase() === 'ANNUAL')
        .reduce((s, l) => s + (Number(l.netAmount) || 0), 0)
  );
  const tcv = firstYear; // Wave 2 foundation: TCV = first-year unless term provided

  return Object.freeze({
    currency: cur,
    listSubtotal: list,
    netSubtotal: net,
    taxTotal: tax,
    grandTotal: grand,
    quotedMonthlyRecurring: monthly,
    quotedAnnualRecurring: roundMoney(monthly * 12),
    firstYearTotal: firstYear,
    totalContractValue: tcv,
  });
}

export function buildPricingSnapshotPayload({
  documentVersionId,
  priceBookVersionId,
  currency,
  calculationDate,
  lineSnapshots,
  totals,
  tax,
  discounts,
  fx,
  pricingExceptions,
} = {}) {
  return Object.freeze({
    documentVersionId,
    priceBookVersionId,
    currency,
    calculationDate,
    lines: lineSnapshots,
    totals,
    tax,
    appliedDiscountPercent: discounts?.appliedDiscountPercent || 0,
    pendingDiscounts: discounts?.pendingDiscounts || [],
    appliedDiscounts: discounts?.appliedDiscounts || [],
    fx: fx || null,
    pricingExceptions: pricingExceptions || [],
    opportunityEstimateUsed: false,
    tenantTaxPosted: false,
    mraEisFiscalSubmitted: false,
  });
}
