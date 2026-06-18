import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  postGlEntry: vi.fn(),
  assertPeriodOpen: vi.fn(),
  generateReferenceNumber: vi.fn(),
  resolveOrEnsureInventoryGlAccount: vi.fn(),
}));

vi.mock('../lib/accountingEngine/postGlEntry.js', () => ({
  postGlEntry: mocks.postGlEntry,
}));

vi.mock('../lib/accountingPeriodService.js', () => ({
  assertPeriodOpen: mocks.assertPeriodOpen,
}));

vi.mock('../lib/journalService.js', () => ({
  generateReferenceNumber: mocks.generateReferenceNumber,
}));

vi.mock('../lib/inventoryGlAccount.js', () => ({
  resolveOrEnsureInventoryGlAccount: mocks.resolveOrEnsureInventoryGlAccount,
}));

import { createInventoryWriteOffJournalEntry } from '../lib/inventoryWriteOffJournal.js';

function makeTx(overrides = {}) {
  return {
    tenantSettings: {
      findUnique: vi.fn(async () => ({ inventoryAdjustmentLossAccountId: 'loss-acc-id' })),
    },
    account: {
      findFirst: vi.fn(async () => ({
        id: 'loss-acc-id',
        accountCode: '5290',
        accountName: 'Inventory Adjustment Loss',
      })),
      create: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn(async () => null),
    },
    journalEntry: {
      findFirst: vi.fn(async () => null),
    },
    ...overrides,
  };
}

describe('createInventoryWriteOffJournalEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertPeriodOpen.mockResolvedValue(undefined);
    mocks.generateReferenceNumber.mockResolvedValue('TXN-2026-0042');
    mocks.resolveOrEnsureInventoryGlAccount.mockResolvedValue({
      id: 'inv-acc-id',
      accountCode: '1310',
    });
    mocks.postGlEntry.mockResolvedValue({
      id: 'gl-tx-1',
      reference: 'TXN-2026-0042',
      lines: [],
    });
  });

  it('returns null without posting when amount is zero or negative', async () => {
    const tx = makeTx();

    await expect(
      createInventoryWriteOffJournalEntry({
        tenantId: 't1',
        userId: 'u1',
        amount: 0,
        description: 'Expired stock',
        sourceBatchId: 'batch-1',
        tx,
      })
    ).resolves.toBeNull();

    expect(mocks.postGlEntry).not.toHaveBeenCalled();
  });

  it('posts balanced debit-loss / credit-inventory lines through postGlEntry', async () => {
    const tx = makeTx();

    const result = await createInventoryWriteOffJournalEntry({
      tenantId: 't1',
      userId: 'u1',
      amount: 125.5,
      description: 'Expired batch write-off',
      sourceBatchId: 'batch-99',
      sourceType: 'InventoryExpiryWriteOff',
      tx,
    });

    expect(mocks.assertPeriodOpen).toHaveBeenCalledWith('t1', expect.any(Date), tx);
    expect(mocks.generateReferenceNumber).toHaveBeenCalledWith(tx, 't1', expect.any(Date));
    expect(mocks.resolveOrEnsureInventoryGlAccount).toHaveBeenCalledWith('t1', tx);
    expect(mocks.postGlEntry).toHaveBeenCalledTimes(1);

    const call = mocks.postGlEntry.mock.calls[0][0];
    expect(call).toMatchObject({
      tenantId: 't1',
      userId: 'u1',
      description: 'Expired batch write-off',
      reference: 'TXN-2026-0042',
      sourceType: 'InventoryExpiryWriteOff',
      sourceId: 'batch-99',
      tx,
    });
    expect(call.lines).toEqual([
      {
        lineNumber: 1,
        accountId: 'loss-acc-id',
        debitAmount: 125.5,
        creditAmount: 0,
        description: 'Expired batch write-off',
      },
      {
        lineNumber: 2,
        accountId: 'inv-acc-id',
        debitAmount: 0,
        creditAmount: 125.5,
        description: 'Expired batch write-off',
      },
    ]);
    expect(result).toEqual({ id: 'gl-tx-1', reference: 'TXN-2026-0042', lines: [] });
  });

  it('returns existing posted transaction without calling postGlEntry (idempotency)', async () => {
    const existing = { id: 'existing-tx', lines: [{ lineNumber: 1 }] };
    const tx = makeTx({
      transaction: {
        findFirst: vi.fn(async () => existing),
      },
    });

    const result = await createInventoryWriteOffJournalEntry({
      tenantId: 't1',
      userId: 'u1',
      amount: 50,
      description: 'Duplicate write-off',
      sourceBatchId: 'batch-dup',
      tx,
    });

    expect(result).toBe(existing);
    expect(mocks.postGlEntry).not.toHaveBeenCalled();
  });
});
