/** POS/mobile catalog enrichment for `/api/stock?pos=1`. */

export const POS_EXPIRY_ALERT_DAYS = 30;

function calendarDaysBetween(fromDate, toDate) {
  const a = new Date(fromDate);
  const b = new Date(toDate);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * @param {Array<{ expiryDate?: Date | string | null, qtyRemaining?: unknown }>} batches
 * @param {Date} todayStart
 * @param {number} alertDays
 */
export function summarizeProductExpiry(batches, todayStart = new Date(), alertDays = POS_EXPIRY_ALERT_DAYS) {
  const alertWindow = Math.max(1, Number(alertDays) || POS_EXPIRY_ALERT_DAYS);
  let nearestExpiryDate = null;
  let nearestDays = null;

  for (const batch of batches || []) {
    if (!batch?.expiryDate) continue;
    const exp = new Date(batch.expiryDate);
    if (Number.isNaN(exp.getTime())) continue;
    const days = calendarDaysBetween(todayStart, exp);
    if (nearestDays == null || days < nearestDays) {
      nearestDays = days;
      nearestExpiryDate = exp.toISOString().split('T')[0];
    }
  }

  if (nearestDays == null) {
    return {
      nearestExpiryDate: null,
      expiresWithinDays: null,
      expiryAlertLevel: null,
    };
  }

  let expiryAlertLevel = null;
  if (nearestDays < 0) expiryAlertLevel = 'expired';
  else if (nearestDays <= alertWindow) expiryAlertLevel = 'warning';

  return {
    nearestExpiryDate,
    expiresWithinDays: nearestDays,
    expiryAlertLevel,
  };
}

/**
 * Transform productUnits to POS/mobile-friendly units[].
 * @param {object} product
 * @param {number} stockLevel
 */
export function buildPosCatalogUnits(product, stockLevel) {
  const level = Number(stockLevel) || 0;
  return (product?.productUnits || [])
    .filter((pu) => pu?.isActive !== false && pu?.unit)
    .map((pu) => {
      const conversionToBase = Number(pu.unit?.conversionToBase ?? 1);
      const rate = Number.isFinite(conversionToBase) && conversionToBase > 0 ? conversionToBase : 1;
      const isBaseUnit = !!pu.unit?.isBaseUnit;
      const calculatedStock = isBaseUnit ? level : level * rate;
      const unitName = pu.unit?.name || pu.unit?.symbol || 'Unit';
      return {
        id: pu.unit?.id || pu.id,
        unitName,
        name: unitName,
        symbol: pu.unit?.symbol || null,
        isBaseUnit,
        conversionToBase: rate,
        conversionRate: rate,
        unitPrice: pu.unitPrice != null ? Number(pu.unitPrice) : Number(product?.price ?? 0),
        costPrice: pu.costPrice != null ? Number(pu.costPrice) : Number(product?.cost ?? 0),
        quantityInStock: calculatedStock,
        reorderPoint: pu.reorderPoint ?? 0,
      };
    });
}

/**
 * @param {object} productFields - processed list row before POS enrichment
 * @param {{ alertDays?: number, todayStart?: Date }} [opts]
 */
export function enrichProductForPosCatalog(productFields, opts = {}) {
  const stockLevel = Number(productFields.stockLevel) || 0;
  const units = buildPosCatalogUnits(productFields, stockLevel);
  const batches = productFields.inventoryBatches || [];
  const expiry = summarizeProductExpiry(
    batches,
    opts.todayStart || new Date(),
    opts.alertDays ?? POS_EXPIRY_ALERT_DAYS,
  );

  const expiryAllocations = batches
    .filter((b) => Number(b?.qtyRemaining || 0) > 0)
    .map((batch) => ({
      batchId: batch.id,
      qty: Number(batch.qtyRemaining || 0),
      unitCost: Number(batch.unitCost || 0),
      expiryDate: batch.expiryDate
        ? new Date(batch.expiryDate).toISOString().split('T')[0]
        : null,
    }));

  const accountId =
    productFields.incomeAccountId ||
    productFields.accountId ||
    productFields.incomeAccount?.id ||
    null;

  const { productUnits: _pu, inventoryBatches: _ib, productBarcodes: _pb, productTaxes: _pt, ...rest } =
    productFields;

  return {
    ...rest,
    accountId,
    incomeAccountId: productFields.incomeAccountId ?? accountId,
    units,
    isPerishable: !!productFields.isPerishable,
    expiryAllocations,
    nearestExpiryDate: expiry.nearestExpiryDate,
    expiresWithinDays: expiry.expiresWithinDays,
    expiryAlertLevel: expiry.expiryAlertLevel,
    hasFlexibleUnits: units.length > 0,
  };
}
