/**
 * Flexible-unit (productUnits) sales: resolve physical base quantity and line amount
 * so stock, FIFO COGS, and SaleItem rows use kg/L base stock — not "pieces".
 */

/**
 * @param {object} item - Incoming sale line (quantity, unitQuantities, unitPrice, …)
 * @param {object | null} product - Product with optional productUnits including unit
 * @returns {number}
 */
export function resolveSaleItemBaseQuantity(item, product) {
  const hasUnits = product?.productUnits?.length > 0;
  let fromUnits = 0;

  if (hasUnits && item.unitQuantities && typeof item.unitQuantities === 'object') {
    for (const [unitId, rawQty] of Object.entries(item.unitQuantities)) {
      const qty = Number(rawQty);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const pu = product.productUnits.find((p) => p.unit?.id === unitId);
      if (!pu?.unit) continue;

      const u = pu.unit;
      const conversionRate = Number(u.conversionToBase);
      const rate = Number.isFinite(conversionRate) && conversionRate > 0 ? conversionRate : 1;
      const convertedToBase = u.isBaseUnit ? qty : qty / rate;
      fromUnits += convertedToBase;
    }
  }

  if (fromUnits > 0) return fromUnits;

  const q = Number(item.quantity);
  if (hasUnits && (!Number.isFinite(q) || q <= 0)) {
    throw new Error(
      `Flexible-unit product "${product?.name || item.description || 'item'}": enter quantities by unit (kg, L, …) or send a positive base quantity.`
    );
  }
  return Number.isFinite(q) && q > 0 ? q : 0;
}

/**
 * Line total from per-unit selling prices when unitQuantities are present; else baseQty × unitPrice.
 * @param {object} item
 * @param {object | null} product - Product with productUnits (unitPrice on ProductUnit)
 * @param {number} baseQty
 * @returns {number}
 */
export function resolveSaleLineAmount(item, product, baseQty) {
  let fromUnits = 0;
  if (product?.productUnits?.length && item.unitQuantities && typeof item.unitQuantities === 'object') {
    for (const [unitId, rawQty] of Object.entries(item.unitQuantities)) {
      const qty = Number(rawQty);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const pu = product.productUnits.find((p) => p.unit?.id === unitId);
      if (!pu?.unit) continue;

      const unitSell = Number(
        pu.unitPrice != null ? pu.unitPrice : product.price != null ? product.price : item.unitPrice
      );
      fromUnits += qty * (Number.isFinite(unitSell) ? unitSell : 0);
    }
  }

  if (fromUnits > 0) return Math.round(fromUnits * 100) / 100;

  const up = Number(item.unitPrice);
  const q = Number(baseQty);
  return Math.round(q * (Number.isFinite(up) ? up : 0) * 100) / 100;
}
