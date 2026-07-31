import { describe, it, expect } from 'vitest';
import { generateClosingJournalPreview } from '../lib/accountingClose/domain/closingJournalGenerator.js';
import { CloseMethod, ClosingBatchStatus, YearEndCloseRunStatus } from '../lib/accountingClose/domain/enums.js';
import { YEAR_END_CHECKLIST_TEMPLATE } from '../lib/accountingClose/domain/yearEndChecklist.js';

describe('continuous carry-forward contract', () => {
  it('documents no opening journal for BS accounts after close', () => {
    const preview = generateClosingJournalPreview({
      closingMethod: CloseMethod.DIRECT_TO_RETAINED_EARNINGS,
      destinationAccountId: 're',
      closeDrawings: false,
      accounts: [
        { accountId: 'rev', category: 'REVENUE', rawNetMinor: -50_000 },
        { accountId: 'bank', category: 'ASSET', rawNetMinor: 400_000_000 },
        { accountId: 'ap', category: 'LIABILITY', rawNetMinor: -150_000_000 },
      ],
    });
    expect(preview.lines.every((l) => l.accountId !== 'bank' && l.accountId !== 'ap')).toBe(true);
    expect(preview.notes.some((n) => /Balance Sheet/i.test(n))).toBe(true);
  });
});

describe('year-end checklist coverage', () => {
  it('includes bank, AR, AP, inventory, payroll, assets, loans, tax, equity, closing gates', () => {
    const keys = YEAR_END_CHECKLIST_TEMPLATE.tasks.map((t) => t.taskKey);
    for (const required of [
      'YE_BANK_RECONCILED',
      'YE_AR_RECONCILE',
      'YE_AP_RECONCILE',
      'YE_INVENTORY_FINAL',
      'YE_PAYROLL_FINAL',
      'YE_ASSETS_DEPR',
      'YE_LOANS_FINAL',
      'YE_TAX_FINAL',
      'YE_EQUITY_RECONCILE',
      'YE_CLOSING_PREVIEW',
      'YE_PCTB_PREVIEW',
      'YE_NEXT_YEAR',
    ]) {
      expect(keys).toContain(required);
    }
  });
});

describe('close status catalogue', () => {
  it('keeps period-end and year-end statuses distinct from batch statuses', () => {
    expect(YearEndCloseRunStatus.APPROVED_FOR_CLOSING).toBeTruthy();
    expect(ClosingBatchStatus.POSTED).toBeTruthy();
    expect(ClosingBatchStatus.REVERSED).toBeTruthy();
    expect(YearEndCloseRunStatus.SUPERSEDED).toBeTruthy();
  });
});

describe('dividend / capital close safety', () => {
  it('does not treat share capital or dividends payable as temporary', () => {
    const preview = generateClosingJournalPreview({
      closingMethod: CloseMethod.INCOME_SUMMARY_TO_RETAINED_EARNINGS,
      destinationAccountId: 're',
      incomeSummaryAccount: { accountId: 'is' },
      closeDrawings: false,
      accounts: [
        { accountId: 'rev', category: 'REVENUE', rawNetMinor: -10_000 },
        { accountId: 'sc', category: 'EQUITY', subType: 'SHARE_CAPITAL', rawNetMinor: -1_000_000 },
        { accountId: 'divpay', category: 'LIABILITY', rawNetMinor: -30_000 },
      ],
    });
    expect(preview.lines.some((l) => l.accountId === 'sc')).toBe(false);
    expect(preview.lines.some((l) => l.accountId === 'divpay')).toBe(false);
  });
});
