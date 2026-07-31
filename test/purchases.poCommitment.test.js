import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Static regression: Purchase Order API routes must not post stock or journals.
 * (Commitment-only rule — Scenario 1)
 */
describe('Purchase Order commitment guards', () => {
  const ordersDir = path.join(process.cwd(), 'app/api/purchases/orders');

  it('order routes do not import inventory or purchase posting helpers', () => {
    const files = [];
    function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.js')) files.push(full);
      }
    }
    walk(ordersDir);

    const forbidden = [
      'createFifoBatch',
      'applyGoodsReceiptInventoryPosting',
      'createPurchaseReceiptJournalEntry',
      'postGoodsReceivedAccounting',
      'postSupplierBillAccounting',
      'inventoryTransaction.create',
    ];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const needle of forbidden) {
        expect(src, `${path.relative(process.cwd(), file)} must not contain ${needle}`).not.toContain(needle);
      }
    }
  });
});
