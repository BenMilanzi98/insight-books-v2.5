import { describe, it, expect } from 'vitest';
import {
  generateClosingJournalPreview,
  validatePostClosingBalances,
  checksumPreview,
} from '../lib/accountingClose/domain/closingJournalGenerator.js';
import { isTemporaryIncomeStatementAccount } from '../lib/accountingClose/domain/temporaryAccounts.js';
import { CloseMethod } from '../lib/accountingClose/domain/enums.js';
import { CLOSE_PERMISSIONS } from '../lib/accountingClose/permissions.js';
import { YEAR_END_CHECKLIST_TEMPLATE } from '../lib/accountingClose/domain/yearEndChecklist.js';

describe('temporary account classification', () => {
  it('treats revenue and expense as temporary', () => {
    expect(isTemporaryIncomeStatementAccount({ category: 'REVENUE', isHeader: false })).toBe(true);
    expect(isTemporaryIncomeStatementAccount({ category: 'EXPENSE', isHeader: false })).toBe(true);
    expect(isTemporaryIncomeStatementAccount({ category: 'ASSET', isHeader: false })).toBe(false);
  });

  it('never treats RE / CYE / capital as temporary', () => {
    expect(
      isTemporaryIncomeStatementAccount({ category: 'EQUITY', subType: 'RETAINED_EARNINGS' })
    ).toBe(false);
    expect(
      isTemporaryIncomeStatementAccount({ category: 'EQUITY', subType: 'CURRENT_YEAR_EARNINGS' })
    ).toBe(false);
    expect(
      isTemporaryIncomeStatementAccount({ category: 'EQUITY', subType: 'SHARE_CAPITAL' })
    ).toBe(false);
  });
});

describe('income summary closing — profitable year (Scenario 1)', () => {
  const accounts = [
    { accountId: 'rev', accountCode: '4000', accountName: 'Revenue', category: 'REVENUE', rawNetMinor: -2_000_000_000 },
    { accountId: 'cos', accountCode: '5000', accountName: 'COS', category: 'COST_OF_SALES', rawNetMinor: 800_000_000 },
    { accountId: 'exp', accountCode: '6000', accountName: 'Expenses', category: 'EXPENSE', rawNetMinor: 600_000_000 },
    { accountId: 'tax', accountCode: '7000', accountName: 'Tax', category: 'EXPENSE', subType: 'TAX_EXPENSE', rawNetMinor: 100_000_000 },
    { accountId: 'bank', accountCode: '1000', accountName: 'Bank', category: 'ASSET', rawNetMinor: 500_000_000 },
  ];

  it('closes temps via Income Summary and transfers MK5,000,000 profit once', () => {
    const preview = generateClosingJournalPreview({
      closingMethod: CloseMethod.INCOME_SUMMARY_TO_RETAINED_EARNINGS,
      destinationAccountId: 're',
      incomeSummaryAccount: { accountId: 'is', accountCode: '3900', accountName: 'Income Summary' },
      accounts,
      closeDrawings: false,
    });

    expect(preview.calculatedProfitOrLossMinor).toBe(500_000_000); // MK 5,000,000.00 in minor? Wait - minor is cents
    // 20M - 8M - 6M - 1M = 5M; if rawNetMinor is in cents: 2_000_000_000 = 20,000,000.00
    expect(preview.totalDebitMinor).toBe(preview.totalCreditMinor);
    expect(preview.lines.some((l) => l.accountId === 'bank')).toBe(false);

    const reCredits = preview.lines
      .filter((l) => l.accountId === 're')
      .reduce((s, l) => s + l.creditMinor - l.debitMinor, 0);
    expect(reCredits).toBe(500_000_000);

    const isNet = preview.lines
      .filter((l) => l.accountId === 'is')
      .reduce((s, l) => s + l.debitMinor - l.creditMinor, 0);
    expect(isNet).toBe(0);
  });

  it('checksum is stable for same preview', () => {
    const preview = generateClosingJournalPreview({
      closingMethod: CloseMethod.INCOME_SUMMARY_TO_RETAINED_EARNINGS,
      destinationAccountId: 're',
      incomeSummaryAccount: { accountId: 'is' },
      accounts,
      closeDrawings: false,
    });
    expect(checksumPreview(preview)).toBe(preview.previewChecksum);
  });
});

describe('loss year transfer (Scenario 2)', () => {
  it('debits Retained Earnings for loss', () => {
    const preview = generateClosingJournalPreview({
      closingMethod: CloseMethod.INCOME_SUMMARY_TO_RETAINED_EARNINGS,
      destinationAccountId: 're',
      incomeSummaryAccount: { accountId: 'is' },
      closeDrawings: false,
      accounts: [
        { accountId: 'rev', category: 'REVENUE', rawNetMinor: -100_000 },
        { accountId: 'exp', category: 'EXPENSE', rawNetMinor: 300_000 },
      ],
    });
    expect(preview.calculatedProfitOrLossMinor).toBe(-200_000);
    const re = preview.lines.filter((l) => l.accountId === 're');
    expect(re.some((l) => l.debitMinor === 200_000)).toBe(true);
  });
});

describe('drawings close (Scenario 3 fragment)', () => {
  it('closes drawings to owner capital, not expenses', () => {
    const preview = generateClosingJournalPreview({
      closingMethod: CloseMethod.OWNER_CAPITAL_CLOSE,
      destinationAccountId: 'oc',
      ownerCapitalAccount: { accountId: 'oc' },
      closeDrawings: true,
      accounts: [
        { accountId: 'rev', category: 'REVENUE', rawNetMinor: -200_000 },
        {
          accountId: 'drw',
          accountCode: '3150',
          category: 'EQUITY',
          subType: 'DRAWINGS',
          systemPurpose: 'OWNER_DRAWINGS',
          rawNetMinor: 30_000,
        },
      ],
    });
    const drwLines = preview.lines.filter((l) => l.accountId === 'drw');
    expect(drwLines.some((l) => l.creditMinor === 30_000)).toBe(true);
    expect(preview.lines.every((l) => l.lineRole !== 'CLOSE_EXPENSE' || l.accountId !== 'drw')).toBe(true);
  });
});

describe('partnership allocation (Scenario 4)', () => {
  it('allocates 60/40', () => {
    const preview = generateClosingJournalPreview({
      closingMethod: CloseMethod.PARTNER_CAPITAL_ALLOCATION,
      destinationAccountId: 'unused',
      incomeSummaryAccount: { accountId: 'is' },
      closeDrawings: false,
      partnerAllocations: [
        { partnerAccountId: 'pa', shareMinor: 6000 },
        { partnerAccountId: 'pb', shareMinor: 4000 },
      ],
      accounts: [{ accountId: 'rev', category: 'REVENUE', rawNetMinor: -1_000_000_000 }],
    });
    expect(preview.calculatedProfitOrLossMinor).toBe(1_000_000_000);
    const a = preview.lines.find((l) => l.accountId === 'pa');
    const b = preview.lines.find((l) => l.accountId === 'pb');
    expect(a.creditMinor).toBe(600_000_000);
    expect(b.creditMinor).toBe(400_000_000);
  });
});

describe('post-closing validation', () => {
  it('flags non-zero temporary accounts', () => {
    const failures = validatePostClosingBalances([
      { accountId: 'rev', accountCode: '4000', category: 'REVENUE', rawNetMinor: 100 },
      { accountId: 'bank', accountCode: '1000', category: 'ASSET', rawNetMinor: 500 },
    ]);
    expect(failures.some((f) => f.accountId === 'rev')).toBe(true);
    expect(failures.some((f) => f.accountId === 'bank')).toBe(false);
  });
});

describe('catalogue', () => {
  it('exposes checklist and permissions', () => {
    expect(YEAR_END_CHECKLIST_TEMPLATE.tasks.length).toBeGreaterThan(20);
    expect(CLOSE_PERMISSIONS.POST_CLOSING).toBe('accountingClose.postClosingJournals');
    expect(CLOSE_PERMISSIONS.CLOSE_YEAR).toBe('accountingClose.closeYear');
  });
});
