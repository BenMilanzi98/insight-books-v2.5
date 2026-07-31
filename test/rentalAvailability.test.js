import { describe, expect, it, vi } from 'vitest';
import { assertCanBook } from '../lib/rentalAvailability.js';

function mockTx(sumQty) {
  return {
    rentalAssetAvailability: {
      aggregate: vi.fn(async () => ({ _sum: { quantity: sumQty } })),
    },
  };
}

describe('assertCanBook', () => {
  it('blocks overlapping serialised rental', async () => {
    await expect(
      assertCanBook(mockTx(1), { id: 'a1', kind: 'rental', totalQuantity: 1 }, new Date(), new Date(Date.now() + 864e5), 1)
    ).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
  });

  it('allows free serialised rental', async () => {
    await expect(
      assertCanBook(mockTx(0), { id: 'a1', kind: 'rental', totalQuantity: 1 }, new Date(), new Date(Date.now() + 864e5), 1)
    ).resolves.toMatchObject({ booked: 0 });
  });

  it('blocks quantity pool overbook', async () => {
    await expect(
      assertCanBook(
        mockTx(3),
        { id: 'a2', kind: 'hiring', totalQuantity: 4 },
        new Date(),
        new Date(Date.now() + 864e5),
        2
      )
    ).rejects.toMatchObject({ code: 'OVERBOOK_QTY' });
  });

  it('allows quantity pool within capacity', async () => {
    await expect(
      assertCanBook(
        mockTx(2),
        { id: 'a2', kind: 'hiring', totalQuantity: 5 },
        new Date(),
        new Date(Date.now() + 864e5),
        2
      )
    ).resolves.toBeTruthy();
  });
});
