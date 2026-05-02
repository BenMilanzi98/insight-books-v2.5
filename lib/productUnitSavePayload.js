/**
 * Build ProductUnit rows from POS/stock form body so flexible units always persist
 * when unitManagementEnabled + selectedUnits (even if unitConfigurations is incomplete).
 */

function num(v, fallback = 0) {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Merge per-unit config with main product fields as defaults (same keys as UnitConfiguration strings).
 * @param {object} body - Request body (unitPrice, costPrice, quantityInStock, reorderPoint, unitConfigurations)
 * @param {object} unit - Selected unit row { id, isBaseUnit?, … }
 * @param {Record<string, object>|undefined} configs - unitConfigurations[unitId]
 */
export function mergeProductUnitConfig(body, unit, configs) {
  const raw = configs?.[unit.id];
  const defaults = {
    unitPrice: num(body.unitPrice ?? body.price, 0),
    costPrice: num(body.costPrice ?? body.cost, 0),
    quantityInStock: num(body.quantityInStock ?? body.stockLevel, 0),
    reorderPoint: num(body.reorderPoint, 0),
    isDefault: Boolean(unit?.isBaseUnit),
  };
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }
  return {
    unitPrice: raw.unitPrice !== undefined && raw.unitPrice !== '' ? num(raw.unitPrice, defaults.unitPrice) : defaults.unitPrice,
    costPrice: raw.costPrice !== undefined && raw.costPrice !== '' ? num(raw.costPrice, defaults.costPrice) : defaults.costPrice,
    quantityInStock:
      raw.quantityInStock !== undefined && raw.quantityInStock !== ''
        ? num(raw.quantityInStock, defaults.quantityInStock)
        : defaults.quantityInStock,
    reorderPoint:
      raw.reorderPoint !== undefined && raw.reorderPoint !== ''
        ? num(raw.reorderPoint, defaults.reorderPoint)
        : defaults.reorderPoint,
    isDefault: raw.isDefault !== undefined ? Boolean(raw.isDefault) : defaults.isDefault,
  };
}

const CUSTOM_UNIT_PREFIX = /^custom_/i;

/**
 * @returns {{ unitId: string, isDefault: boolean, unitPrice: number, costPrice: number, quantityInStock: number, reorderPoint: number }[]}
 */
export function buildProductUnitPayloadRows(body) {
  const selected = body.selectedUnits;
  if (!Array.isArray(selected) || selected.length === 0) return [];
  const configs = body.unitConfigurations && typeof body.unitConfigurations === 'object' ? body.unitConfigurations : {};
  const rows = [];
  for (const unit of selected) {
    if (!unit?.id || CUSTOM_UNIT_PREFIX.test(String(unit.id))) {
      continue;
    }
    const m = mergeProductUnitConfig(body, unit, configs);
    rows.push({
      unitId: unit.id,
      isDefault: m.isDefault,
      unitPrice: m.unitPrice,
      costPrice: m.costPrice,
      quantityInStock: m.quantityInStock,
      reorderPoint: m.reorderPoint,
    });
  }
  return rows;
}

/**
 * If no row is default, mark the base unit (or the first row) as default for POS/quotations.
 * @param {Array<{ unitId: string, isDefault: boolean }>} rows
 * @param {Array<{ id: string, isBaseUnit?: boolean }>|undefined} selectedUnits
 */
export function ensureOneDefaultUnit(rows, selectedUnits) {
  if (!rows?.length) return rows;
  if (rows.some((r) => r.isDefault)) return rows;
  const baseId = selectedUnits?.find((u) => u.isBaseUnit)?.id;
  if (baseId) {
    return rows.map((r) => ({ ...r, isDefault: r.unitId === baseId }));
  }
  return rows.map((r, i) => ({ ...r, isDefault: i === 0 }));
}
