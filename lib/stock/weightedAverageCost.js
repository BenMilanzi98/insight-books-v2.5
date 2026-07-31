/**
 * Exact weighted-average cost for Hybrid stock import/display.
 * Uses integer minor units (2 dp) for money; quantity uses 4 dp minor units.
 */

import { MONEY_FACTOR, parseMoney, roundMoney } from '../money.js';

const QTY_FACTOR = 10000;

function toQtyMinor(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * QTY_FACTOR);
}

function fromQtyMinor(minor) {
  return minor / QTY_FACTOR;
}

/**
 * @param {{ quantity: number|string, unitCost: number|string }} existing
 * @param {{ quantity: number|string, unitCost: number|string }} incoming
 * @returns {{
 *   existingQuantity: number,
 *   existingValue: number,
 *   importedQuantity: number,
 *   importedValue: number,
 *   newQuantity: number,
 *   newValue: number,
 *   newWeightedAverageCost: number,
 * }}
 */
export function computeWeightedAverageAfterReceipt(existing, incoming) {
  const q0 = Number(existing?.quantity ?? 0);
  const c0 = parseMoney(existing?.unitCost ?? 0);
  const q1 = Number(incoming?.quantity ?? 0);
  const c1 = parseMoney(incoming?.unitCost ?? 0);

  if (!Number.isFinite(q0) || q0 < 0) throw new Error('Existing quantity must be >= 0.');
  if (!Number.isFinite(q1) || q1 <= 0) throw new Error('Imported quantity must be > 0.');
  if (c0 < 0 || c1 < 0) throw new Error('Unit cost must be >= 0.');

  const q0m = toQtyMinor(q0);
  const q1m = toQtyMinor(q1);
  if (!Number.isFinite(q0m) || !Number.isFinite(q1m)) throw new Error('Invalid quantity.');

  const c0m = Math.round(c0 * MONEY_FACTOR);
  const c1m = Math.round(c1 * MONEY_FACTOR);

  // value minor = qty_minor * cost_minor / QTY_FACTOR  → keep as (qty*cost) in money-minor * qty-scale
  // existingValueMajor = q0 * c0
  const existingValueMinor = Math.round((q0m * c0m) / QTY_FACTOR);
  const importedValueMinor = Math.round((q1m * c1m) / QTY_FACTOR);
  const newQtyMinor = q0m + q1m;
  const newValueMinor = existingValueMinor + importedValueMinor;

  if (newQtyMinor <= 0) throw new Error('New quantity must be > 0.');

  // WAC major = newValue / newQty → (newValueMinor/100) / (newQtyMinor/10000) = newValueMinor * 100 / newQtyMinor / 100
  // = newValueMinor * (QTY_FACTOR/MONEY_FACTOR) / newQtyMinor ... simplify:
  // wacMinor = round(newValueMinor * QTY_FACTOR / newQtyMinor) then / MONEY_FACTOR? 
  // valueMajor = newValueMinor/100; qtyMajor = newQtyMinor/10000
  // wac = valueMajor/qtyMajor = (newValueMinor/100) / (newQtyMinor/10000) = newValueMinor * 100 / newQtyMinor
  // wacMinor = round(wac * 100) = round(newValueMinor * 10000 / newQtyMinor) = round(newValueMinor * QTY_FACTOR / newQtyMinor)
  const wacMinor = Math.round((newValueMinor * QTY_FACTOR) / newQtyMinor);

  return {
    existingQuantity: fromQtyMinor(q0m),
    existingValue: existingValueMinor / MONEY_FACTOR,
    importedQuantity: fromQtyMinor(q1m),
    importedValue: importedValueMinor / MONEY_FACTOR,
    newQuantity: fromQtyMinor(newQtyMinor),
    newValue: newValueMinor / MONEY_FACTOR,
    newWeightedAverageCost: wacMinor / MONEY_FACTOR,
  };
}

/**
 * Display Order Price = WAC of remaining stock.
 * @param {{ quantity: number|string|null|undefined, totalValue: number|string|null|undefined, averageCost?: number|string|null }} product
 */
export function resolveOrderPriceForExport(product) {
  const qty = Number(product?.quantity ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) {
    return roundMoney(parseMoney(product?.averageCost ?? 0));
  }
  const value = parseMoney(product?.totalValue ?? 0);
  if (value <= 0) {
    return roundMoney(parseMoney(product?.averageCost ?? 0));
  }
  const qtyMinor = toQtyMinor(qty);
  const valueMinor = Math.round(value * MONEY_FACTOR);
  const wacMinor = Math.round((valueMinor * QTY_FACTOR) / qtyMinor);
  return wacMinor / MONEY_FACTOR;
}
