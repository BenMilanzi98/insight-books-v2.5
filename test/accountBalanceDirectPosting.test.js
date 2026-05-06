import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    account: {
      findUnique,
      update,
    },
  },
}));

import prisma from '../lib/prisma.js';
import { updateAccountBalanceOnTransaction } from '../lib/accountBalanceService.js';

describe('updateAccountBalanceOnTransaction — consolidation guard', () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
  });

  it('throws when account is a parent with active children', async () => {
    findUnique.mockResolvedValue({
      id: 'parent-exp',
      accountType: 'Expense',
      normalBalance: 'Debit',
      balance: 100,
      accountCode: '5200',
      code: '5200',
      accountName: 'Operating Expenses',
      name: null,
      acceptsNewTransactions: true,
      _count: { childAccounts: 2 },
    });

    await expect(
      updateAccountBalanceOnTransaction('parent-exp', 50, 0, prisma),
    ).rejects.toThrow(/consolidation parent/);

    expect(update).not.toHaveBeenCalled();
  });

  it('updates balance for a leaf expense account', async () => {
    findUnique.mockResolvedValue({
      id: 'leaf-exp',
      accountType: 'Expense',
      normalBalance: 'Debit',
      balance: 100,
      accountCode: '5210',
      code: '5210',
      accountName: 'Office',
      name: null,
      acceptsNewTransactions: true,
      _count: { childAccounts: 0 },
    });
    update.mockResolvedValue({});

    const bal = await updateAccountBalanceOnTransaction('leaf-exp', 50, 0, prisma);

    expect(bal).toBe(150);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'leaf-exp' },
      data: { balance: 150 },
    });
  });

  it('no-ops zero amounts without throwing on parent', async () => {
    findUnique.mockResolvedValue({
      id: 'parent',
      accountType: 'Expense',
      normalBalance: 'Debit',
      balance: 0,
      accountCode: '5200',
      acceptsNewTransactions: true,
      _count: { childAccounts: 5 },
    });

    const bal = await updateAccountBalanceOnTransaction('parent', 0, 0, prisma);
    expect(bal).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
