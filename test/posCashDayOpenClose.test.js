import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getSystemCashPaymentAccount,
  resolvePaymentAccountBalance,
  ensurePosTillFloatPaymentAccount,
  resolveOwnerCapitalCoaAccount,
  sumCashSalesForPosDay,
  postBankTransferAccounting,
} = vi.hoisted(() => ({
  getSystemCashPaymentAccount: vi.fn(),
  resolvePaymentAccountBalance: vi.fn(),
  ensurePosTillFloatPaymentAccount: vi.fn(),
  resolveOwnerCapitalCoaAccount: vi.fn(),
  sumCashSalesForPosDay: vi.fn(),
  postBankTransferAccounting: vi.fn(),
}));

vi.mock('../lib/paymentAccountBalanceResolver', () => ({
  getSystemCashPaymentAccount,
  resolvePaymentAccountBalance,
}));

vi.mock('../lib/posTillFloatAccounts.js', () => ({
  ensurePosTillFloatPaymentAccount,
  resolveOwnerCapitalCoaAccount,
}));

vi.mock('../lib/posDailyReportService', () => ({
  sumCashSalesForPosDay,
}));

vi.mock('../lib/accountingV2/adapters/remainingAdapters.js', () => ({
  postBankTransferAccounting,
}));

import {
  POS_CASH_BRANCH_KEY,
  assertPosTillOpenForSale,
  closePosCashDayManual,
  closeStalePosCashDays,
  openPosCashDay,
} from '../lib/posCashDayService.js';

function makeClient() {
  return {
    posCashDay: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    posCashDayDeposit: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    paymentAccount: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  };
}

describe('openPosCashDay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSystemCashPaymentAccount.mockResolvedValue({
      id: 'cash-pa',
      name: 'System Cash',
      accountType: 'Cash',
      coaAccountId: 'cash-coa',
    });
    resolvePaymentAccountBalance.mockResolvedValue(200);
    ensurePosTillFloatPaymentAccount.mockResolvedValue({
      id: 'till-pa',
      coaAccountId: 'till-coa',
    });
    resolveOwnerCapitalCoaAccount.mockResolvedValue({ id: 'capital-coa' });
    sumCashSalesForPosDay.mockResolvedValue({
      totalCashSales: 0,
      report: { totalSales: 0 },
    });
    postBankTransferAccounting.mockResolvedValue({ id: 'journal-1' });
  });

  it('treats omitted opening balance as 0', async () => {
    const client = makeClient();
    client.posCashDay.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'day-1',
        status: 'OPEN',
        openingBalance: 0,
        systemCashAccountId: 'cash-pa',
        systemCashAccount: { id: 'cash-pa', name: 'System Cash', accountType: 'Cash' },
        deposits: [],
      });
    client.posCashDay.create.mockResolvedValueOnce({
      id: 'day-1',
      openCount: 1,
    });

    const result = await openPosCashDay({
      tenantId: 'tenant-1',
      userId: 'user-1',
      businessDate: '2026-08-11',
      client,
    });

    expect(client.posCashDay.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant: { connect: { id: 'tenant-1' } },
        branchKey: POS_CASH_BRANCH_KEY,
        businessDate: '2026-08-11',
        status: 'OPEN',
        systemCashAccount: { connect: { id: 'cash-pa' } },
        tillFloatAccount: { connect: { id: 'till-pa' } },
        openingBalance: 0,
        openedBy: { connect: { id: 'user-1' } },
        openCount: 1,
      }),
    });
    expect(postBankTransferAccounting).not.toHaveBeenCalled();
    expect(result.openingBalance).toBe(0);
  });

  it('splits funding cash-first when amount exceeds live cash and posts the journal', async () => {
    const client = makeClient();
    resolvePaymentAccountBalance.mockResolvedValueOnce(200);
    client.posCashDay.findUnique.mockResolvedValueOnce(null);
    client.posCashDay.create.mockResolvedValueOnce({
      id: 'day-2',
      openCount: 1,
    });
    client.posCashDay.update.mockResolvedValueOnce({
      id: 'day-2',
      openFundingJournalId: 'journal-1',
      fundingCashAmount: 200,
      fundingCapitalAmount: 300,
      systemCashAccount: { id: 'cash-pa', name: 'System Cash', accountType: 'Cash' },
      deposits: [],
    });

    await openPosCashDay({
      tenantId: 'tenant-1',
      userId: 'user-1',
      businessDate: '2026-08-11',
      openingBalance: 500,
      client,
    });

    expect(resolveOwnerCapitalCoaAccount).toHaveBeenCalledWith('tenant-1', client);
    expect(postBankTransferAccounting).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sourceType: 'PosCashDayOpen',
        sourceId: 'day-2_open_1',
        amount: 500,
        fromAccountId: 'cash-coa',
        toAccountId: 'till-coa',
        lines: expect.arrayContaining([
          expect.objectContaining({ accountId: 'till-coa', debitAmount: 500 }),
          expect.objectContaining({ accountId: 'cash-coa', creditAmount: 200 }),
          expect.objectContaining({ accountId: 'capital-coa', creditAmount: 300 }),
        ]),
      })
    );
    expect(client.posCashDay.update).toHaveBeenCalledWith({
      where: { id: 'day-2' },
      data: {
        openFundingJournalId: 'journal-1',
        fundingCashAmount: 200,
        fundingCapitalAmount: 300,
      },
      include: {
        systemCashAccount: { select: { id: true, name: true, accountType: true } },
        deposits: true,
      },
    });
  });

  it('throws CAPITAL_UNMAPPED when capital funding is required without owner capital mapping', async () => {
    const client = makeClient();
    client.posCashDay.findUnique.mockResolvedValueOnce(null);
    resolvePaymentAccountBalance.mockResolvedValueOnce(200);
    resolveOwnerCapitalCoaAccount.mockResolvedValueOnce(null);

    await expect(
      openPosCashDay({
        tenantId: 'tenant-1',
        userId: 'user-1',
        businessDate: '2026-08-11',
        openingBalance: 500,
        client,
      })
    ).rejects.toMatchObject({ code: 'CAPITAL_UNMAPPED' });

    expect(client.posCashDay.create).not.toHaveBeenCalled();
    expect(postBankTransferAccounting).not.toHaveBeenCalled();
  });

  it('throws TILL_FLOAT_UNMAPPED when the till float account has no coa link', async () => {
    const client = makeClient();
    client.posCashDay.findUnique.mockResolvedValueOnce(null);
    ensurePosTillFloatPaymentAccount.mockResolvedValueOnce({ id: 'till-pa', coaAccountId: null });

    await expect(
      openPosCashDay({
        tenantId: 'tenant-1',
        userId: 'user-1',
        businessDate: '2026-08-11',
        openingBalance: 100,
        client,
      })
    ).rejects.toMatchObject({ code: 'TILL_FLOAT_UNMAPPED' });
  });

  it('throws CASH_COA_UNMAPPED when cash funding is needed but system cash has no coa link', async () => {
    const client = makeClient();
    client.posCashDay.findUnique.mockResolvedValueOnce(null);
    getSystemCashPaymentAccount.mockResolvedValueOnce({
      id: 'cash-pa',
      name: 'System Cash',
      accountType: 'Cash',
      coaAccountId: null,
    });
    resolvePaymentAccountBalance.mockResolvedValueOnce(100);

    await expect(
      openPosCashDay({
        tenantId: 'tenant-1',
        userId: 'user-1',
        businessDate: '2026-08-11',
        openingBalance: 100,
        client,
      })
    ).rejects.toMatchObject({ code: 'CASH_COA_UNMAPPED' });
  });

  it('reopens a closed same-day row instead of throwing ALREADY_CLOSED', async () => {
    const client = makeClient();
    client.posCashDay.findUnique
      .mockResolvedValueOnce({
        id: 'day-3',
        status: 'CLOSED',
        openCount: 1,
      })
      .mockResolvedValueOnce({
        id: 'day-3',
        status: 'OPEN',
        openingBalance: 0,
        systemCashAccountId: 'cash-pa',
        systemCashAccount: { id: 'cash-pa', name: 'System Cash', accountType: 'Cash' },
        deposits: [],
      });
    client.posCashDay.update.mockResolvedValueOnce({
      id: 'day-3',
      status: 'OPEN',
      openCount: 2,
    });

    await expect(
      openPosCashDay({
        tenantId: 'tenant-1',
        userId: 'user-1',
        businessDate: '2026-08-11',
        client,
      })
    ).resolves.toMatchObject({ id: 'day-3', status: 'OPEN' });
  });

  it('increments openCount when reopening a closed row', async () => {
    const client = makeClient();
    client.posCashDay.findUnique
      .mockResolvedValueOnce({
        id: 'day-4',
        status: 'CLOSED',
        openCount: 2,
      })
      .mockResolvedValueOnce({
        id: 'day-4',
        status: 'OPEN',
        openingBalance: 0,
        systemCashAccountId: 'cash-pa',
        systemCashAccount: { id: 'cash-pa', name: 'System Cash', accountType: 'Cash' },
        deposits: [],
      });
    client.posCashDay.update.mockResolvedValueOnce({
      id: 'day-4',
      status: 'OPEN',
      openCount: 3,
    });

    await openPosCashDay({
      tenantId: 'tenant-1',
      userId: 'user-1',
      businessDate: '2026-08-11',
      client,
    });

    expect(client.posCashDay.update).toHaveBeenCalledWith({
      where: { id: 'day-4' },
      data: expect.objectContaining({
        status: 'OPEN',
        openCount: 3,
        reopenedAt: expect.any(Date),
        openFundingJournalId: null,
        fundingCashAmount: null,
        fundingCapitalAmount: null,
        closedAt: null,
        closedBy: { disconnect: true },
      }),
    });
  });

  it('deletes a newly created day when opening funding post fails', async () => {
    const client = makeClient();
    const fundingError = new Error('posting failed');
    fundingError.code = 'POST_FAILED';
    client.posCashDay.findUnique.mockResolvedValueOnce(null);
    client.posCashDay.create.mockResolvedValueOnce({
      id: 'day-create-fail',
      openCount: 1,
    });
    postBankTransferAccounting.mockRejectedValueOnce(fundingError);

    await expect(
      openPosCashDay({
        tenantId: 'tenant-1',
        userId: 'user-1',
        businessDate: '2026-08-11',
        openingBalance: 150,
        client,
      })
    ).rejects.toMatchObject({ code: 'POST_FAILED', message: 'posting failed' });

    expect(client.posCashDay.delete).toHaveBeenCalledWith({
      where: { id: 'day-create-fail' },
    });
    expect(client.posCashDay.update).not.toHaveBeenCalled();
  });

  it('restores the previous closed state when reopening funding post fails', async () => {
    const client = makeClient();
    const closedAt = new Date('2026-08-10T18:00:00.000Z');
    const fundingError = new Error('posting failed');
    fundingError.code = 'POST_FAILED';
    client.posCashDay.findUnique.mockResolvedValueOnce({
      id: 'day-reopen-fail',
      status: 'CLOSED',
      openingBalance: 45,
      systemCashAccountId: 'cash-pa-old',
      tillFloatAccountId: 'till-pa-old',
      openedAt: new Date('2026-08-10T08:00:00.000Z'),
      openedById: 'user-old',
      closedAt,
      closedById: 'closer-1',
      autoClosed: true,
      totalSalesAtClose: 225,
      closingBalanceAtClose: 270,
      totalCashSalesSnapshot: 180,
      closeSweepJournalId: 'close-journal-1',
      openFundingJournalId: 'open-journal-old',
      fundingCashAmount: 25,
      fundingCapitalAmount: 20,
      openCount: 2,
      reopenedAt: null,
    });
    client.posCashDay.update
      .mockResolvedValueOnce({
        id: 'day-reopen-fail',
        status: 'OPEN',
        openCount: 3,
      })
      .mockResolvedValueOnce({
        id: 'day-reopen-fail',
        status: 'CLOSED',
        openCount: 2,
      });
    postBankTransferAccounting.mockRejectedValueOnce(fundingError);

    await expect(
      openPosCashDay({
        tenantId: 'tenant-1',
        userId: 'user-1',
        businessDate: '2026-08-11',
        openingBalance: 150,
        client,
      })
    ).rejects.toMatchObject({ code: 'POST_FAILED', message: 'posting failed' });

    expect(client.posCashDay.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'day-reopen-fail' },
        data: expect.objectContaining({
          status: 'CLOSED',
          openingBalance: 45,
          systemCashAccount: { connect: { id: 'cash-pa-old' } },
          tillFloatAccount: { connect: { id: 'till-pa-old' } },
          openedAt: expect.any(Date),
          openedBy: { connect: { id: 'user-old' } },
          closedAt,
          closedBy: { connect: { id: 'closer-1' } },
          autoClosed: true,
          totalSalesAtClose: 225,
          closingBalanceAtClose: 270,
          totalCashSalesSnapshot: 180,
          closeSweepJournalId: 'close-journal-1',
          openFundingJournalId: 'open-journal-old',
          fundingCashAmount: 25,
          fundingCapitalAmount: 20,
          openCount: 2,
          reopenedAt: null,
        }),
      })
    );
    expect(client.posCashDay.delete).not.toHaveBeenCalled();
  });

  it('annotates the original error when compensation rollback also fails', async () => {
    const client = makeClient();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fundingError = new Error('posting failed');
    fundingError.code = 'POST_FAILED';
    const rollbackError = new Error('rollback delete failed');
    client.posCashDay.findUnique.mockResolvedValueOnce(null);
    client.posCashDay.create.mockResolvedValueOnce({
      id: 'day-create-comp-fail',
      openCount: 1,
    });
    postBankTransferAccounting.mockRejectedValueOnce(fundingError);
    client.posCashDay.delete.mockRejectedValueOnce(rollbackError);

    try {
      await openPosCashDay({
        tenantId: 'tenant-1',
        userId: 'user-1',
        businessDate: '2026-08-11',
        openingBalance: 150,
        client,
      });
      throw new Error('expected openPosCashDay to throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'POST_FAILED',
        compensationFailed: true,
        compensationError: rollbackError,
      });
      expect(error.message).toContain('Compensation failed');
    }

    expect(consoleError).toHaveBeenCalledWith(
      'POS cash day open compensation failed:',
      expect.objectContaining({
        dayId: 'day-create-comp-fail',
        mode: 'create',
        error: 'rollback delete failed',
      })
    );
    consoleError.mockRestore();
  });

  it('flags a possible orphan funding journal when journal metadata update fails', async () => {
    const client = makeClient();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const metadataError = new Error('journal link update failed');
    client.posCashDay.findUnique.mockResolvedValueOnce(null);
    client.posCashDay.create.mockResolvedValueOnce({
      id: 'day-orphan-risk',
      openCount: 1,
    });
    postBankTransferAccounting.mockResolvedValueOnce({ id: 'journal-orphan-1' });
    client.posCashDay.update.mockRejectedValueOnce(metadataError);

    try {
      await openPosCashDay({
        tenantId: 'tenant-1',
        userId: 'user-1',
        businessDate: '2026-08-11',
        openingBalance: 150,
        client,
      });
      throw new Error('expected openPosCashDay to throw');
    } catch (error) {
      expect(error).toMatchObject({
        orphanFundingJournalPossible: true,
      });
      expect(error.message).toContain('Operator review may be required');
    }

    expect(client.posCashDay.delete).toHaveBeenCalledWith({
      where: { id: 'day-orphan-risk' },
    });
    expect(consoleError).toHaveBeenCalledWith(
      'POS cash day open funding journal may be orphaned after rollback:',
      expect.objectContaining({
        dayId: 'day-orphan-risk',
        mode: 'create',
        journalId: 'journal-orphan-1',
        sourceId: 'day-orphan-risk_open_1',
      })
    );
    consoleError.mockRestore();
  });
});

describe('closePosCashDay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sumCashSalesForPosDay.mockResolvedValue({
      totalCashSales: 30,
      report: { totalSales: 30 },
    });
    resolvePaymentAccountBalance.mockResolvedValue(125);
    postBankTransferAccounting.mockResolvedValue({ id: 'journal-close-1' });
  });

  it('posts a till close sweep into cash and stores the journal id', async () => {
    const client = makeClient();
    client.posCashDay.findUnique
      .mockResolvedValueOnce({
        id: 'day-close-1',
        status: 'OPEN',
        businessDate: '2026-08-11',
        openingBalance: 100,
        systemCashAccountId: 'cash-pa',
        tillFloatAccountId: 'till-pa',
        openedById: 'opener-1',
        openCount: 2,
      })
      .mockResolvedValueOnce({
        id: 'day-close-1',
        status: 'CLOSED',
        closeSweepJournalId: 'journal-close-1',
      });
    client.paymentAccount.findUnique.mockResolvedValueOnce({
      id: 'cash-pa',
      coaAccountId: 'cash-coa',
    });
    client.paymentAccount.findFirst.mockResolvedValueOnce({
      id: 'till-pa',
      coaAccountId: 'till-coa',
    });
    client.posCashDayDeposit.findMany.mockResolvedValueOnce([]);

    await closePosCashDayManual({
      tenantId: 'tenant-1',
      userId: 'closer-1',
      businessDate: '2026-08-11',
      client,
    });

    expect(client.posCashDayDeposit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        posCashDayId: 'day-close-1',
        toAccountId: 'cash-pa',
        amount: 130,
        isAutoSweep: true,
        createdById: 'closer-1',
      }),
    });
    expect(postBankTransferAccounting).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'closer-1',
        sourceType: 'PosCashDayClose',
        sourceId: 'day-close-1_close_2',
        amount: 125,
        fromAccountId: 'till-coa',
        toAccountId: 'cash-coa',
        lines: [
          expect.objectContaining({ accountId: 'cash-coa', debitAmount: 125 }),
          expect.objectContaining({ accountId: 'till-coa', creditAmount: 125 }),
        ],
      })
    );
    expect(client.posCashDay.update).toHaveBeenCalledWith({
      where: { id: 'day-close-1' },
      data: expect.objectContaining({
        status: 'CLOSED',
        closedBy: { connect: { id: 'closer-1' } },
        autoClosed: false,
        totalSalesAtClose: 30,
        closingBalanceAtClose: 130,
        totalCashSalesSnapshot: 30,
        closeSweepJournalId: 'journal-close-1',
      }),
    });
  });

  it('fails manual close when the till needs a GL sweep but no actor is available', async () => {
    const client = makeClient();
    client.posCashDay.findUnique.mockResolvedValueOnce({
      id: 'day-close-2',
      status: 'OPEN',
      businessDate: '2026-08-11',
      openingBalance: 100,
      systemCashAccountId: 'cash-pa',
      tillFloatAccountId: 'till-pa',
      openedById: null,
      openCount: 1,
    });
    client.paymentAccount.findUnique.mockResolvedValueOnce({
      id: 'cash-pa',
      coaAccountId: 'cash-coa',
    });
    client.paymentAccount.findFirst.mockResolvedValueOnce({
      id: 'till-pa',
      coaAccountId: 'till-coa',
    });
    client.posCashDayDeposit.findMany.mockResolvedValueOnce([]);

    await expect(
      closePosCashDayManual({
        tenantId: 'tenant-1',
        userId: null,
        businessDate: '2026-08-11',
        client,
      })
    ).rejects.toMatchObject({
      code: 'CLOSE_USER_REQUIRED',
      message: 'Cannot close till: missing user for GL sweep.',
    });

    expect(client.posCashDayDeposit.create).not.toHaveBeenCalled();
    expect(postBankTransferAccounting).not.toHaveBeenCalled();
    expect(client.posCashDay.update).not.toHaveBeenCalled();
  });

  it('auto-closes operationally and skips the GL sweep when no actor is available', async () => {
    const client = makeClient();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    client.posCashDay.findMany.mockResolvedValueOnce([
      {
        id: 'day-auto-1',
        status: 'OPEN',
        businessDate: '2026-08-11',
        openingBalance: 100,
        systemCashAccountId: 'cash-pa',
        tillFloatAccountId: 'till-pa',
        openedById: null,
        openCount: 1,
      },
    ]);
    client.paymentAccount.findUnique.mockResolvedValueOnce({
      id: 'cash-pa',
      coaAccountId: 'cash-coa',
    });
    client.paymentAccount.findFirst.mockResolvedValueOnce({
      id: 'till-pa',
      coaAccountId: 'till-coa',
    });
    client.posCashDayDeposit.findMany.mockResolvedValueOnce([]);

    await expect(
      closeStalePosCashDays('tenant-1', '2026-08-12', null, client)
    ).resolves.toBe(1);

    expect(postBankTransferAccounting).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'POS till close auto-sweep skipped: missing actor for GL posting.',
      expect.objectContaining({ posCashDayId: 'day-auto-1', tenantId: 'tenant-1' })
    );
    expect(client.posCashDay.update).toHaveBeenCalledWith({
      where: { id: 'day-auto-1' },
      data: expect.objectContaining({
        status: 'CLOSED',
        closedBy: { disconnect: true },
        autoClosed: true,
        closeSweepJournalId: null,
      }),
    });

    consoleError.mockRestore();
  });
});

describe('assertPosTillOpenForSale', () => {
  it('uses the softened till-not-open message', async () => {
    const client = makeClient();
    client.posCashDay.findUnique.mockResolvedValueOnce(null);

    await expect(
      assertPosTillOpenForSale('tenant-1', {
        businessDate: '2026-08-11',
        client,
      })
    ).rejects.toMatchObject({
      code: 'TILL_NOT_OPEN',
      message: 'POS till is not open for today. Open the till before making sales.',
    });
  });
});
