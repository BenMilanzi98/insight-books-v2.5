import { describe, expect, it, vi, beforeEach } from 'vitest';

const journalEntryLineAggregate = vi.fn();
const transactionLineAggregate = vi.fn();

const client = {
  transactionLine: { aggregate: transactionLineAggregate },
  journalEntryLine: { aggregate: journalEntryLineAggregate },
};

describe('sumNetCogsDebitMinusCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionLineAggregate.mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } });
    journalEntryLineAggregate.mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } });
  });

  it('adds V2 Invoice-COGS / Sale-COGS journal net to legacy transactionLine net', async () => {
    transactionLineAggregate
      .mockResolvedValueOnce({ _sum: { debitAmount: 10 } })
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } });
    journalEntryLineAggregate
      .mockResolvedValueOnce({ _sum: { debitAmount: 100000 } })
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } });

    const { sumNetCogsDebitMinusCredit } = await import('../lib/dashboardCogsNet.js');
    const net = await sumNetCogsDebitMinusCredit(client, {
      cogsAccountIds: ['acc-cogs'],
      transactionWhere: {
        tenantId: 't1',
        date: {
          gte: new Date('2026-08-10T00:00:00.000Z'),
          lte: new Date('2026-08-10T23:59:59.999Z'),
        },
        status: 'posted',
      },
    });

    expect(net).toBe(100010);
    expect(journalEntryLineAggregate).toHaveBeenCalled();
    const v2DebitWhere = journalEntryLineAggregate.mock.calls[0][0].where;
    expect(v2DebitWhere.accountId).toEqual({ in: ['acc-cogs'] });
    expect(v2DebitWhere.journalEntry.AND).toEqual(
      expect.arrayContaining([{ sourceType: { in: ['Sale-COGS', 'Invoice-COGS'] } }])
    );
  });
});
