import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reverseRentalBooking } from '../lib/rentalReverseService.js';

function buildPrisma({
  status = 'booked',
  kind = 'hiring',
  invoiceStatus = 'Pending',
  totalPaid = 0,
  invoiceId = 'inv-1',
  items = [
    {
      id: 'ri-1',
      rentalAssetId: 'asset-1',
      quantity: 2,
      rentalAsset: { id: 'asset-1', kind: 'hiring', status: 'available' },
    },
  ],
} = {}) {
  const rt = {
    id: 'rt-1',
    tenantId: 't1',
    status,
    kind,
    invoiceId,
    items,
    invoice: invoiceId
      ? {
          id: invoiceId,
          status: invoiceStatus,
          payments: totalPaid > 0 ? [{ status: 'Completed', amount: totalPaid }] : [],
        }
      : null,
  };

  const tx = {
    rentalTransaction: {
      findFirst: vi.fn().mockResolvedValue(rt),
      update: vi.fn().mockResolvedValue({ ...rt, status: 'cancelled' }),
    },
    rentalAssetAvailability: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    rentalAsset: {
      update: vi.fn().mockResolvedValue({}),
    },
    invoice: {
      delete: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };

  return {
    prisma: {
      $transaction: async (fn) => fn(tx),
      rentalTransaction: tx.rentalTransaction,
    },
    tx,
  };
}

const input = {
  tenantId: 't1',
  userId: 'u1',
  transactionId: 'rt-1',
  reason: 'customer cancelled',
};

describe('reverseRentalBooking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns NOT_FOUND when the booking is absent', async () => {
    const { prisma } = buildPrisma();
    prisma.rentalTransaction.findFirst.mockResolvedValue(null);

    await expect(reverseRentalBooking({ prisma, ...input })).resolves.toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('is idempotent when already cancelled', async () => {
    const { prisma, tx } = buildPrisma({ status: 'cancelled' });

    await expect(reverseRentalBooking({ prisma, ...input })).resolves.toMatchObject({
      ok: true,
      alreadyReversed: true,
      invoiceAction: 'already_cancelled',
    });
    expect(tx.rentalAssetAvailability.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks before releasing stock when invoice has payments', async () => {
    const { prisma, tx } = buildPrisma({ totalPaid: 100, invoiceStatus: 'Paid' });

    await expect(reverseRentalBooking({ prisma, ...input })).resolves.toMatchObject({
      ok: false,
      code: 'NEED_CREDIT_REFUND',
    });
    expect(tx.rentalAssetAvailability.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks completed bookings', async () => {
    const { prisma, tx } = buildPrisma({ status: 'completed' });

    await expect(reverseRentalBooking({ prisma, ...input })).resolves.toMatchObject({
      ok: false,
      code: 'CLOSED',
    });
    expect(tx.rentalAssetAvailability.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes a draft invoice, frees availability, and restocks a space asset', async () => {
    const { prisma, tx } = buildPrisma({
      kind: 'rental',
      invoiceStatus: 'draft',
      items: [
        {
          id: 'ri-1',
          rentalAssetId: 'asset-1',
          quantity: 1,
          rentalAsset: { id: 'asset-1', kind: 'rental', status: 'booked' },
        },
      ],
    });

    await expect(reverseRentalBooking({ prisma, ...input })).resolves.toMatchObject({
      ok: true,
      invoiceAction: 'deleted_draft',
      invoiceId: null,
    });
    expect(tx.invoice.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    expect(tx.rentalAssetAvailability.deleteMany).toHaveBeenCalledWith({
      where: { rentalTransactionId: 'rt-1' },
    });
    expect(tx.rentalAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { status: 'available' },
    });
    expect(tx.rentalTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-1' },
        data: expect.objectContaining({ status: 'cancelled', invoiceId: null }),
      })
    );
  });

  it('voids a posted unpaid invoice and keeps the invoice link for reporting', async () => {
    const voidHook = vi.fn().mockResolvedValue({ ok: true });
    const { prisma, tx } = buildPrisma({ invoiceStatus: 'Pending', totalPaid: 0 });

    await expect(
      reverseRentalBooking({ prisma, ...input, voidPostedInvoice: voidHook })
    ).resolves.toMatchObject({
      ok: true,
      invoiceAction: 'voided',
      invoiceId: 'inv-1',
    });
    expect(voidHook).toHaveBeenCalledWith(
      expect.objectContaining({
        db: tx,
        invoiceId: 'inv-1',
        tenantId: 't1',
        userId: 'u1',
      })
    );
    expect(tx.rentalAssetAvailability.deleteMany).toHaveBeenCalledWith({
      where: { rentalTransactionId: 'rt-1' },
    });
    expect(tx.rentalTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'cancelled' }),
      })
    );
    expect(tx.rentalTransaction.update.mock.calls[0][0].data).not.toHaveProperty('invoiceId');
  });

  it('does not free stock when the posted invoice period is closed', async () => {
    const periodLocked = Object.assign(
      new Error('Cannot void in closed accounting period: August 2026'),
      { code: 'PERIOD_LOCKED' }
    );
    const voidHook = vi.fn().mockRejectedValue(periodLocked);
    const { prisma, tx } = buildPrisma({ invoiceStatus: 'Pending', totalPaid: 0 });

    await expect(
      reverseRentalBooking({ prisma, ...input, voidPostedInvoice: voidHook })
    ).rejects.toMatchObject({ code: 'PERIOD_LOCKED' });

    expect(voidHook).toHaveBeenCalledWith(expect.objectContaining({ db: tx }));
    expect(tx.rentalAssetAvailability.deleteMany).not.toHaveBeenCalled();
    expect(tx.rentalAsset.update).not.toHaveBeenCalled();
    expect(tx.rentalTransaction.update).not.toHaveBeenCalled();
  });
});
