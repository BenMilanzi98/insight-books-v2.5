import { describe, it, expect } from 'vitest';
import { resolveSaleItemBaseQuantity, resolveSaleLineAmount } from '../lib/saleItemBaseQuantity.js';

describe('resolveSaleItemBaseQuantity', () => {
  it('converts g to base kg', () => {
    const product = {
      name: 'Rice',
      productUnits: [
        { unit: { id: 'kg', isBaseUnit: true, conversionToBase: 1 }, unitPrice: 2000 },
        { unit: { id: 'g', isBaseUnit: false, conversionToBase: 1000 }, unitPrice: 2 },
      ],
    };
    const item = { unitQuantities: { g: 500 }, quantity: 1 };
    expect(resolveSaleItemBaseQuantity(item, product)).toBeCloseTo(0.5, 6);
  });

  it('uses client quantity when unit map empty and no units', () => {
    const product = { productUnits: [] };
    const item = { quantity: 3, unitPrice: 10 };
    expect(resolveSaleItemBaseQuantity(item, product)).toBe(3);
  });
});

describe('resolveSaleLineAmount', () => {
  it('sums per-unit line totals', () => {
    const product = {
      price: 2000,
      productUnits: [
        { unit: { id: 'kg', isBaseUnit: true, conversionToBase: 1 }, unitPrice: 2000 },
        { unit: { id: 'g', isBaseUnit: false, conversionToBase: 1000 }, unitPrice: 2 },
      ],
    };
    const item = { unitQuantities: { g: 500 }, unitPrice: 2000 };
    const base = 0.5;
    expect(resolveSaleLineAmount(item, product, base)).toBe(1000);
  });
});
