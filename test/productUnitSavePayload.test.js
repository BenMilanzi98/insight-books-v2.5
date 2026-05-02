import { describe, it, expect } from 'vitest';
import {
  buildProductUnitPayloadRows,
  ensureOneDefaultUnit,
  mergeProductUnitConfig,
} from '../lib/productUnitSavePayload.js';

describe('mergeProductUnitConfig', () => {
  it('fills from body when no per-unit config', () => {
    const body = { unitPrice: 100, costPrice: 50, quantityInStock: 10, reorderPoint: 2 };
    const unit = { id: 'u1', isBaseUnit: true };
    const m = mergeProductUnitConfig(body, unit, {});
    expect(m.unitPrice).toBe(100);
    expect(m.costPrice).toBe(50);
    expect(m.isDefault).toBe(true);
  });
});

describe('buildProductUnitPayloadRows', () => {
  it('builds rows from selected units without per-unit config', () => {
    const body = {
      unitPrice: 200,
      costPrice: 100,
      quantityInStock: 5,
      reorderPoint: 1,
      selectedUnits: [
        { id: 'kg-id', isBaseUnit: true, name: 'Kilogram' },
        { id: 'g-id', isBaseUnit: false, name: 'Gram' },
      ],
      unitConfigurations: {},
    };
    const rows = buildProductUnitPayloadRows(body);
    expect(rows).toHaveLength(2);
    expect(rows[0].unitId).toBe('kg-id');
    expect(rows[0].unitPrice).toBe(200);
  });

  it('skips custom_ placeholder ids', () => {
    const body = {
      unitPrice: 1,
      costPrice: 0,
      quantityInStock: 0,
      reorderPoint: 0,
      selectedUnits: [{ id: 'custom_123', isBaseUnit: true }],
      unitConfigurations: {},
    };
    expect(buildProductUnitPayloadRows(body)).toHaveLength(0);
  });
});

describe('ensureOneDefaultUnit', () => {
  it('marks base when none default', () => {
    const rows = [
      { unitId: 'a', isDefault: false },
      { unitId: 'b', isDefault: false },
    ];
    const selected = [
      { id: 'a', isBaseUnit: true },
      { id: 'b', isBaseUnit: false },
    ];
    const out = ensureOneDefaultUnit(rows, selected);
    expect(out.find((r) => r.unitId === 'a').isDefault).toBe(true);
    expect(out.find((r) => r.unitId === 'b').isDefault).toBe(false);
  });
});
