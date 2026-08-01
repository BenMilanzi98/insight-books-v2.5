/**
 * Phase 23 Wave 1 — Marketing numbering (MKT-YYYY-######).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  allocateMarketingNumber,
  formatMarketingNumber,
  utcYearOf,
  MARKETING_CAMPAIGN_NUMBER_RE,
  MARKETING_NUMBER_PREFIX,
} from '@/lib/admin/marketing';

function makePrisma() {
  const seqStore = [];

  const prisma = {
    marketingNumberSeq: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return (
          seqStore.find(
            (r) =>
              r.prefix === where.prefix_year?.prefix && r.year === where.prefix_year?.year
          ) ||
          seqStore.find((r) => r.prefix === where.prefix && r.year === where.year) ||
          null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const existing = seqStore.find(
          (r) => r.prefix === data.prefix && r.year === data.year
        );
        if (existing) {
          const err = new Error('Unique constraint');
          err.code = 'P2002';
          throw err;
        }
        const row = { ...data, updatedAt: new Date() };
        seqStore.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where = {}, data } = {}) => {
        const row = seqStore.find(
          (r) =>
            r.prefix === where.prefix &&
            r.year === where.year &&
            (where.lastIssued === undefined || r.lastIssued === where.lastIssued)
        );
        if (!row) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (fn) => fn(prisma)),
  };

  prisma._seqStore = seqStore;
  return prisma;
}

describe('Marketing Wave 1 — numbering', () => {
  it('formats MKT numbers with UTC year and zero-padded sequence', () => {
    expect(formatMarketingNumber('MKT', 2026, 1)).toBe('MKT-2026-000001');
    expect(formatMarketingNumber('MKT', 2026, 42)).toBe('MKT-2026-000042');
    expect(utcYearOf(new Date('2026-07-30T23:59:59.000Z'))).toBe(2026);
  });

  it('allocates unique MKT-YYYY-###### numbers', async () => {
    const prisma = makePrisma();
    const now = new Date('2026-08-01T12:00:00.000Z');

    const a = await allocateMarketingNumber(prisma, {
      prefix: MARKETING_NUMBER_PREFIX.CAMPAIGN,
      now,
    });
    const b = await allocateMarketingNumber(prisma, {
      prefix: MARKETING_NUMBER_PREFIX.CAMPAIGN,
      now,
    });

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.number).toMatch(MARKETING_CAMPAIGN_NUMBER_RE);
    expect(b.number).toMatch(MARKETING_CAMPAIGN_NUMBER_RE);
    expect(a.number).toBe('MKT-2026-000001');
    expect(b.number).toBe('MKT-2026-000002');
    expect(new Set([a.number, b.number]).size).toBe(2);
  });

  it('rejects invalid prefix', async () => {
    const prisma = makePrisma();
    const result = await allocateMarketingNumber(prisma, { prefix: 'LEAD' });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid_marketing_number_prefix');
  });

  it('fails closed when MarketingNumberSeq model is absent', async () => {
    const result = await allocateMarketingNumber({}, { prefix: 'MKT' });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('marketing_number_seq_unavailable');
  });
});
