/**
 * Unit tests for V2 tax provision → tax-account balance aggregation.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  applyV2TaxProvisionJournalsOnAccount,
  V2_TAX_ASSESSMENT_SOURCE_TYPES,
} from '../lib/taxAccountPostedJournalAggregation.js';
import { CIT_SOURCE_TYPE } from '../lib/accountingV2/reporting/citProvisionService.js';

describe('V2 tax provision journal sweep', () => {
  it('includes CitProvision in assessment source types', () => {
    expect(V2_TAX_ASSESSMENT_SOURCE_TYPES).toContain(CIT_SOURCE_TYPE);
  });

  it('adds CitProvision liability credits to totalCollected', async () => {
    const totals = { totalCollected: 0, totalPaid: 0, totalRefunded: 0 };
    const prisma = {
      journalEntryLine: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'l1',
            debitAmount: 0,
            creditAmount: 3000,
            description: 'CIT provision',
            journalEntry: {
              id: 'j1',
              journalNumber: 'TAX-1',
              referenceNumber: null,
              postingDate: new Date('2026-08-14'),
              entryDate: new Date('2026-08-14'),
              description: 'Corporate Income Tax provision',
              sourceType: 'CitProvision',
              sourceId: 'cit:2026-01-01_2026-08-14',
              isReversal: false,
            },
          },
        ]),
      },
    };

    const taxType = {
      id: 'cit-1',
      taxId: 'MW-CIT',
      taxCode: 'MW-CIT',
      taxName: 'Corporate Income Tax',
      accountId: 'acc-cit',
      account: { accountType: 'Liability', accountCode: '2045-03' },
    };

    await applyV2TaxProvisionJournalsOnAccount(
      prisma,
      { tenantId: 't1' },
      taxType,
      { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') },
      { totals, allTaxTypes: [taxType] }
    );

    expect(totals.totalCollected).toBe(3000);
    expect(totals.totalRefunded).toBe(0);
    expect(prisma.journalEntryLine.findMany).toHaveBeenCalled();
  });

  it('does not attribute CitProvision to non-CIT tax types on a shared GL', async () => {
    const totals = { totalCollected: 0, totalPaid: 0, totalRefunded: 0 };
    const prisma = {
      journalEntryLine: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'l1',
            debitAmount: 0,
            creditAmount: 262500,
            journalEntry: {
              id: 'j1',
              postingDate: new Date('2026-08-14'),
              entryDate: new Date('2026-08-14'),
              sourceType: 'CitProvision',
              isReversal: false,
            },
          },
        ]),
      },
    };

    await applyV2TaxProvisionJournalsOnAccount(
      prisma,
      { tenantId: 't1' },
      {
        id: 'vat-1',
        taxId: 'MW-VAT',
        taxCode: 'VAT',
        taxName: 'VAT',
        accountId: 'acc-cit',
        account: { accountType: 'Liability', accountCode: '2045-03' },
      },
      {},
      { totals }
    );

    expect(totals.totalCollected).toBe(0);
    expect(prisma.journalEntryLine.findMany).not.toHaveBeenCalled();
  });

  it('treats CitProvision reverse debits as refunded', async () => {
    const totals = { totalCollected: 0, totalPaid: 0, totalRefunded: 0 };
    const prisma = {
      journalEntryLine: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'l2',
            debitAmount: 500,
            creditAmount: 0,
            description: 'CIT reverse',
            journalEntry: {
              id: 'j2',
              journalNumber: 'TAX-2',
              postingDate: new Date('2026-08-14'),
              entryDate: new Date('2026-08-14'),
              sourceType: 'CitProvision',
              sourceId: 'cit:x',
              isReversal: true,
            },
          },
        ]),
      },
    };

    const taxType = {
      id: 'cit-1',
      taxId: 'MW-CIT',
      taxCode: 'MW-CIT',
      taxName: 'Corporate Income Tax',
      accountId: 'acc-cit',
      account: { accountType: 'Liability', accountCode: '2045-03' },
    };

    await applyV2TaxProvisionJournalsOnAccount(
      prisma,
      { tenantId: 't1' },
      taxType,
      {},
      { totals, allTaxTypes: [taxType] }
    );

    expect(totals.totalRefunded).toBe(500);
    expect(totals.totalCollected).toBe(0);
  });
});
