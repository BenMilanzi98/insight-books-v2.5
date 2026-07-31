import { addMoney, parseMoney, percentOfMoney, roundMoney } from '@/lib/money';
import { computeBillableUnits } from '@/lib/rentalBilling';

/**
 * Versioned pricing explanation for outbound rentals (Decimal-safe).
 */
export function priceRentalLine({
  startAt,
  endAt,
  rateUnit = 'day',
  baseRate,
  quantity = 1,
  minimumCharge = 0,
  depositAmount = 0,
  deliveryCharge = 0,
  damageWaiver = 0,
  taxRatePercent = 0,
}) {
  const units = computeBillableUnits(startAt, endAt, rateUnit);
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  let base = roundMoney(parseMoney(baseRate) * units * qty);
  if (parseMoney(minimumCharge) > base) base = parseMoney(minimumCharge);

  const delivery = parseMoney(deliveryCharge);
  const waiver = parseMoney(damageWaiver);
  const subtotal = addMoney(base, delivery, waiver);
  const tax = percentOfMoney(subtotal, taxRatePercent);
  const total = addMoney(subtotal, tax);
  const deposit = parseMoney(depositAmount);

  return {
    billableUnits: units,
    quantity: qty,
    baseRental: base,
    delivery,
    damageWaiver: waiver,
    subtotal,
    tax,
    total,
    deposit,
    explanation: [
      { step: 'period', detail: `${units} ${rateUnit}(s) × qty ${qty}` },
      { step: 'base', detail: `Base rental ${base}` },
      delivery ? { step: 'delivery', detail: `Delivery ${delivery}` } : null,
      waiver ? { step: 'waiver', detail: `Damage waiver ${waiver}` } : null,
      { step: 'tax', detail: `Tax ${tax} (${taxRatePercent}%)` },
      { step: 'deposit', detail: `Refundable deposit ${deposit} (not revenue)` },
      { step: 'total', detail: `Invoiceable total ${total}` },
    ].filter(Boolean),
  };
}

export function pickActiveRatePlan(plans, asOf = new Date()) {
  const t = new Date(asOf).getTime();
  return (plans || [])
    .filter((p) => p.isActive !== false)
    .filter((p) => new Date(p.effectiveFrom).getTime() <= t)
    .filter((p) => !p.effectiveTo || new Date(p.effectiveTo).getTime() >= t)
    .sort((a, b) => b.version - a.version || new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0] || null;
}
