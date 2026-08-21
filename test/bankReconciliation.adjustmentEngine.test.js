/**
 * Create-missing adjustments must POST through the engine with self-approval
 * override. ADJUSTMENT_POSTED requires approval facts + SoD unless
 * metadata.approvalOverride.allowSelfApproval is set.
 */
import { describe, expect, it } from 'vitest';
import { makeAcctV2PrismaStub } from './helpers/acctV2PrismaStub.js';
import { FLAG, PERIOD_FLAGS } from '../lib/accountingV2/infrastructure/featureFlags.js';
import { EventRegistryStatus } from '../lib/accountingV2/domain/enums.js';
import { classifyAndAdjust } from '../lib/bankReconciliation/application/adjustmentService.js';

const T1 = 'biz-1';
const USER = 'user-1';

const newEngineSeed = () => ({
  configurations: [
    {
      id: 'cfg1',
      tenantId: T1,
      baseCurrency: 'MWK',
      defaultPostingMode: 'NEW_ENGINE',
      enableShadowAccounting: true,
    },
  ],
  featureFlags: [
    { id: 'f1', tenantId: T1, flagKey: FLAG.V2_ENABLED, moduleKey: '*', eventType: '*', enabled: true },
    // Keep period resolution on the legacy unconfigured path so this test isolates SoD/approval.
    { id: 'f2', tenantId: T1, flagKey: PERIOD_FLAGS.RESOLVER_V2, moduleKey: '*', eventType: '*', enabled: false },
  ],
});

const postingAccounts = () => [
  { id: 'coa-bank', tenantId: T1, accountCode: '1100', accountName: 'Bank', isActive: true },
  { id: 'coa-exp', tenantId: T1, accountCode: '6100', accountName: 'Bank charges', isActive: true },
];

const recon = {
  id: 'rec-1',
  tenantId: T1,
  status: 'IN_PROGRESS',
  currency: 'MWK',
  coaAccountId: 'coa-bank',
  paymentAccountId: 'pa-1',
};

const stmt = {
  id: 'stmt-1',
  tenantId: T1,
  description: 'Bank fee',
  signedAmountMinor: -15000,
  transactionDate: new Date('2026-08-15T00:00:00.000Z'),
  matchingStatus: 'UNMATCHED',
};

function wrapBankRec(client) {
  const statementUpdates = [];
  return {
    statementUpdates,
    db: {
      ...client,
      bankRecReconciliation: {
        findFirst: async () => recon,
      },
      bankRecStatementTransaction: {
        findFirst: async () => ({ ...stmt }),
        update: async ({ where, data }) => {
          statementUpdates.push({ where, data });
          return { ...stmt, ...data };
        },
      },
      bankRecAdjustmentLink: {
        create: async ({ data }) => ({ id: 'link-1', ...data }),
      },
    },
  };
}

describe('classifyAndAdjust engine posting (no postManualJournal mock)', () => {
  it('posts create-missing as the same user via approvalOverride and only then MATCHED', async () => {
    const { client, data } = makeAcctV2PrismaStub({
      ...newEngineSeed(),
      accounts: postingAccounts(),
    });
    const { db, statementUpdates } = wrapBankRec(client);

    const result = await classifyAndAdjust(
      db,
      { businessId: T1, userId: USER },
      {
        reconciliationId: recon.id,
        statementTransactionId: stmt.id,
        classification: 'BANK_CHARGE',
        postAdjustment: true,
        offsetAccountId: 'coa-exp',
      },
      { hasPermission: () => true }
    );

    const postedJournal = data.legacyJournalEntries.find(
      (j) => j.id === result.posted.journalEntryId || j.status === 'Posted'
    );
    expect(postedJournal?.status).toBe('Posted');
    expect(postedJournal?.approvedById).toBe(USER);
    expect(postedJournal?.approvedAt).toBeTruthy();
    expect(result.posted.journal.status).toBe('Posted');

    const event = data.eventRegistry.find((e) => e.id === postedJournal.accountingEventId);
    expect(event?.status).toBe(EventRegistryStatus.POSTED);
    expect(event?.eventType).toBe('ADJUSTMENT_POSTED');

    expect(statementUpdates.some((u) => u.data.matchingStatus === 'MATCHED')).toBe(true);
    expect(statementUpdates.some((u) => u.data.remainingAmountMinor === 0)).toBe(true);
  });
});
