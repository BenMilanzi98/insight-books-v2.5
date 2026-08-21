import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/accountingV2/application/manualJournalService.js', () => ({
  createManualJournalDraft: vi.fn(),
  postManualJournal: vi.fn(),
}));

vi.mock('../lib/accountingV2/adapters/bankingAdapter.js', () => ({
  postBankChargeAccounting: vi.fn(),
  postInterestIncomeAccounting: vi.fn(),
}));

import {
  createManualJournalDraft,
  postManualJournal,
} from '../lib/accountingV2/application/manualJournalService.js';
import { postBankChargeAccounting } from '../lib/accountingV2/adapters/bankingAdapter.js';
import { classifyAndAdjust } from '../lib/bankReconciliation/application/adjustmentService.js';

const context = { businessId: 'biz-1', userId: 'user-1' };

const recon = {
  id: 'rec-1',
  tenantId: 'biz-1',
  status: 'IN_PROGRESS',
  currency: 'MWK',
  coaAccountId: 'coa-bank',
  paymentAccountId: 'pa-1',
};

const stmt = {
  id: 'stmt-1',
  tenantId: 'biz-1',
  description: 'Bank fee',
  signedAmountMinor: -15000,
  transactionDate: new Date('2026-08-15'),
  matchingStatus: 'UNMATCHED',
};

function makeAdjustDb() {
  const statementUpdates = [];
  return {
    statementUpdates,
    bankRecReconciliation: {
      findFirst: vi.fn(async () => recon),
    },
    bankRecStatementTransaction: {
      findFirst: vi.fn(async () => ({ ...stmt })),
      update: vi.fn(async ({ where, data }) => {
        statementUpdates.push({ where, data });
        return { ...stmt, ...data };
      }),
    },
    bankRecAdjustmentLink: {
      create: vi.fn(async ({ data }) => ({ id: 'link-1', ...data })),
    },
    journalEntry: {
      update: vi.fn(async ({ where, data }) => ({ id: where.id, status: data.status })),
    },
  };
}

describe('classifyAndAdjust posting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts the bank-charge journal so book balance can include the amount', async () => {
    createManualJournalDraft.mockResolvedValue({ id: 'je-draft', status: 'Draft' });
    postManualJournal.mockResolvedValue({
      journalEntryId: 'je-draft',
      journal: { id: 'je-draft', status: 'Posted' },
    });

    const db = makeAdjustDb();
    const result = await classifyAndAdjust(
      db,
      context,
      {
        reconciliationId: recon.id,
        statementTransactionId: stmt.id,
        classification: 'BANK_CHARGE',
        postAdjustment: true,
        offsetAccountId: 'coa-exp',
      },
      { hasPermission: () => true }
    );

    expect(createManualJournalDraft).toHaveBeenCalledOnce();
    expect(postManualJournal).toHaveBeenCalledWith(
      context,
      'je-draft',
      expect.objectContaining({
        hasPermission: expect.any(Function),
        approvalOverride: expect.objectContaining({
          allowSelfApproval: true,
          approvedById: context.userId,
          createdById: context.userId,
          reason: 'bank_rec_create_missing',
        }),
      }),
      db
    );
    expect(db.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'je-draft' },
        data: expect.objectContaining({
          approvedById: context.userId,
        }),
      })
    );
    expect(result.posted.journal.status).toBe('Posted');
    expect(result.posted.journalEntryId).toBe('je-draft');
    expect(db.statementUpdates.some((u) => u.data.matchingStatus === 'MATCHED')).toBe(true);
    expect(db.statementUpdates.some((u) => u.data.remainingAmountMinor === 0)).toBe(true);
  });

  it('does not mark the statement MATCHED when posting fails', async () => {
    createManualJournalDraft.mockResolvedValue({ id: 'je-draft', status: 'Draft' });
    postManualJournal.mockRejectedValue(new Error('posting failed'));

    const db = makeAdjustDb();
    await expect(
      classifyAndAdjust(
        db,
        context,
        {
          reconciliationId: recon.id,
          statementTransactionId: stmt.id,
          classification: 'BANK_CHARGE',
          postAdjustment: true,
          offsetAccountId: 'coa-exp',
        },
        { hasPermission: () => true }
      )
    ).rejects.toThrow(/posting failed/);

    expect(db.statementUpdates.some((u) => u.data.matchingStatus === 'MATCHED')).toBe(false);
    expect(db.bankRecAdjustmentLink.create).not.toHaveBeenCalled();
  });

  it('keeps payment-backed bank charge posting which already posts', async () => {
    postBankChargeAccounting.mockResolvedValue({
      journalEntryId: 'je-pay',
      journal: { id: 'je-pay', status: 'Posted' },
    });

    const db = makeAdjustDb();
    const result = await classifyAndAdjust(
      db,
      context,
      {
        reconciliationId: recon.id,
        statementTransactionId: stmt.id,
        classification: 'BANK_CHARGE',
        postAdjustment: true,
        paymentId: 'pay-1',
      },
      { hasPermission: () => true }
    );

    expect(postBankChargeAccounting).toHaveBeenCalledOnce();
    expect(createManualJournalDraft).not.toHaveBeenCalled();
    expect(result.posted.journal.status).toBe('Posted');
    expect(db.statementUpdates.some((u) => u.data.matchingStatus === 'MATCHED')).toBe(true);
  });
});
