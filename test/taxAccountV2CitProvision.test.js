/**
 * Unit tests for V2 tax provision → tax-account balance aggregation.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  applyV2TaxProvisionJournalsOnAccount,
  isCanonicalOwnerOfLinkedTaxAccount,
  isCorporateIncomeTaxType,
  V2_TAX_ASSESSMENT_SOURCE_TYPES,
} from '../lib/taxAccountPostedJournalAggregation.js';
import { CIT_SOURCE_TYPE } from '../lib/accountingV2/reporting/citProvisionService.js';

describe('V2 tax provision journal sweep', () => {
  it('includes CitProvision in assessment source types', () => {
    expect(V2_TAX_ASSESSMENT_SOURCE_TYPES).toContain(CIT_SOURCE_TYPE);
  });

  it('recognises versioned MW-CIT tax ids as corporate income tax', () => {
    expect(isCorporateIncomeTaxType({ taxId: 'MW-CIT-vmssc731p', taxName: 'Corporate Income Tax' })).toBe(
      true
    );
    expect(isCorporateIncomeTaxType({ taxId: 'MW-VAT', taxName: 'VAT' })).toBe(false);
  });

  it('prefers Active versioned MW-CIT as canonical owner of 2045-03', () => {
    const active = {
      id: 'active-1',
      taxId: 'MW-CIT-vmssc731p',
      taxCode: 'MW-CIT-vmssc731p',
      status: 'Active',
      accountId: 'acc-cit',
      account: { accountCode: '2045-03' },
    };
    const replaced = {
      id: 'old-1',
      taxId: 'MW-CIT',
      taxCode: 'MW-CIT',
      status: 'Inactive',
      accountId: 'acc-cit',
      account: { accountCode: '2045-03' },
    };
    expect(isCanonicalOwnerOfLinkedTaxAccount(active, [active, replaced])).toBe(true);
    expect(isCanonicalOwnerOfLinkedTaxAccount(replaced, [active, replaced])).toBe(false);
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
              entryType: 'Regular',
              reversalStatus: null,
            },
          },
        ]),
      },
    };

    const taxType = {
      id: 'cit-1',
      taxId: 'MW-CIT-vmssc731p',
      taxCode: 'MW-CIT-vmssc731p',
      taxName: 'Corporate Income Tax',
      status: 'Active',
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
    const select = prisma.journalEntryLine.findMany.mock.calls[0][0].select.journalEntry.select;
    expect(select).not.toHaveProperty('isReversal');
    expect(select).toHaveProperty('reversalStatus');
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
              entryType: 'Regular',
              reversalStatus: null,
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
              entryType: 'Reversal',
              reversalStatus: 'REVERSAL',
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
      status: 'Active',
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
