import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  postGlEntry: vi.fn(),
  assertPeriodOpen: vi.fn(),
  generateReferenceNumber: vi.fn(),
  resolveOrEnsureInventoryGlAccount: vi.fn(),
  postStockAdjustmentAccounting: vi.fn(),
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

vi.mock('../lib/accountingV2/adapters/stockAdjustmentAdapter.js', () => ({
  postStockAdjustmentAccounting: mocks.postStockAdjustmentAccounting,
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
    mocks.postStockAdjustmentAccounting.mockImplementation(async ({ amount, description, sourceId }) => ({
      mode: 'NEW_ENGINE',
      authority: 'V2',
      result: {
        id: 'v2-je-1',
        reference: 'HREP-MOCK',
        amount,
        description,
        sourceId,
      },
    }));
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

    expect(mocks.postStockAdjustmentAccounting).not.toHaveBeenCalled();
    expect(mocks.postGlEntry).not.toHaveBeenCalled();
  });

  it('routes write-offs through the V2 stock-adjustment adapter', async () => {
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

    expect(mocks.postStockAdjustmentAccounting).toHaveBeenCalledTimes(1);
    expect(mocks.postStockAdjustmentAccounting).toHaveBeenCalledWith(
      expect.objectContaining({
        db: tx,
        tenantId: 't1',
        userId: 'u1',
        amount: 125.5,
        description: 'Expired batch write-off',
        sourceType: 'InventoryExpiryWriteOff',
        sourceId: 'batch-99',
      })
    );
    expect(mocks.postGlEntry).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'v2-je-1', sourceId: 'batch-99' });
  });

  it('legacy __skipCutover path still attempts postGlEntry for unit isolation', async () => {
    const tx = makeTx();

    await createInventoryWriteOffJournalEntry({
      tenantId: 't1',
      userId: 'u1',
      amount: 50,
      description: 'Legacy path',
      sourceBatchId: 'batch-legacy',
      tx,
      __skipCutover: true,
    });

    expect(mocks.postStockAdjustmentAccounting).not.toHaveBeenCalled();
    expect(mocks.postGlEntry).toHaveBeenCalledTimes(1);
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
      __skipCutover: true,
    });

    expect(result).toBe(existing);
    expect(mocks.postGlEntry).not.toHaveBeenCalled();
  });
});
