import { describe, expect, it } from 'vitest';
import { buildV2CogsJournalEntryAnd } from '../lib/fetchCogsExpenseRegisterRows.js';

describe('buildV2CogsJournalEntryAnd', () => {
  it('does not use entryType: null (Prisma rejects null on non-nullable JournalEntry.entryType)', () => {
    const and = buildV2CogsJournalEntryAnd({});
    const flat = JSON.stringify(and);
    expect(flat).not.toContain('"entryType":null');
    expect(and.some((clause) => clause.entryType === null)).toBe(false);
    expect(
      and.some(
        (clause) =>
          clause.OR &&
          clause.OR.some((o) => Object.prototype.hasOwnProperty.call(o, 'entryType') && o.entryType === null)
      )
    ).toBe(false);
  });

  it('excludes Reversal entry types with a notIn filter', () => {
    const and = buildV2CogsJournalEntryAnd({});
    const entryTypeClause = and.find((c) => c.entryType?.notIn);
    expect(entryTypeClause).toEqual({
      entryType: { notIn: ['Reversal', 'REVERSAL'] },
    });
  });

  it('limits V2 rows to Sale-COGS / Invoice-COGS source types', () => {
    const and = buildV2CogsJournalEntryAnd({});
    expect(and[0]).toEqual({
      sourceType: { in: ['Sale-COGS', 'Invoice-COGS'] },
    });
  });

  it('still allows null / NOT_REVERSED reversalStatus', () => {
    const and = buildV2CogsJournalEntryAnd({});
    const reversal = and.find((c) => Array.isArray(c.OR) && c.OR.some((o) => 'reversalStatus' in o));
    expect(reversal?.OR).toEqual(
      expect.arrayContaining([
        { reversalStatus: null },
        { reversalStatus: 'NOT_REVERSED' },
        { reversalStatus: { equals: '' } },
      ])
    );
  });
});
