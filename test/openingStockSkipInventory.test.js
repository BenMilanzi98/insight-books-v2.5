import { describe, it, expect } from 'vitest';

/**
 * Contract: when FIFO was already applied, opening-balance posting must not
 * create a second inventory batch (see postOpeningBalance skipInventory).
 */
function shouldApplyOpeningStockInventory({ type, skipInventory, metadata = {} }) {
  if (type !== 'opening_stock') return false;
  return !(
    skipInventory === true ||
    metadata.skipInventory === true ||
    metadata.inventoryAlreadyApplied === true
  );
}

describe('opening stock inventory skip contract', () => {
  it('applies inventory for standalone opening_stock posts', () => {
    expect(shouldApplyOpeningStockInventory({ type: 'opening_stock' })).toBe(true);
  });

  it('skips inventory when product create / stock-in already applied FIFO', () => {
    expect(
      shouldApplyOpeningStockInventory({ type: 'opening_stock', skipInventory: true })
    ).toBe(false);
    expect(
      shouldApplyOpeningStockInventory({
        type: 'opening_stock',
        metadata: { inventoryAlreadyApplied: true },
      })
    ).toBe(false);
  });

  it('does not apply inventory for non-stock opening types', () => {
    expect(shouldApplyOpeningStockInventory({ type: 'opening_cash' })).toBe(false);
  });
});
