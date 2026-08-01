/**
 * Phase 23 Wave 1 — Marketing overview (UNAVAILABLE metrics, never zero).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  getMarketingOverview,
  MARKETING_WAVE1_UNAVAILABLE_METRICS,
  MARKETING_WAVE1_UNAVAILABLE_REASON,
  MARKETING_DEFINITION_VERSION,
  MARKETING_READINESS,
} from '@/lib/admin/marketing';

const marketingAdmin = {
  id: 'admin-mkt-1',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      marketing: { view: true },
    },
  },
};

function makePrisma(campaignRows = []) {
  return {
    marketingCampaign: {
      groupBy: vi.fn(async () =>
        campaignRows.map((r) => ({ status: r.status, _count: { _all: r.count } }))
      ),
    },
    marketingChannel: { count: vi.fn(async () => 8) },
    marketingSource: { count: vi.fn(async () => 8) },
    marketingMedium: { count: vi.fn(async () => 8) },
    marketingSourceNormalisationRule: { count: vi.fn(async () => 0) },
  };
}

describe('Marketing Wave 1 — overview', () => {
  it('returns UNAVAILABLE metrics with null values — never zero placeholders', async () => {
    const prisma = makePrisma([
      { status: 'DRAFT', count: 2 },
      { status: 'ACTIVE', count: 1 },
    ]);

    const result = await getMarketingOverview(prisma, { admin: marketingAdmin });

    expect(result.ok).toBe(true);
    expect(result.catalogueVersion).toBe(MARKETING_DEFINITION_VERSION);
    expect(result.wave).toBe(1);
    expect(result.readiness).toBe(MARKETING_READINESS.WAVE1_FOUNDATION);
    expect(result.metrics).toHaveLength(MARKETING_WAVE1_UNAVAILABLE_METRICS.length);

    for (const metric of result.metrics) {
      expect(MARKETING_WAVE1_UNAVAILABLE_METRICS).toContain(metric.code);
      expect(metric.status).toBe('UNAVAILABLE');
      expect(metric.value).toBeNull();
      expect(metric.reason).toBe(MARKETING_WAVE1_UNAVAILABLE_REASON);
      expect(metric.value).not.toBe(0);
    }

    expect(result.campaignCounts.DRAFT).toBe(2);
    expect(result.campaignCounts.ACTIVE).toBe(1);
    expect(result.campaignCounts.PAUSED).toBe(0);
    expect(result.taxonomyCounts.channels).toBe(8);
  });

  it('forbids overview without marketing.view', async () => {
    const prisma = makePrisma();
    const result = await getMarketingOverview(prisma, {
      admin: { id: 'x', role: 'Platform Support', permissions: {} },
    });
    expect(result.ok).toBe(false);
    expect(result.forbidden).toBe(true);
  });
});
