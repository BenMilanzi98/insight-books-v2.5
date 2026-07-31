import { describe, expect, it } from 'vitest';
import {
  evaluateThreeWayMatch,
  MATCH_STATUS,
} from '../lib/purchases/threeWayMatching.js';
import { receiptCreditPurpose, billShouldClearGrni } from '../lib/purchases/grniPolicy.js';

describe('three-way matching', () => {
  const baseBill = {
    billType: 'inventory',
    supplierId: 'sup-1',
    currency: 'MWK',
    goodsReceiptId: 'gr-1',
    subtotal: 1000,
    taxAmount: 0,
    totalAmount: 1000,
  };

  it('exact match when bill equals receipt', () => {
    const result = evaluateThreeWayMatch({
      bill: baseBill,
      billItems: [
        { lineNumber: 1, productId: 'p1', quantity: 10, unitCost: 100 },
      ],
      goodsReceipt: { id: 'gr-1', supplierId: 'sup-1' },
      receiptItems: [
        { productId: 'p1', quantityReceived: 10, unitCost: 100 },
      ],
      purchaseOrder: { supplierId: 'sup-1', currency: 'MWK' },
      poItems: [{ productId: 'p1', quantityOrdered: 10, unitCost: 100 }],
    });
    expect(result.blocked).toBe(false);
    expect(result.matchingStatus).toBe(MATCH_STATUS.EXACT_MATCH);
  });

  it('blocks overbilling beyond received quantity', () => {
    const result = evaluateThreeWayMatch({
      bill: baseBill,
      billItems: [
        { lineNumber: 1, productId: 'p1', quantity: 100, unitCost: 100 },
      ],
      goodsReceipt: { id: 'gr-1', supplierId: 'sup-1' },
      receiptItems: [
        { productId: 'p1', quantityReceived: 40, unitCost: 100 },
      ],
    });
    expect(result.blocked).toBe(true);
    expect(result.matchingStatus).toBe(MATCH_STATUS.OVER_BILLED);
  });

  it('blocks inventory bill without receipt when required', () => {
    const result = evaluateThreeWayMatch({
      bill: { ...baseBill, goodsReceiptId: null },
      billItems: [
        { lineNumber: 1, productId: 'p1', quantity: 10, unitCost: 100 },
      ],
      requireReceiptForInventory: true,
    });
    expect(result.blocked).toBe(true);
    expect(result.matchingStatus).toBe(MATCH_STATUS.RECEIPT_MISSING);
  });

  it('expense bills are not required to match', () => {
    const result = evaluateThreeWayMatch({
      bill: { billType: 'expense', supplierId: 'sup-1' },
      billItems: [],
    });
    expect(result.matchingStatus).toBe(MATCH_STATUS.NOT_REQUIRED);
    expect(result.blocked).toBe(false);
  });

  it('detects wrong supplier', () => {
    const result = evaluateThreeWayMatch({
      bill: baseBill,
      billItems: [
        { lineNumber: 1, productId: 'p1', quantity: 10, unitCost: 100 },
      ],
      goodsReceipt: { id: 'gr-1', supplierId: 'sup-OTHER' },
      receiptItems: [
        { productId: 'p1', quantityReceived: 10, unitCost: 100 },
      ],
    });
    expect(result.blocked).toBe(true);
    expect(result.matchingStatus).toBe(MATCH_STATUS.WRONG_SUPPLIER);
  });
});

describe('GRNI policy defaults', () => {
  it('credits GRNI when enabled and clears on receipt-linked bills', () => {
    expect(receiptCreditPurpose(true)).toBe('GRNI');
    expect(billShouldClearGrni({ goodsReceiptId: 'x' }, true)).toBe(true);
  });
});
