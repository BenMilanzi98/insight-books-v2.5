import { describe, expect, it } from 'vitest';
import {
  receiptCreditPurpose,
  billShouldClearGrni,
} from '../lib/purchases/grniPolicy.js';

describe('purchases grniPolicy', () => {
  it('receiptCreditPurpose uses GRNI when enabled', () => {
    expect(receiptCreditPurpose(true)).toBe('GRNI');
    expect(receiptCreditPurpose(false)).toBe('ACCOUNTS_PAYABLE');
  });

  it('billShouldClearGrni only when flag on and receipt-linked', () => {
    expect(billShouldClearGrni({ goodsReceiptId: 'gr1' }, false)).toBe(false);
    expect(billShouldClearGrni({ goodsReceiptId: 'gr1' }, true)).toBe(true);
    expect(billShouldClearGrni({ billType: 'inventory' }, true)).toBe(false);
    expect(billShouldClearGrni({ clearGrni: true }, true)).toBe(true);
    expect(billShouldClearGrni({ billType: 'expense' }, true)).toBe(false);
  });
});
