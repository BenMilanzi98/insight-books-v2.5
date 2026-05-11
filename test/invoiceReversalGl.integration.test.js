/**
 * Integration-style test: invoice reversal creates reversing GL Transaction rows
 * (sourceType Invoice) with swapped debits/credits. Uses mocked Prisma + balance helper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/accountBalanceService.js', () => ({
  updateAccountBalanceOnTransaction: vi.fn(() => Promise.resolve()),
  recalculateAccountBalance: vi.fn(() => Promise.resolve()),
}));

let refCounter = 0;
vi.mock('../lib/journalService.js', () => ({
  generateReferenceNumber: vi.fn(() => {
    refCounter += 1;
    return Promise.resolve(`REF-MOCK-${refCounter}`);
  }),
}));

const {
  prismaMock,
  tenantId,
  originalInvoiceId,
  accountAr,
  accountRev,
  accountCogs,
  accountInv,
  revenueTxn,
  cogsTxn,
  transactionsCreatedInTx,
  resetMocks,
} = vi.hoisted(() => {
  const tenantId_h = 'tenant-int-test';
  const originalInvoiceId_h = 'inv-original-1';
  const accountAr_h = 'acc-ar';
  const accountRev_h = 'acc-revenue';
  const accountCogs_h = 'acc-cogs';
  const accountInv_h = 'acc-inv';

  const originalInvoice = {
    id: originalInvoiceId_h,
    tenantId: tenantId_h,
    invoiceNumber: 'INV-9001',
    issueDate: new Date('2026-03-01'),
    subtotal: 1000,
    taxAmount: 0,
    total: 1000,
    totalPaid: 0,
    status: 'posted',
    clientId: 'client-1',
    branchId: null,
    discount: 0,
    originalTotal: 1000,
    remainingBalance: 1000,
    totalDiscountAmount: 0,
    isReversal: false,
  };

  const revenueTxn_h = {
    id: 'txn-revenue-original',
    tenantId: tenantId_h,
    sourceType: 'Invoice',
    sourceId: originalInvoiceId_h,
    status: 'posted',
    description: 'Invoice INV-9001 - Revenue Recognition',
    branchId: null,
    lines: [
      {
        lineNumber: 1,
        accountId: accountAr_h,
        debitAmount: 1000,
        creditAmount: 0,
        description: 'Accounts receivable',
        account: { accountName: 'AR' },
      },
      {
        lineNumber: 2,
        accountId: accountRev_h,
        debitAmount: 0,
        creditAmount: 1000,
        description: 'Revenue',
        account: { accountName: 'Sales' },
      },
    ],
  };

  const cogsTxn_h = {
    id: 'txn-cogs-original',
    tenantId: tenantId_h,
    sourceType: 'Invoice',
    sourceId: originalInvoiceId_h,
    status: 'posted',
    description: 'Invoice INV-9001 - COGS Recognition',
    branchId: null,
    lines: [
      {
        lineNumber: 1,
        accountId: accountCogs_h,
        debitAmount: 400,
        creditAmount: 0,
        description: 'COGS',
        account: { accountName: 'COGS' },
      },
      {
        lineNumber: 2,
        accountId: accountInv_h,
        debitAmount: 0,
        creditAmount: 400,
        description: 'Inventory',
        account: { accountName: 'Inventory' },
      },
    ],
  };

  const createdDuringTx = [];

  function makeTxApi() {
    return {
      invoice: {
        create: vi.fn(async ({ data }) => ({
          id: 'inv-reversal-new',
          ...data,
        })),
      },
      invoiceItem: {
        findMany: vi.fn(async () => []),
      },
      transaction: {
        findMany: vi.fn(async ({ where }) => {
          if (
            where?.sourceType === 'Invoice' &&
            where?.sourceId === originalInvoiceId_h &&
            where?.tenantId === tenantId_h
          ) {
            return [revenueTxn_h, cogsTxn_h];
          }
          return [];
        }),
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data, include }) => {
          const id = `txn-created-${createdDuringTx.length + 1}`;
          const rawCreates = data.lines?.create;
          const lineRows = Array.isArray(rawCreates)
            ? rawCreates.map((line, index) => ({
                id: `${id}-ln-${index + 1}`,
                ...line,
                debitAmount: Number(line.debitAmount ?? 0),
                creditAmount: Number(line.creditAmount ?? 0),
              }))
            : [];
          const { lines: _drop, ...rest } = data;
          const txn = {
            id,
            ...rest,
            lines: lineRows,
          };
          createdDuringTx.push(txn);
          return include?.lines ? txn : txn;
        }),
      },
      transactionLine: {
        create: vi.fn(async ({ data }) => ({ ...data, id: `tl-${createdDuringTx.length}` })),
      },
      auditLog: {
        create: vi.fn(async ({ data }) => data),
      },
    };
  }

  const prismaMock_h = {
    invoice: {
      findFirst: vi.fn(async ({ where }) => {
        if (where?.id === originalInvoiceId_h && where?.tenantId === tenantId_h) {
          return { ...originalInvoice };
        }
        if (where?.reversedTransactionId === originalInvoiceId_h && where?.isReversal === true) {
          return null;
        }
        return null;
      }),
    },
    accountingPeriod: {
      findFirst: vi.fn(async () => null),
    },
    transaction: {
      findMany: vi.fn(async ({ where }) => {
        if (where?.sourceType === 'Tax-Invoice' && where?.sourceId === originalInvoiceId_h) {
          return [];
        }
        return [];
      }),
    },
    $transaction: vi.fn(async (fn) => {
      const tx = makeTxApi();
      return fn(tx);
    }),
  };

  function resetMocks() {
    createdDuringTx.length = 0;
    refCounter = 0;
    vi.mocked(prismaMock_h.invoice.findFirst).mockClear();
    vi.mocked(prismaMock_h.transaction.findMany).mockClear();
    vi.mocked(prismaMock_h.$transaction).mockClear();
  }

  return {
    prismaMock: prismaMock_h,
    tenantId: tenantId_h,
    originalInvoiceId: originalInvoiceId_h,
    accountAr: accountAr_h,
    accountRev: accountRev_h,
    accountCogs: accountCogs_h,
    accountInv: accountInv_h,
    revenueTxn: revenueTxn_h,
    cogsTxn: cogsTxn_h,
    transactionsCreatedInTx: createdDuringTx,
    resetMocks,
  };
});

vi.mock('../lib/prisma.js', () => ({
  default: prismaMock,
}));

import { createInvoiceReversal } from '../lib/transactionReversalService.js';
import * as accountBalanceService from '../lib/accountBalanceService.js';
import { generateReferenceNumber } from '../lib/journalService.js';

const REVERSAL_REASON = 'Customer cancelled order per email confirmation dated March 2026';

describe('createInvoiceReversal — GL integration (mocked Prisma)', () => {
  beforeEach(() => {
    resetMocks();
    vi.mocked(accountBalanceService.updateAccountBalanceOnTransaction).mockClear();
  });

  it('creates one reversing Transaction per Invoice-source posting with swapped lines', async () => {
    const result = await createInvoiceReversal({
      invoiceId: originalInvoiceId,
      reversalReason: REVERSAL_REASON,
      userId: 'user-int-1',
      tenantId,
    });

    expect(result.invoiceGlReversals?.length).toBe(2);
    expect(result.invoiceGlReversals.map((r) => r.originalTransactionId)).toEqual([
      revenueTxn.id,
      cogsTxn.id,
    ]);

    expect(prismaMock.$transaction.mock.calls.length).toBe(1);

    const reversing = transactionsCreatedInTx.filter((t) => t.isReversal && t.sourceType === 'Invoice');
    expect(reversing.length).toBe(2);

    const revRevenue = reversing.find((t) => t.reversedTransactionId === revenueTxn.id);
    expect(revRevenue).toBeDefined();
    expect(revRevenue.lines).toHaveLength(2);
    expect(revRevenue.lines[0]).toMatchObject({
      accountId: accountAr,
      debitAmount: 0,
      creditAmount: 1000,
    });
    expect(revRevenue.lines[1]).toMatchObject({
      accountId: accountRev,
      debitAmount: 1000,
      creditAmount: 0,
    });

    const revCogs = reversing.find((t) => t.reversedTransactionId === cogsTxn.id);
    expect(revCogs).toBeDefined();
    expect(revCogs.lines[0]).toMatchObject({
      accountId: accountCogs,
      debitAmount: 0,
      creditAmount: 400,
    });
    expect(revCogs.lines[1]).toMatchObject({
      accountId: accountInv,
      debitAmount: 400,
      creditAmount: 0,
    });

    const balCalls = vi.mocked(accountBalanceService.updateAccountBalanceOnTransaction).mock.calls;
    const netByAccount = new Map();
    for (const [accountId, debit, credit] of balCalls) {
      const prev = netByAccount.get(accountId) || { debit: 0, credit: 0 };
      netByAccount.set(accountId, {
        debit: prev.debit + Number(debit),
        credit: prev.credit + Number(credit),
      });
    }

    expect(netByAccount.get(accountAr)).toEqual({ debit: 0, credit: 1000 });
    expect(netByAccount.get(accountRev)).toEqual({ debit: 1000, credit: 0 });
    expect(netByAccount.get(accountCogs)).toEqual({ debit: 0, credit: 400 });
    expect(netByAccount.get(accountInv)).toEqual({ debit: 400, credit: 0 });

    expect(generateReferenceNumber).toHaveBeenCalledTimes(2);
  });
});
