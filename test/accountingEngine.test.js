import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertPeriodOpen: vi.fn(),
  assertNoDuplicatePostedSource: vi.fn(),
  assertAccountsAllowDirectPosting: vi.fn(),
  generateReferenceNumber: vi.fn(),
  updateAccountBalanceOnTransaction: vi.fn(),
  transactionCreate: vi.fn(),
}));

vi.mock('../lib/accountingPeriodService.js', () => ({
  assertPeriodOpen: mocks.assertPeriodOpen,
}));

vi.mock('../lib/accountingMappingRules.js', () => ({
  assertNoDuplicatePostedSource: mocks.assertNoDuplicatePostedSource,
}));

vi.mock('../lib/coaDirectPostingEligibility.js', () => ({
  assertAccountsAllowDirectPosting: mocks.assertAccountsAllowDirectPosting,
}));

vi.mock('../lib/journalService.js', () => ({
  generateReferenceNumber: mocks.generateReferenceNumber,
}));

vi.mock('../lib/accountBalanceService.js', () => ({
  updateAccountBalanceOnTransaction: mocks.updateAccountBalanceOnTransaction,
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    $transaction: vi.fn(async (fn) => fn({ transaction: { create: mocks.transactionCreate } })),
  },
}));

import { postGlEntry, AccountingEngineError } from '../lib/accountingEngine/postGlEntry.js';
import { manualJournalEntryWhere } from '../lib/accountingEngine/constants.js';

describe('accountingEngine postGlEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateReferenceNumber.mockResolvedValue('TXN-2026-0001');
    mocks.transactionCreate.mockResolvedValue({
      id: 'tx-1',
      reference: 'TXN-2026-0001',
      lines: [
        { accountId: 'cash', debitAmount: 100, creditAmount: 0 },
        { accountId: 'equity', debitAmount: 0, creditAmount: 100 },
      ],
    });
  });

  it('rejects unbalanced lines before touching the database', async () => {
    await expect(
      postGlEntry({
        tenantId: 't1',
        userId: 'u1',
        entryDate: new Date('2026-01-15'),
        description: 'Test',
        lines: [
          { accountId: 'a', debitAmount: 100, creditAmount: 0 },
          { accountId: 'b', debitAmount: 0, creditAmount: 90 },
        ],
      })
    ).rejects.toThrow(AccountingEngineError);

    expect(mocks.transactionCreate).not.toHaveBeenCalled();
  });

  it('rejects fewer than two lines', async () => {
    await expect(
      postGlEntry({
        tenantId: 't1',
        userId: 'u1',
        entryDate: new Date(),
        description: 'Single line',
        lines: [{ accountId: 'a', debitAmount: 50, creditAmount: 0 }],
      })
    ).rejects.toThrow(/At least two GL lines/);
  });

  it('posts balanced entry with transaction lines and updates balances', async () => {
    const result = await postGlEntry({
      tenantId: 't1',
      userId: 'u1',
      entryDate: new Date('2026-06-01'),
      description: 'Capital contribution',
      sourceType: 'capital_contribution',
      sourceId: 'CAP-20260601-100',
      lines: [
        { accountId: 'cash-id', debitAmount: 250, creditAmount: 0 },
        { accountId: 'eq-id', debitAmount: 0, creditAmount: 250 },
      ],
    });

    expect(mocks.assertPeriodOpen).toHaveBeenCalled();
    expect(mocks.assertAccountsAllowDirectPosting).toHaveBeenCalledWith(
      ['cash-id', 'eq-id'],
      expect.anything(),
      { allowBlockedAccountForReversal: false }
    );
    expect(mocks.assertNoDuplicatePostedSource).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        sourceType: 'capital_contribution',
        sourceId: 'CAP-20260601-100',
      })
    );
    expect(mocks.transactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'posted',
          sourceType: 'capital_contribution',
          lines: { create: expect.arrayContaining([
            expect.objectContaining({ accountId: 'cash-id', debitAmount: 250 }),
            expect.objectContaining({ accountId: 'eq-id', creditAmount: 250 }),
          ]) },
        }),
        include: { lines: true },
      })
    );
    expect(mocks.updateAccountBalanceOnTransaction).toHaveBeenCalledTimes(2);
    expect(result.id).toBe('tx-1');
  });

  it('posts SupplierPurchase with reference-based idempotency (COGS purchase flow)', async () => {
    await postGlEntry({
      tenantId: 't1',
      userId: 'u1',
      entryDate: new Date('2026-06-01'),
      description: 'Purchase from Acme Supplies - PUR-100',
      reference: 'PUR-100',
      sourceType: 'SupplierPurchase',
      sourceId: 'PUR-100',
      lines: [
        { accountId: 'inventory-id', debitAmount: 500, creditAmount: 0 },
        { accountId: 'ap-id', debitAmount: 0, creditAmount: 500 },
      ],
    });

    expect(mocks.assertNoDuplicatePostedSource).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        sourceType: 'SupplierPurchase',
        sourceId: 'PUR-100',
      })
    );
    expect(mocks.transactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'SupplierPurchase',
          sourceId: 'PUR-100',
          lines: { create: expect.arrayContaining([
            expect.objectContaining({ accountId: 'inventory-id', debitAmount: 500 }),
            expect.objectContaining({ accountId: 'ap-id', creditAmount: 500 }),
          ]) },
        }),
      })
    );
  });

  it('posts SupplierPayment with reference-based idempotency (COGS payment flow)', async () => {
    await postGlEntry({
      tenantId: 't1',
      userId: 'u1',
      entryDate: new Date('2026-06-01'),
      description: 'Payment to Acme Supplies - PAY-200',
      reference: 'PAY-200',
      sourceType: 'SupplierPayment',
      sourceId: 'PAY-200',
      lines: [
        { accountId: 'ap-id', debitAmount: 500, creditAmount: 0 },
        { accountId: 'cash-id', debitAmount: 0, creditAmount: 500 },
      ],
    });

    expect(mocks.assertNoDuplicatePostedSource).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        sourceType: 'SupplierPayment',
        sourceId: 'PAY-200',
      })
    );
    expect(mocks.transactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'SupplierPayment',
          sourceId: 'PAY-200',
          lines: { create: expect.arrayContaining([
            expect.objectContaining({ accountId: 'ap-id', debitAmount: 500 }),
            expect.objectContaining({ accountId: 'cash-id', creditAmount: 500 }),
          ]) },
        }),
      })
    );
  });
});

describe('accountingEngine read policy', () => {
  it('manualJournalEntryWhere excludes mirrored system journals', () => {
    const where = manualJournalEntryWhere({ tenantId: 't1' });
    expect(where.transactionId).toBe(null);
    expect(where.status.in).toContain('Posted');
    expect(where.tenantId).toBe('t1');
  });
});
