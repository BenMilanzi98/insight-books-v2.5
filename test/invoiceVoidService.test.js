import { beforeEach, describe, expect, it, vi } from 'vitest';

const { assertPeriodOpen, reverseSourceJournals } = vi.hoisted(() => ({
  assertPeriodOpen: vi.fn(),
  reverseSourceJournals: vi.fn(),
}));

vi.mock('../lib/accountingPeriodService.js', () => ({ assertPeriodOpen }));
vi.mock('../lib/accountingV2/application/reverseSourceJournals.js', () => ({
  reverseSourceJournals,
}));

import { voidPostedInvoice } from '../lib/invoiceVoidService.js';

const voidDate = new Date('2026-08-11T10:00:00.000Z');
const invoice = {
  id: 'inv-1',
  invoiceNumber: 'INV-1',
  total: 100,
  client: { name: 'Acme' },
};

function buildTx() {
  return {
    invoice: { update: vi.fn().mockResolvedValue({ id: invoice.id, status: 'void' }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe('voidPostedInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertPeriodOpen.mockResolvedValue();
    reverseSourceJournals.mockResolvedValue({
      reversed: [{ originalJournalId: 'journal-1' }],
      skippedAlreadyReversed: [],
    });
  });

  it('uses the caller transaction for its period check and journal reversal', async () => {
    const tx = buildTx();

    await voidPostedInvoice({
      db: tx,
      invoice,
      tenantId: 't1',
      userId: 'u1',
      reason: 'Customer cancelled',
      voidDate,
    });

    expect(assertPeriodOpen).toHaveBeenCalledWith('t1', voidDate, tx);
    expect(reverseSourceJournals).toHaveBeenCalledWith(
      expect.objectContaining({ db: tx })
    );
  });

  it('stops before reversing journals or voiding when the accounting period is closed', async () => {
    const tx = buildTx();
    const error = Object.assign(
      new Error('Cannot post in closed accounting period: August 2026'),
      { code: 'PERIOD_LOCKED' }
    );
    assertPeriodOpen.mockRejectedValue(error);

    await expect(
      voidPostedInvoice({
        db: tx,
        invoice,
        tenantId: 't1',
        userId: 'u1',
        reason: 'Customer cancelled',
        voidDate,
      })
    ).rejects.toMatchObject({ code: 'PERIOD_LOCKED' });

    expect(reverseSourceJournals).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });
});
