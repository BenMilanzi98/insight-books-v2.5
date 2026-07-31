import { addMoney, parseMoney, roundMoney } from '@/lib/money';
import { priceRentalLine } from './pricing.js';

/**
 * Unique key for a billed period — mirrors DB unique constraint.
 */
export function billingPeriodKey({
  tenantId,
  contractId,
  periodStart,
  periodEnd,
  pricingVersion = 1,
}) {
  return [
    tenantId,
    contractId,
    new Date(periodStart).toISOString(),
    new Date(periodEnd).toISOString(),
    String(pricingVersion || 1),
  ].join('|');
}

export function billingIdempotencyKey({
  tenantId,
  contractId,
  periodStart,
  periodEnd,
  pricingVersion = 1,
}) {
  return `bill:${billingPeriodKey({
    tenantId,
    contractId,
    periodStart,
    periodEnd,
    pricingVersion,
  })}`;
}

/**
 * Compute amount for a contract period from lines (no DB).
 */
export function computePeriodAmount(contract, { periodStart, periodEnd } = {}) {
  const start = periodStart ? new Date(periodStart) : new Date(contract.startAt);
  const end = periodEnd ? new Date(periodEnd) : new Date(contract.endAt);
  const lines = contract.lines || [];
  let total = 0;
  for (const line of lines) {
    const priced = priceRentalLine({
      startAt: start,
      endAt: end,
      rateUnit: line.billingUnit || 'day',
      baseRate: line.unitRate,
      quantity: line.quantity,
      minimumCharge: line.minimumCharge,
      depositAmount: 0,
      taxRatePercent: 0,
    });
    total = addMoney(total, priced.baseRental);
  }
  return roundMoney(parseMoney(total));
}
