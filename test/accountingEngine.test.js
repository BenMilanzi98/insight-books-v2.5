/**
 * Legacy postGlEntry is permanently retired (V2 executePosting only).
 * These tests lock the fail-closed behaviour so modules cannot silently re-enable it.
 */

import { describe, it, expect } from 'vitest';
import { postGlEntry, AccountingEngineError } from '../lib/accountingEngine/postGlEntry.js';
import { manualJournalEntryWhere } from '../lib/accountingEngine/constants.js';

describe('accountingEngine postGlEntry (legacy removed)', () => {
  it('rejects all calls with LEGACY_POSTING_REMOVED', async () => {
    await expect(
      postGlEntry({
        tenantId: 't1',
        userId: 'u1',
        entryDate: new Date('2026-01-15'),
        description: 'Test',
        lines: [
          { accountId: 'a', debitAmount: 100, creditAmount: 0 },
          { accountId: 'b', debitAmount: 0, creditAmount: 100 },
        ],
      })
    ).rejects.toMatchObject({
      name: 'AccountingEngineError',
      code: 'LEGACY_POSTING_REMOVED',
    });
  });

  it('rejects unbalanced and single-line attempts the same way (no legacy write path)', async () => {
    await expect(
      postGlEntry({
        tenantId: 't1',
        userId: 'u1',
        entryDate: new Date(),
        description: 'Unbalanced',
        lines: [
          { accountId: 'a', debitAmount: 100, creditAmount: 0 },
          { accountId: 'b', debitAmount: 0, creditAmount: 90 },
        ],
      })
    ).rejects.toBeInstanceOf(AccountingEngineError);

    await expect(
      postGlEntry({
        tenantId: 't1',
        userId: 'u1',
        entryDate: new Date(),
        description: 'Single',
        lines: [{ accountId: 'a', debitAmount: 50, creditAmount: 0 }],
      })
    ).rejects.toMatchObject({ code: 'LEGACY_POSTING_REMOVED' });
  });

  it('exports manualJournalEntryWhere helper for legacy transaction queries', () => {
    expect(manualJournalEntryWhere).toBeTruthy();
    expect(['object', 'function']).toContain(typeof manualJournalEntryWhere);
  });
});
