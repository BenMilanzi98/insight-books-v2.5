/**
 * Per-unit cost for a goods receipt line so inventory matches the purchase order
 * when the PO has line taxes.
 *
 * - If `pricesIncludeTax` is true, `unitCost` on the PO line is already tax-inclusive.
 * - If false, line tax is spread over `quantityOrdered` so partial receipts use the same rate.
 *
 * @param {object} poLine - PurchaseOrderItem-like { unitCost, quantityOrdered, taxAmount }
 * @param {boolean} pricesIncludeTax - PurchaseOrder.pricesIncludeTax
 * @returns {number}
 */
export function receiptUnitCostFromPurchaseOrderLine(poLine, pricesIncludeTax) {
  const unitCost = Number(poLine?.unitCost ?? 0);
  const ordered = Number(poLine?.quantityOrdered ?? 0);
  const taxAmount = Number(poLine?.taxAmount ?? 0);

  let out;
  if (pricesIncludeTax) {
    out = unitCost;
  } else if (ordered <= 0 || !taxAmount) {
    out = unitCost;
  } else {
    out = unitCost + taxAmount / ordered;
  }

  if (!Number.isFinite(out) || out < 0) {
    return Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0;
  }
  return out;
}
