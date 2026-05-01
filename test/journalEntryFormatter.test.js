import { describe, expect, it } from 'vitest';
import { coerceJournalAmount, expandJournalEntryLines, formatJournalEntry } from '@/lib/journalEntryFormatter.js';

describe('journalEntryFormatter', () => {
  it('coerceJournalAmount handles strings and invalid values', () => {
    expect(coerceJournalAmount('123.45')).toBe(123.45);
    expect(coerceJournalAmount(null)).toBe(0);
    expect(coerceJournalAmount(Number.NaN)).toBe(0);
  });

  it('expands legacy header-only JournalEntry into one synthetic line', () => {
    const lines = expandJournalEntryLines({
      id: 'je1',
      accountId: 'acc1',
      debit: 500,
      credit: 0,
      lines: [],
      description: 'Capital contribution',
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].accountId).toBe('acc1');
    expect(lines[0].debitAmount).toBe(500);
    expect(lines[0].creditAmount).toBe(0);
  });

  it('formatJournalEntry uses expanded lines for totals', () => {
    const formatted = formatJournalEntry({
      id: 'je1',
      accountId: 'acc1',
      debit: 250,
      credit: 0,
      lines: [],
      description: 'Test',
      status: 'Posted',
      referenceNumber: 'REF-1',
      entryDate: new Date('2024-06-01'),
      date: null,
      entryType: 'Regular',
      notes: null,
      sourceType: 'capital_contribution',
      sourceId: null,
      createdBy: null,
      postedBy: null,
      transactionId: null,
      isReversal: false,
    });
    expect(formatted.totalDebit).toBe(250);
    expect(formatted.totalCredit).toBe(0);
    expect(formatted.lines).toHaveLength(1);
    expect(formatted.lines[0].debitAmount).toBe(250);
  });
});
