import { describe, it, expect } from 'vitest';
import { validateJournalEntryPayload } from '../lib/journalEntryValidation.js';

describe('validateJournalEntryPayload', () => {
  const basePayload = {
    tenantId: 'tenant-1',
    entryDate: new Date('2026-06-19'),
    description: 'purchase of vehicle',
    entryType: 'Correction',
    lines: [
      { accountId: 'acc-1', debitAmount: 1000, creditAmount: 0 },
      { accountId: 'acc-2', debitAmount: 0, creditAmount: 1000 },
    ],
  };

  it('accepts null sourceId and notes (manual journal form)', () => {
    const parsed = validateJournalEntryPayload({
      ...basePayload,
      sourceId: null,
      notes: null,
    });
    expect(parsed.sourceId).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it('accepts omitted sourceId and notes', () => {
    const parsed = validateJournalEntryPayload(basePayload);
    expect(parsed.sourceId).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });
});
