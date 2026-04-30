const STOCK_EPSILON = 1e-6;

export function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeExpiryAllocations({
  expiryAllocations,
  isPerishable,
  fallbackExpiryDate,
  targetQty,
  fallbackUnitCost,
}) {
  const qtyTarget = Math.max(0, toFiniteNumber(targetQty, 0));
  const costFallback = Math.max(0, toFiniteNumber(fallbackUnitCost, 0));

  if (!Array.isArray(expiryAllocations) || expiryAllocations.length === 0) {
    if (qtyTarget <= 0) return [];
    return [
      {
        qty: qtyTarget,
        expiryDate:
          isPerishable && fallbackExpiryDate ? new Date(fallbackExpiryDate) : null,
        unitCost: costFallback,
      },
    ];
  }

  const normalized = expiryAllocations.map((entry, index) => {
    const qty = toFiniteNumber(entry?.qty, NaN);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(
        `expiryAllocations[${index}].qty must be a number greater than 0`
      );
    }
    const hasExpiry =
      entry?.expiryDate != null && String(entry.expiryDate).trim() !== '';
    if (isPerishable && !hasExpiry) {
      throw new Error(
        `expiryAllocations[${index}].expiryDate is required for perishable items`
      );
    }
    const expiryDate = hasExpiry ? new Date(entry.expiryDate) : null;
    if (hasExpiry && Number.isNaN(expiryDate.getTime())) {
      throw new Error(
        `expiryAllocations[${index}].expiryDate must be a valid date`
      );
    }
    const unitCostRaw =
      entry?.unitCost !== undefined
        ? toFiniteNumber(entry.unitCost, NaN)
        : costFallback;
    if (!Number.isFinite(unitCostRaw) || unitCostRaw < 0) {
      throw new Error(
        `expiryAllocations[${index}].unitCost must be >= 0 when provided`
      );
    }
    return { qty, expiryDate, unitCost: unitCostRaw };
  });

  const sum = normalized.reduce((acc, row) => acc + row.qty, 0);
  if (Math.abs(sum - qtyTarget) > STOCK_EPSILON) {
    throw new Error(
      `expiryAllocations total qty (${sum}) must equal stock quantity (${qtyTarget})`
    );
  }

  return normalized;
}

